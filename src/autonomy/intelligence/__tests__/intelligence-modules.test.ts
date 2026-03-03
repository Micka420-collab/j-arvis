import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContextEnricher } from "../context-enricher.js";
import { PredictiveEngine } from "../predictive-engine.js";
import { ReinforcementLearner } from "../reinforcement-learner.js";
import { SemanticMemory } from "../semantic-memory.js";
import { MultiModalProcessor } from "../multi-modal-processor.js";

describe("Intelligence Modules", () => {
  describe("ContextEnricher", () => {
    let enricher: ContextEnricher;

    beforeEach(() => {
      enricher = new ContextEnricher();
    });

    it("should enrich context with temporal data", async () => {
      const context = await enricher.enrichContext({
        userId: "user123",
        timestamp: new Date("2026-03-03T08:30:00"),
      });

      expect(context.temporal).toBeDefined();
      expect(context.temporal.timeOfDay).toBe("morning");
      expect(context.temporal.dayOfWeek).toBe(2); // Tuesday
      expect(context.temporal.season).toBe("spring");
    });

    it("should enrich context with emotional data", async () => {
      const context = await enricher.enrichContext({
        userId: "user123",
        timestamp: new Date(),
        emotionalInput: {
          mood: "happy",
          energyLevel: 8,
          stressLevel: 2,
        },
      });

      expect(context.emotional).toBeDefined();
      expect(context.emotional.mood).toBe("happy");
      expect(context.emotional.energyLevel).toBe(8);
      expect(context.emotional.stressLevel).toBe(2);
    });

    it("should generate contextual suggestions", async () => {
      const context = await enricher.enrichContext({
        userId: "user123",
        timestamp: new Date("2026-03-03T19:00:00"),
        emotionalInput: {
          mood: "tired",
          energyLevel: 3,
          stressLevel: 7,
        },
      });

      const suggestions = enricher.generateContextualSuggestions(context);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].suggestion).toContain("relax");
      expect(suggestions[0].confidence).toBeGreaterThan(0.8);
    });
  });

  describe("PredictiveEngine", () => {
    let engine: PredictiveEngine;

    beforeEach(() => {
      engine = new PredictiveEngine();
    });

    it("should record and retrieve events", () => {
      const date = new Date("2026-03-03T08:00:00");
      engine.recordEvent("make_coffee", 1, "morning", date);

      const history = engine.getHistory("make_coffee");
      expect(history).toHaveLength(1);
      expect(history[0].event).toBe("make_coffee");
      expect(history[0].value).toBe(1);
    });

    it("should predict next event occurrence", () => {
      // Record regular coffee events
      for (let i = 0; i < 5; i++) {
        const date = new Date("2026-03-01");
        date.setDate(date.getDate() + i);
        date.setHours(8, 0, 0, 0);
        engine.recordEvent("make_coffee", 1, "morning", date);
      }

      const prediction = engine.predictNext("make_coffee", 60);

      expect(prediction).toBeDefined();
      expect(prediction.probability).toBeGreaterThan(0.7);
      expect(prediction.trend).toBe("stable");
    });

    it("should detect anomalies", () => {
      // Regular pattern
      for (let i = 0; i < 10; i++) {
        engine.recordEvent("lights_on", 1, "evening", new Date());
      }

      // Anomaly: lights on at unusual time
      const anomalyPrediction = engine.predictNext("lights_on", 10, new Date());
      
      // Should have lower confidence or detect anomaly
      expect(anomalyPrediction.confidence).toBeLessThan(0.9);
    });

    it("should handle multiple event types", () => {
      engine.recordEvent("coffee", 1, "morning", new Date());
      engine.recordEvent("lights", 1, "evening", new Date());
      engine.recordEvent("music", 1, "afternoon", new Date());

      const predictions = engine.predictMultiple(["coffee", "lights", "music"], 60);

      expect(predictions).toHaveLength(3);
      expect(predictions.map(p => p.event)).toContain("coffee");
      expect(predictions.map(p => p.event)).toContain("lights");
      expect(predictions.map(p => p.event)).toContain("music");
    });
  });

  describe("ReinforcementLearner", () => {
    let learner: ReinforcementLearner;

    beforeEach(() => {
      learner = new ReinforcementLearner({
        learningRate: 0.1,
        explorationRate: 0.1, // Low exploration for testing
      });
    });

    it("should choose from available actions", () => {
      const actions = ["action_a", "action_b", "action_c"];
      const state = "test_state";

      const action = learner.chooseAction(state, actions);

      expect(actions).toContain(action);
    });

    it("should learn from positive feedback", () => {
      const state = "morning";
      const action = "suggest_coffee";
      const actions = ["suggest_coffee", "suggest_music"];

      // First, choose action
      learner.chooseAction(state, actions);

      // Learn from positive feedback
      const reward = learner.feedbackToReward(state, action, "positive");
      learner.learn(reward);

      const stats = learner.getStats();
      expect(stats.totalStates).toBeGreaterThan(0);
      expect(stats.averageQValue).toBeGreaterThan(0);
    });

    it("should prefer high-value actions over time", () => {
      const state = "test";
      const actions = ["good_action", "bad_action"];

      // Train with feedback
      for (let i = 0; i < 20; i++) {
        const action = learner.chooseAction(state, actions);
        const feedback = action === "good_action" ? "positive" : "negative";
        const reward = learner.feedbackToReward(state, action, feedback);
        learner.learn(reward);
      }

      const bestActions = learner.getBestActions(state, 1);
      expect(bestActions[0].action).toBe("good_action");
      expect(bestActions[0].qValue).toBeGreaterThan(0);
    });

    it("should decay exploration rate", () => {
      const initialRate = learner.getStats().explorationRate;
      
      // Perform some learning
      for (let i = 0; i < 10; i++) {
        learner.chooseAction("state", ["a", "b"]);
        learner.learn({ state: "state", action: "a", value: 1, timestamp: Date.now() });
      }

      const finalRate = learner.getStats().explorationRate;
      expect(finalRate).toBeLessThan(initialRate);
    });

    it("should calculate appropriate reward values", () => {
      const positiveReward = learner.feedbackToReward("s", "a", "positive");
      const neutralReward = learner.feedbackToReward("s", "a", "neutral");
      const negativeReward = learner.feedbackToReward("s", "a", "negative");

      expect(positiveReward.value).toBeGreaterThan(neutralReward.value);
      expect(neutralReward.value).toBeGreaterThan(negativeReward.value);
      expect(negativeReward.value).toBeLessThan(0);
    });
  });

  describe("SemanticMemory", () => {
    let memory: SemanticMemory;

    beforeEach(() => {
      memory = new SemanticMemory(100, 64);
    });

    it("should store and retrieve memories", async () => {
      const id = await memory.store(
        "L'utilisateur aime le café",
        "preference",
        0.9
      );

      const retrieved = memory.get(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe("L'utilisateur aime le café");
      expect(retrieved?.category).toBe("preference");
      expect(retrieved?.importance).toBe(0.9);
    });

    it("should search for similar memories", async () => {
      await memory.store("J'aime le café le matin", "preference", 0.8);
      await memory.store("Je préfère le thé l'après-midi", "preference", 0.7);
      await memory.store("Réunion demain à 14h", "event", 0.9);

      const results = await memory.search("boisson chaude", 2);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0);
      // Most similar should be about coffee
      expect(results[0].entry.content.toLowerCase()).toContain("café");
    });

    it("should retrieve memories by category", async () => {
      await memory.store("Préférence 1", "preference", 0.8);
      await memory.store("Préférence 2", "preference", 0.7);
      await memory.store("Événement 1", "event", 0.9);

      const preferences = memory.getByCategory("preference");
      expect(preferences).toHaveLength(2);
      
      const events = memory.getByCategory("event");
      expect(events).toHaveLength(1);
    });

    it("should return most important memories", async () => {
      await memory.store("Important", "preference", 1.0);
      await memory.store("Moins important", "preference", 0.3);
      await memory.store("Moyennement important", "preference", 0.6);

      const mostImportant = memory.getMostImportant(1);
      expect(mostImportant).toHaveLength(1);
      expect(mostImportant[0].importance).toBe(1.0);
    });

    it("should reinforce memory importance", async () => {
      const id = await memory.store("Test", "preference", 0.5);
      
      memory.reinforceMemory(id, 0.2);
      
      const reinforced = memory.get(id);
      expect(reinforced?.importance).toBe(0.7);
    });

    it("should generate autobiographical narrative", async () => {
      await memory.store("Début de journée productive", "emotion", 0.8);
      await memory.store("Réunion réussie", "event", 0.9);
      await memory.store("Fin de journée relaxante", "emotion", 0.7);

      const narrative = memory.generateNarrative("day");
      
      expect(narrative).toContain("Journée type");
      expect(narrative.length).toBeGreaterThan(0);
    });

    it("should enforce memory size limit", async () => {
      const smallMemory = new SemanticMemory(3, 64);
      
      await smallMemory.store("Memory 1", "preference", 0.5);
      await smallMemory.store("Memory 2", "preference", 0.4);
      await smallMemory.store("Memory 3", "preference", 0.3);
      await smallMemory.store("Memory 4", "preference", 0.6); // Should evict lowest importance

      const stats = smallMemory.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(3);
    });
  });

  describe("MultiModalProcessor", () => {
    let processor: MultiModalProcessor;

    beforeEach(() => {
      processor = new MultiModalProcessor();
    });

    it("should process text input", async () => {
      const result = await processor.process({
        text: "Allume la lumière du salon",
      });

      expect(result.fusedIntent).toBeDefined();
      expect(result.sources.text).toBeDefined();
      expect(result.dominatedBy).toBe("text");
    });

    it("should process multiple modalities", async () => {
      const result = await processor.process({
        text: "Il fait sombre",
        sensors: {
          motion: true,
          light: 10, // Low light
          temperature: 20,
        },
      });

      expect(Object.keys(result.sources).length).toBeGreaterThan(1);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should detect conflicts between modalities", async () => {
      const result = await processor.process({
        text: "Allume la lumière",
        smartHome: {
          lights: ["living_room"], // Already on
          temperature: 20,
          activeScenes: [],
        },
      });

      expect(result.conflicts).toBeDefined();
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.resolution).toBeDefined();
    });

    it("should provide confidence scores", async () => {
      const result = await processor.process({
        text: "Musique",
        voice: {
          transcript: "Musique jazz",
          emotion: "happy",
          confidence: 0.9,
        },
      });

      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.sources.voice?.confidence).toBe(0.9);
    });

    it("should extract entities from text", async () => {
      const result = await processor.process({
        text: "Rappelle-moi d'appeler Jean demain à 14h",
      });

      expect(result.extractedEntities).toBeDefined();
      const hasPerson = result.extractedEntities.some(
        e => e.type === "person" && e.value === "Jean"
      );
      const hasTime = result.extractedEntities.some(
        e => e.type === "time"
      );
      expect(hasPerson || hasTime).toBe(true);
    });
  });

  describe("Integration Tests", () => {
    it("should work together for proactive suggestion", async () => {
      const enricher = new ContextEnricher();
      const predictor = new PredictiveEngine();
      const rl = new ReinforcementLearner();
      const memory = new SemanticMemory(100, 64);

      // Setup: User has coffee every morning
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(8, 0, 0, 0);
        predictor.recordEvent("make_coffee", 1, "morning", date);
      }

      // Store preference
      await memory.store("L'utilisateur aime le café fort", "preference", 0.9);

      // Enrich context
      const context = await enricher.enrichContext({
        userId: "user123",
        timestamp: new Date("2026-03-03T08:00:00"),
      });

      // Predict need
      const prediction = predictor.predictNext("make_coffee", 30);

      // RL decision
      const state = `${context.temporal.timeOfDay}_${context.emotional.energyLevel || "medium"}`;
      const action = rl.chooseAction(state, ["suggest_coffee", "suggest_tea"]);

      // Verify integration works
      expect(context.temporal.timeOfDay).toBe("morning");
      expect(prediction.probability).toBeGreaterThan(0.7);
      expect(["suggest_coffee", "suggest_tea"]).toContain(action);
    });

    it("should adapt to user feedback over time", async () => {
      const rl = new ReinforcementLearner({
        learningRate: 0.2,
        explorationRate: 0.1,
      });

      const state = "evening_tired";
      const actions = ["suggest_relax", "suggest_work"];

      // Simulate learning over time
      for (let i = 0; i < 30; i++) {
        const action = rl.chooseAction(state, actions);
        // User prefers relax in evening when tired
        const feedback = action === "suggest_relax" ? "positive" : "negative";
        const reward = rl.feedbackToReward(state, action, feedback);
        rl.learn(reward);
      }

      const bestActions = rl.getBestActions(state, 1);
      expect(bestActions[0].action).toBe("suggest_relax");
      expect(bestActions[0].qValue).toBeGreaterThan(5);
    });
  });
});
