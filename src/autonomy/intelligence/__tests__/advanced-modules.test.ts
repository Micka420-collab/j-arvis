import { describe, it, expect, beforeEach } from "vitest";
import { IntelligenceCoordinator } from "../intelligence-coordinator.js";
import { CausalReasoner } from "../causal-reasoner.js";
import { DigitalTwin } from "../digital-twin.js";
import { ContextEnricher } from "../context-enricher.js";
import { PredictiveEngine } from "../predictive-engine.js";
import { ReinforcementLearner } from "../reinforcement-learner.js";
import { SemanticMemory } from "../semantic-memory.js";
import { MultiModalProcessor } from "../multi-modal-processor.js";

describe("Advanced Intelligence Modules", () => {
  describe("IntelligenceCoordinator", () => {
    let coordinator: IntelligenceCoordinator;
    let modules: {
      contextEnricher: ContextEnricher;
      predictiveEngine: PredictiveEngine;
      reinforcementLearner: ReinforcementLearner;
      semanticMemory: SemanticMemory;
      multiModalProcessor: MultiModalProcessor;
    };

    beforeEach(() => {
      modules = {
        contextEnricher: new ContextEnricher(),
        predictiveEngine: new PredictiveEngine(),
        reinforcementLearner: new ReinforcementLearner(),
        semanticMemory: new SemanticMemory(100, 64),
        multiModalProcessor: new MultiModalProcessor(),
      };

      coordinator = new IntelligenceCoordinator(modules, {
        autonomyThreshold: 0.7,
        maxSuggestions: 3,
        explainableMode: true,
      });
    });

    it("should coordinate all modules for a decision", async () => {
      const baseContext = {
        userId: "user123",
        timestamp: new Date("2026-03-03T08:00:00"),
      };

      const decision = await coordinator.coordinate(baseContext);

      expect(decision).toBeDefined();
      expect(decision.decision).toBeDefined();
      expect(decision.explanation).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.contributors.length).toBeGreaterThan(0);
      expect(decision.processingTime).toBeGreaterThan(0);
    });

    it("should generate explanation for decisions", async () => {
      const baseContext = {
        userId: "user123",
        timestamp: new Date("2026-03-03T19:00:00"),
      };

      const decision = await coordinator.coordinate(baseContext);

      expect(decision.explanation.summary).toBeDefined();
      expect(decision.explanation.contextualFactors.length).toBeGreaterThan(0);
      expect(decision.explanation.reasoning.length).toBeGreaterThan(0);
    });

    it("should provide alternatives", async () => {
      const baseContext = {
        userId: "user123",
        timestamp: new Date("2026-03-03T08:00:00"),
      };

      const decision = await coordinator.coordinate(baseContext);

      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives.length).toBeLessThanOrEqual(3);
    });

    it("should track decision history", async () => {
      const baseContext = {
        userId: "user123",
        timestamp: new Date(),
      };

      await coordinator.coordinate(baseContext);
      await coordinator.coordinate(baseContext);

      const history = coordinator.getDecisionHistory();
      expect(history).toHaveLength(2);
    });

    it("should provide statistics", async () => {
      const baseContext = {
        userId: "user123",
        timestamp: new Date(),
      };

      await coordinator.coordinate(baseContext);

      const stats = coordinator.getStats();
      expect(stats.totalDecisions).toBe(1);
      expect(stats.avgProcessingTime).toBeGreaterThan(0);
      expect(stats.topContributors.length).toBeGreaterThan(0);
    });
  });

  describe("CausalReasoner", () => {
    let reasoner: CausalReasoner;

    beforeEach(() => {
      reasoner = new CausalReasoner();
    });

    it("should record and store events", () => {
      const id = reasoner.recordEvent({
        type: "coffee_made",
        timestamp: new Date(),
        variables: { intensity: 0.8 },
        outcome: 0.7,
      });

      expect(id).toBeDefined();
      expect(reasoner.getEventHistory()).toHaveLength(1);
    });

    it("should discover causal relations", () => {
      // Record cause-effect pairs
      for (let i = 0; i < 10; i++) {
        const causeTime = new Date(Date.now() + i * 60000);
        reasoner.recordEvent({
          type: "tiredness",
          timestamp: causeTime,
          variables: { level: 0.8 },
        });

        // Effect happens 10 minutes later
        const effectTime = new Date(causeTime.getTime() + 10 * 60000);
        reasoner.recordEvent({
          type: "coffee_made",
          timestamp: effectTime,
          variables: {},
          outcome: 0.8,
        });
      }

      const relation = reasoner.discoverCausalRelations("tiredness", "coffee_made", 30);

      expect(relation).toBeDefined();
      expect(relation!.cause).toBe("tiredness");
      expect(relation!.effect).toBe("coffee_made");
      expect(relation!.strength).toBeGreaterThan(0);
      expect(relation!.evidenceCount).toBeGreaterThanOrEqual(3);
    });

    it("should build causal graph", () => {
      // Record various events
      const eventTypes = ["tiredness", "coffee_made", "energy_boost", "productivity"];
      
      for (let i = 0; i < 20; i++) {
        const type = eventTypes[i % eventTypes.length];
        reasoner.recordEvent({
          type,
          timestamp: new Date(Date.now() + i * 60000),
          variables: {},
        });
      }

      const graph = reasoner.buildCausalGraph(eventTypes);

      expect(graph.nodes).toContain("tiredness");
      expect(graph.nodes).toContain("coffee_made");
      expect(graph.timestamp).toBeDefined();
    });

    it("should analyze counterfactuals", () => {
      const id = reasoner.recordEvent({
        type: "stress",
        timestamp: new Date(),
        variables: { level: 0.9 },
        outcome: -0.5,
      });

      reasoner.buildCausalGraph(["stress", "meditation", "relaxation"]);

      const counterfactual = reasoner.analyzeCounterfactual(id, {
        variables: { level: 0.3 },
      });

      expect(counterfactual).toBeDefined();
      expect(counterfactual!.originalEvent).toBeDefined();
      expect(counterfactual!.predictedOutcome).toBeDefined();
      expect(counterfactual!.reasoning.length).toBeGreaterThan(0);
    });

    it("should perform root cause analysis", () => {
      // Record problem events
      for (let i = 0; i < 5; i++) {
        reasoner.recordEvent({
          type: "bad_mood",
          timestamp: new Date(Date.now() + i * 3600000),
          outcome: -0.7,
        });

        // Preceding events
        reasoner.recordEvent({
          type: "poor_sleep",
          timestamp: new Date(Date.now() + i * 3600000 - 30 * 60000),
          outcome: -0.5,
        });
      }

      const analysis = reasoner.analyzeRootCauses("bad_mood", 24 * 60 * 60 * 1000);

      expect(analysis.problem).toBe("bad_mood");
      expect(analysis.rootCauses).toBeDefined();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it("should suggest interventions", () => {
      const eventTypes = ["tiredness", "coffee_made", "energy_boost"];
      
      // Build causal graph
      for (let i = 0; i < 15; i++) {
        const type = eventTypes[i % eventTypes.length];
        reasoner.recordEvent({
          type,
          timestamp: new Date(Date.now() + i * 60000),
          variables: {},
          outcome: type === "energy_boost" ? 0.8 : 0.5,
        });
      }

      reasoner.buildCausalGraph(eventTypes);

      const interventions = reasoner.suggestInterventions("energy_boost", {});

      expect(interventions.length).toBeGreaterThan(0);
      expect(interventions[0].target).toBeDefined();
      expect(interventions[0].expectedImprovement).toBeGreaterThan(0);
    });

    it("should analyze causal chains", () => {
      const eventTypes = ["rain", "traffic", "delay", "stress"];
      
      for (let i = 0; i < 20; i++) {
        const type = eventTypes[i % eventTypes.length];
        reasoner.recordEvent({
          type,
          timestamp: new Date(Date.now() + i * 60000),
          variables: {},
        });
      }

      reasoner.buildCausalGraph(eventTypes);

      const chain = reasoner.analyzeCausalChain("rain", 3);

      expect(chain.length).toBeGreaterThan(0);
      expect(chain[0].step).toBe(1);
    });

    it("should identify confounders", () => {
      const eventTypes = ["ice_cream", "drowning", "summer"];
      
      // Simulate spurious correlation (both caused by summer)
      for (let i = 0; i < 15; i++) {
        reasoner.recordEvent({ type: "summer", timestamp: new Date(Date.now() + i * 60000), variables: {} });
        reasoner.recordEvent({ type: "ice_cream", timestamp: new Date(Date.now() + i * 60000 + 1000), variables: {} });
        reasoner.recordEvent({ type: "drowning", timestamp: new Date(Date.now() + i * 60000 + 2000), variables: {} });
      }

      reasoner.buildCausalGraph(eventTypes);

      const confounders = reasoner.identifyConfounders("ice_cream", "drowning");

      expect(confounders).toContain("summer");
    });

    it("should provide statistics", () => {
      reasoner.recordEvent({ type: "test", timestamp: new Date(), variables: {} });
      reasoner.buildCausalGraph(["test"]);

      const stats = reasoner.getStats();
      expect(stats.totalEvents).toBe(1);
      expect(stats.lastUpdate).toBeDefined();
    });
  });

  describe("DigitalTwin", () => {
    let twin: DigitalTwin;
    let causalReasoner: CausalReasoner;
    let predictiveEngine: PredictiveEngine;

    beforeEach(() => {
      causalReasoner = new CausalReasoner();
      predictiveEngine = new PredictiveEngine();
      twin = new DigitalTwin(causalReasoner, predictiveEngine);
    });

    it("should sync state with reality", () => {
      twin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 22, humidity: 50 },
        user: { presence: true, activity: "working", energyLevel: 7, mood: "focused" },
      });

      const state = twin.getCurrentState();
      expect(state).toBeDefined();
      expect(state!.location).toBe("home");
      expect(state!.user.energyLevel).toBe(7);
    });

    it("should create simulation scenarios", () => {
      twin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 20, humidity: 50 },
        devices: {},
        user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      });

      const scenario = twin.createScenario(
        "Morning Routine",
        "Simulation of morning routine",
        [{ id: "1", type: "LIGHTS_ON", description: "Turn on lights", parameters: {}, confidence: 0.9 }],
        120
      );

      expect(scenario).toBeDefined();
      expect(scenario.name).toBe("Morning Routine");
      expect(scenario.duration).toBe(120);
    });

    it("should run simulations", async () => {
      twin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 20, humidity: 50 },
        devices: {},
        user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      });

      const scenario = twin.createScenario(
        "Test Scenario",
        "Test",
        [],
        30
      );

      const result = await twin.runSimulation(scenario.id);

      expect(result).toBeDefined();
      expect(result.timeline.length).toBeGreaterThan(0);
      expect(result.finalState).toBeDefined();
      expect(result.outcomes).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should compare scenarios", async () => {
      twin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 20, humidity: 50 },
        devices: {},
        user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      });

      const scenario1 = twin.createScenario("Scenario 1", "Test 1", [], 30);
      const scenario2 = twin.createScenario("Scenario 2", "Test 2", [], 30);

      const comparison = await twin.compareScenarios([scenario1.id, scenario2.id]);

      expect(comparison.best).toBeDefined();
      expect(comparison.rankings).toHaveLength(2);
      expect(comparison.analysis).toBeDefined();
    });

    it("should analyze what-if scenarios", () => {
      twin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 20, humidity: 50 },
        devices: {},
        user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      });

      const scenario = twin.createScenario("Base", "Base scenario", [], 30);

      const whatIf = twin.analyzeWhatIf(scenario.id, [
        { variable: "weather.temperature", newValue: 30, reason: "Hot day" },
      ]);

      expect(whatIf).toBeDefined();
      expect(whatIf.baseScenario).toBe(scenario.id);
      expect(whatIf.changes).toHaveLength(1);
      expect(whatIf.predictions.length).toBeGreaterThan(0);
    });

    it("should suggest optimizations", async () => {
      twin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 20, humidity: 50 },
        devices: {},
        user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      });

      // Run a simulation first to have history
      const scenario = twin.createScenario("Current", "Current approach", [], 30);
      await twin.runSimulation(scenario.id);

      const suggestions = twin.suggestOptimizations("Current");

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("should predict future needs", () => {
      twin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 30, humidity: 50 },
        devices: {},
        user: { presence: true, activity: "working", energyLevel: 2, mood: "tired" },
      });

      const predictions = twin.predictFutureNeeds(60);

      expect(predictions).toBeDefined();
      expect(predictions.length).toBeGreaterThan(0);
      
      // Should predict rest due to low energy
      const restPrediction = predictions.find(p => p.need === "repos");
      expect(restPrediction).toBeDefined();
    });

    it("should perform stress tests", async () => {
      twin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 20, humidity: 50 },
        devices: { lights: { id: "lights", type: "lighting", status: "on", settings: {}, powerConsumption: 50 } },
        user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      });

      const scenario = twin.createScenario("Base", "Base", [], 30);

      const stressTest = await twin.stressTest(scenario.id, [
        { type: "temperature_spike", magnitude: 1.5 },
        { type: "device_failure", magnitude: 1 },
      ]);

      expect(stressTest.baseline).toBeDefined();
      expect(stressTest.stressed).toHaveLength(2);
      expect(stressTest.robustness).toBeGreaterThanOrEqual(0);
      expect(stressTest.vulnerabilities).toBeDefined();
    });

    it("should provide statistics", async () => {
      twin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 20, humidity: 50 },
        devices: {},
        user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      });

      const scenario = twin.createScenario("Test", "Test", [], 30);
      await twin.runSimulation(scenario.id);

      const stats = twin.getStats();
      expect(stats.totalSimulations).toBe(1);
      expect(stats.avgExecutionTime).toBeGreaterThan(0);
    });
  });

  describe("Integration - All Modules", () => {
    it("should work together end-to-end", async () => {
      // Initialize all modules
      const modules = {
        contextEnricher: new ContextEnricher(),
        predictiveEngine: new PredictiveEngine(),
        reinforcementLearner: new ReinforcementLearner(),
        semanticMemory: new SemanticMemory(100, 64),
        multiModalProcessor: new MultiModalProcessor(),
      };

      const coordinator = new IntelligenceCoordinator(modules);
      const causalReasoner = new CausalReasoner();
      const digitalTwin = new DigitalTwin(causalReasoner, modules.predictiveEngine);

      // Step 1: Digital Twin simulation
      digitalTwin.syncState({
        location: "home",
        weather: { condition: "clear", temperature: 20, humidity: 50 },
        devices: {},
        user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      });

      const scenario = digitalTwin.createScenario("Test", "Test scenario", [], 30);
      const simulationResult = await digitalTwin.runSimulation(scenario.id);
      
      expect(simulationResult.outcomes.comfortScore).toBeGreaterThan(0);

      // Step 2: Record events in causal reasoner
      const eventId = causalReasoner.recordEvent({
        type: "coffee_made",
        timestamp: new Date(),
        variables: { intensity: 0.8 },
        outcome: 0.7,
      });

      expect(eventId).toBeDefined();

      // Step 3: Coordinator decision
      const decision = await coordinator.coordinate({
        userId: "user123",
        timestamp: new Date(),
      });

      expect(decision.decision).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);

      // Verify all modules contributed
      expect(decision.contributors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
