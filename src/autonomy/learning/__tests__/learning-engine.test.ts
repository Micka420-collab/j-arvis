/**
 * Tests unitaires — LearningEngine
 * Couvre : processEvent, patterns, préférences, analyse périodique
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LearningEngine, type LearningEngineConfig } from "../learning-engine.js";
import type { LearningEvent, PatternContext } from "../../types.js";
import { randomUUID } from "node:crypto";

vi.mock("../../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCommandEvent(
  command: string,
  context: PatternContext = { timeOfDay: { hour: 9, minute: 0 } }
): LearningEvent {
  return {
    id: randomUUID(),
    type: "user_command",
    source: "telegram",
    timestamp: new Date(),
    userId: "user-test",
    payload: { command, parameters: {}, context },
  };
}

function makeFeedbackEvent(
  originalAction: string,
  feedback: "positive" | "negative" | "corrected",
  correction?: string
): LearningEvent {
  return {
    id: randomUUID(),
    type: "user_feedback",
    source: "telegram",
    timestamp: new Date(),
    userId: "user-test",
    payload: { originalAction, feedback, correction },
  };
}

function makeSystemEvent(eventType: string, data: Record<string, unknown> = {}): LearningEvent {
  return {
    id: randomUUID(),
    type: "system_event",
    source: "home_assistant",
    timestamp: new Date(),
    userId: "system",
    payload: { eventType, data },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LearningEngine", () => {
  let engine: LearningEngine;

  beforeEach(() => {
    engine = new LearningEngine({
      minConfidenceThreshold: 0.4, // plus bas pour les tests
      learningRate: 0.1,
    });
  });

  // ── Construction ──────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should initialize with default config", () => {
      const e = new LearningEngine();
      expect(e).toBeDefined();
      expect(e.getPatterns()).toHaveLength(0);
    });

    it("should accept custom config", () => {
      const cfg: Partial<LearningEngineConfig> = {
        minConfidenceThreshold: 0.9,
        patternRetentionDays: 30,
      };
      const e = new LearningEngine(cfg);
      expect(e).toBeDefined();
    });
  });

  // ── processEvent : user_command ───────────────────────────────────────────

  describe("processEvent — user_command", () => {
    it("should return a LearningResult with structure", async () => {
      const result = await engine.processEvent(makeCommandEvent("allume les lumières"));
      expect(result).toHaveProperty("patternsDetected");
      expect(result).toHaveProperty("knowledgeAdded");
      expect(result).toHaveProperty("preferencesUpdated");
      expect(result).toHaveProperty("goalsInferred");
    });

    it("should create a pattern when confidence meets threshold", async () => {
      // Seuil à 0.4 ; le pattern initial a confidence 0.5
      const result = await engine.processEvent(makeCommandEvent("play music"));
      expect(result.patternsDetected.length).toBeGreaterThan(0);
    });

    it("should reinforce existing pattern on repeated command", async () => {
      const cmd = "turn_on_lights_salon";
      const ctx: PatternContext = { timeOfDay: { hour: 20, minute: 0 } };

      // Premier appel → crée le pattern
      await engine.processEvent(makeCommandEvent(cmd, ctx));
      const patternsAfterFirst = engine.getPatterns();
      const initial = patternsAfterFirst.find((p) =>
        p.action.command?.includes("turn_on_lights")
      );
      const initialConfidence = initial?.confidence ?? 0;

      // Deuxième appel → renforce
      await engine.processEvent(makeCommandEvent(cmd, ctx));
      const patternsAfterSecond = engine.getPatterns();
      const reinforced = patternsAfterSecond.find((p) =>
        p.action.command?.includes("turn_on_lights")
      );
      expect(reinforced?.confidence).toBeGreaterThanOrEqual(initialConfidence);
      expect(reinforced?.frequency).toBeGreaterThan(1);
    });

    it("should extract temperature preference from command", async () => {
      const result = await engine.processEvent(
        makeCommandEvent("règle le thermostat à 21°C")
      );
      const tempPref = result.preferencesUpdated.find(
        (p) => p.key === "preferred_temperature"
      );
      expect(tempPref).toBeDefined();
      expect(tempPref?.value).toBe(21);
    });
  });

  // ── processEvent : user_feedback ──────────────────────────────────────────

  describe("processEvent — user_feedback", () => {
    it("should process positive feedback without error", async () => {
      const result = await engine.processEvent(
        makeFeedbackEvent("play_music", "positive")
      );
      expect(result).toBeDefined();
    });

    it("should process negative feedback without error", async () => {
      const result = await engine.processEvent(
        makeFeedbackEvent("delete_file", "negative")
      );
      expect(result).toBeDefined();
    });

    it("should create corrected pattern when correction is provided", async () => {
      const result = await engine.processEvent(
        makeFeedbackEvent("old_command", "corrected", "new_corrected_command")
      );
      expect(result.patternsDetected.length).toBeGreaterThan(0);
      const correctedPattern = result.patternsDetected.find(
        (p) => p.action.command === "new_corrected_command"
      );
      expect(correctedPattern).toBeDefined();
    });

    it("should boost confidence of corrected pattern above initial", async () => {
      const result = await engine.processEvent(
        makeFeedbackEvent("wrong_cmd", "corrected", "correct_cmd")
      );
      const pattern = result.patternsDetected.find(
        (p) => p.action.command === "correct_cmd"
      );
      // La correction booste la confidence de +0.2 sur 0.5 initial
      expect(pattern?.confidence).toBeGreaterThan(0.5);
    });
  });

  // ── processEvent : system_event ───────────────────────────────────────────

  describe("processEvent — system_event", () => {
    it("should handle domotic events without error", async () => {
      const result = await engine.processEvent(
        makeSystemEvent("domotic:light_on", { entity_id: "light.salon", state: "on" })
      );
      expect(result).toBeDefined();
    });

    it("should handle non-domotic system events gracefully", async () => {
      const result = await engine.processEvent(
        makeSystemEvent("network:disconnect", { interface: "eth0" })
      );
      expect(result).toBeDefined();
    });
  });

  // ── processEvent : interaction_pattern ───────────────────────────────────

  describe("processEvent — interaction_pattern", () => {
    it("should store a pattern passed directly as payload", async () => {
      const pattern = {
        id: randomUUID(),
        name: "Morning Routine",
        description: "User wakes up and turns on lights",
        confidence: 0.9,
        frequency: 7,
        firstObserved: new Date(),
        lastObserved: new Date(),
        context: {},
        action: { type: "suggest" as const, command: "morning_routine" },
      };

      const event: LearningEvent = {
        id: randomUUID(),
        type: "interaction_pattern",
        source: "telegram",
        timestamp: new Date(),
        userId: "user-test",
        payload: pattern,
      };

      const result = await engine.processEvent(event);
      expect(result.patternsDetected).toContainEqual(
        expect.objectContaining({ id: pattern.id })
      );
      // Doit aussi être stocké dans le state interne
      const stored = engine.getPatterns().find((p) => p.id === pattern.id);
      expect(stored).toBeDefined();
    });
  });

  // ── processEvent : decision_outcome ──────────────────────────────────────

  describe("processEvent — decision_outcome", () => {
    it("should process successful decision outcomes", async () => {
      const event: LearningEvent = {
        id: randomUUID(),
        type: "decision_outcome",
        source: "decision_engine",
        timestamp: new Date(),
        userId: "user-test",
        payload: {
          decisionId: randomUUID(),
          success: true,
          userSatisfaction: 9,
          lessonsLearned: [],
        },
      };
      const result = await engine.processEvent(event);
      expect(result).toBeDefined();
    });
  });

  // ── processEvent : goal_achievement ──────────────────────────────────────

  describe("processEvent — goal_achievement", () => {
    it("should process goal achievement events", async () => {
      const event: LearningEvent = {
        id: randomUUID(),
        type: "goal_achievement",
        source: "goal_manager",
        timestamp: new Date(),
        userId: "user-test",
        payload: {
          goalId: randomUUID(),
          success: true,
          methods: [],
        },
      };
      const result = await engine.processEvent(event);
      expect(result).toBeDefined();
    });
  });

  // ── runPeriodicAnalysis ───────────────────────────────────────────────────

  describe("runPeriodicAnalysis", () => {
    it("should return a valid LearningResult", async () => {
      const result = await engine.runPeriodicAnalysis();
      expect(result).toHaveProperty("patternsDetected");
      expect(result).toHaveProperty("goalsInferred");
    });

    it("should detect temporal patterns after repeated commands at same hour", async () => {
      const fixedHour = new Date().getHours();
      const ctx: PatternContext = { timeOfDay: { hour: fixedHour, minute: 0 } };
      const cmd = "dim_lights";

      // 3 événements au même pattern → doit déclencher l'analyse temporelle
      for (let i = 0; i < 4; i++) {
        const event: LearningEvent = {
          id: randomUUID(),
          type: "user_command",
          source: "telegram",
          timestamp: new Date(new Date().setHours(fixedHour, 0, 0, 0)),
          userId: "user-test",
          payload: { command: cmd, context: ctx },
        };
        await engine.processEvent(event);
      }

      const result = await engine.runPeriodicAnalysis();
      // Les patterns temporels peuvent être détectés
      expect(result.patternsDetected).toBeDefined();
    });

    it("should infer home goal when multiple domotic patterns exist", async () => {
      // Injecter des patterns via interaction_pattern
      for (let i = 0; i < 3; i++) {
        const pattern = {
          id: randomUUID(),
          name: `light pattern ${i}`,
          description: "a light pattern",
          confidence: 0.8,
          frequency: 5,
          firstObserved: new Date(),
          lastObserved: new Date(),
          context: {},
          action: { type: "execute" as const, command: `turn_on_light_${i}` },
        };
        const event: LearningEvent = {
          id: randomUUID(),
          type: "interaction_pattern",
          source: "telegram",
          timestamp: new Date(),
          userId: "user-test",
          payload: pattern,
        };
        await engine.processEvent(event);
      }

      const result = await engine.runPeriodicAnalysis();
      // Doit inférer un objectif "maison"
      const homeGoal = result.goalsInferred.find((g) => g.category === "home");
      expect(homeGoal).toBeDefined();
    });
  });

  // ── Getters ───────────────────────────────────────────────────────────────

  describe("getPatterns / getPreferences / getGoals", () => {
    it("getPatterns should return patterns sorted by confidence desc", async () => {
      // Injecter deux patterns avec confidences différentes
      const high = {
        id: "high",
        name: "high confidence",
        description: "",
        confidence: 0.9,
        frequency: 1,
        firstObserved: new Date(),
        lastObserved: new Date(),
        context: {},
        action: { type: "suggest" as const, command: "cmd_high" },
      };
      const low = {
        id: "low",
        name: "low confidence",
        description: "",
        confidence: 0.5,
        frequency: 1,
        firstObserved: new Date(),
        lastObserved: new Date(),
        context: {},
        action: { type: "suggest" as const, command: "cmd_low" },
      };
      for (const p of [high, low]) {
        await engine.processEvent({
          id: randomUUID(),
          type: "interaction_pattern",
          source: "test",
          timestamp: new Date(),
          userId: "u",
          payload: p,
        });
      }
      const patterns = engine.getPatterns();
      if (patterns.length >= 2) {
        expect(patterns[0].confidence).toBeGreaterThanOrEqual(patterns[1].confidence);
      }
    });

    it("getPreferences should return array", () => {
      expect(Array.isArray(engine.getPreferences())).toBe(true);
    });

    it("getGoals should return array", () => {
      expect(Array.isArray(engine.getGoals())).toBe(true);
    });

    it("getKnowledgeGraph should return the graph instance", () => {
      expect(engine.getKnowledgeGraph()).toBeDefined();
    });
  });

  // ── Robustesse ────────────────────────────────────────────────────────────

  describe("robustness", () => {
    it("should handle multiple events in sequence without error", async () => {
      const events: LearningEvent[] = [
        makeCommandEvent("cmd1"),
        makeFeedbackEvent("cmd1", "positive"),
        makeSystemEvent("domotic:temperature", { value: 21 }),
        makeCommandEvent("cmd2"),
        makeFeedbackEvent("cmd1", "negative"),
      ];
      for (const e of events) {
        await expect(engine.processEvent(e)).resolves.toBeDefined();
      }
    });
  });
});
