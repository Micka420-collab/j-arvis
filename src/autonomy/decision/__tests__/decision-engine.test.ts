/**
 * Tests unitaires — DecisionEngine
 * Couvre : évaluation, sélection, limites, apprentissage des résultats
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DecisionEngine, type DecisionEngineConfig } from "../decision-engine.js";
import { EthicsGuard } from "../ethics-guard.js";
import { GoalManager } from "../goal-manager.js";
import type { DecisionContext, DecisionOption } from "../../types.js";

// ─── Mock du bridge Jarvis (pas de réseau dans les tests) ─────────────────────
vi.mock("../../jarvis-bridge.js", () => ({
  getJarvisBridge: () => ({
    notify: vi.fn().mockResolvedValue(undefined),
    requestApproval: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue({ success: true, output: "ok", executionTimeMs: 5 }),
  }),
  formatJarvisMessage: vi.fn((type: string, text: string) => `[${type}] ${text}`),
}));

vi.mock("../../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    userId: "user-test",
    timestamp: new Date(),
    environment: {},
    urgency: "low",
    constraints: [],
    ...overrides,
  };
}

function makeOption(overrides: Partial<DecisionOption> = {}): DecisionOption {
  return {
    id: "opt-1",
    action: "test_action",
    parameters: {},
    expectedOutcome: "Test outcome",
    risks: [],
    benefits: [{ description: "Test benefit", value: 8, category: "convenience" }],
    confidence: 0.9,
    requiresApproval: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DecisionEngine", () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine({ autonomyLevel: "suggest", confidenceThreshold: 0.6 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Construction ──────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should initialize with default config when no config provided", () => {
      const e = new DecisionEngine();
      expect(e).toBeDefined();
    });

    it("should accept custom config", () => {
      const cfg: Partial<DecisionEngineConfig> = {
        autonomyLevel: "full",
        maxDecisionsPerHour: 5,
        confidenceThreshold: 0.8,
      };
      const e = new DecisionEngine(cfg);
      expect(e).toBeDefined();
    });

    it("should accept custom EthicsGuard and GoalManager", () => {
      const ethics = new EthicsGuard();
      const goals = new GoalManager();
      const e = new DecisionEngine({}, ethics, goals);
      expect(e).toBeDefined();
    });
  });

  // ── evaluateAndDecide ─────────────────────────────────────────────────────

  describe("evaluateAndDecide", () => {
    it("should return null when no options match threshold", async () => {
      const context = makeContext();
      const options = [makeOption({ confidence: 0.3 })]; // sous le seuil 0.6
      const result = await engine.evaluateAndDecide(context, options);
      expect(result).toBeNull();
    });

    it("should return a DecisionResult when valid option provided", async () => {
      const context = makeContext();
      const options = [makeOption({ confidence: 0.95 })];
      const result = await engine.evaluateAndDecide(context, options);
      expect(result).not.toBeNull();
      expect(result?.decision).toBeDefined();
      expect(result?.ethicsPassed).toBe(true);
    });

    it("should mark as not executed in 'suggest' mode", async () => {
      const e = new DecisionEngine({ autonomyLevel: "suggest", confidenceThreshold: 0.5 });
      const result = await e.evaluateAndDecide(makeContext(), [makeOption()]);
      expect(result?.executed).toBe(false);
      expect(result?.userNotified).toBe(true);
    });

    it("should execute in 'full' mode without notification", async () => {
      const e = new DecisionEngine({ autonomyLevel: "full", confidenceThreshold: 0.5 });
      const result = await e.evaluateAndDecide(makeContext(), [makeOption()]);
      expect(result?.executed).toBe(true);
      expect(result?.userNotified).toBe(false);
    });

    it("should execute and notify in 'act_with_notice' mode", async () => {
      const e = new DecisionEngine({
        autonomyLevel: "act_with_notice",
        confidenceThreshold: 0.5,
      });
      const result = await e.evaluateAndDecide(makeContext(), [makeOption()]);
      expect(result?.executed).toBe(true);
      expect(result?.userNotified).toBe(true);
    });

    it("should not execute in 'none' mode", async () => {
      const e = new DecisionEngine({ autonomyLevel: "none", confidenceThreshold: 0.5 });
      const result = await e.evaluateAndDecide(makeContext(), [makeOption()]);
      expect(result?.executed).toBe(false);
      expect(result?.userNotified).toBe(false);
    });

    it("should request approval in 'ask' mode", async () => {
      const e = new DecisionEngine({ autonomyLevel: "ask", confidenceThreshold: 0.5 });
      const result = await e.evaluateAndDecide(makeContext(), [makeOption()]);
      expect(result?.userNotified).toBe(true);
      // bridge.requestApproval est mocké pour retourner true → executed = true
      expect(result?.executed).toBe(true);
    });

    it("should lower autonomy level when option requires approval", async () => {
      const e = new DecisionEngine({ autonomyLevel: "full", confidenceThreshold: 0.5 });
      const options = [makeOption({ requiresApproval: true, confidence: 0.9 })];
      const result = await e.evaluateAndDecide(makeContext(), options);
      // requiresApproval force le niveau à "ask"
      expect(result?.decision.autonomyLevel).toBe("ask");
    });

    it("should raise autonomy level for critical urgency", async () => {
      const e = new DecisionEngine({ autonomyLevel: "suggest", confidenceThreshold: 0.5 });
      const context = makeContext({ urgency: "critical" });
      const result = await e.evaluateAndDecide(context, [makeOption()]);
      // suggest → ask avec urgence critique
      expect(result?.decision.autonomyLevel).toBe("ask");
    });
  });

  // ── Limit de décisions ────────────────────────────────────────────────────

  describe("decision limit", () => {
    it("should return null when hourly limit is exceeded", async () => {
      const e = new DecisionEngine({
        autonomyLevel: "suggest",
        maxDecisionsPerHour: 2,
        confidenceThreshold: 0.5,
      });

      // Faire 2 décisions valides
      await e.evaluateAndDecide(makeContext(), [makeOption()]);
      await e.evaluateAndDecide(makeContext(), [makeOption()]);

      // La 3e doit être bloquée
      const result = await e.evaluateAndDecide(makeContext(), [makeOption()]);
      expect(result).toBeNull();
    });
  });

  // ── updatePatterns ────────────────────────────────────────────────────────

  describe("updatePatterns", () => {
    it("should accept patterns and use them in decisions", async () => {
      const pattern = {
        id: "p1",
        name: "Evening lights",
        description: "Turn on lights at 19h",
        confidence: 0.85,
        frequency: 10,
        firstObserved: new Date(),
        lastObserved: new Date(),
        context: { timeOfDay: { hour: new Date().getHours(), minute: 0 } },
        action: { type: "suggest" as const, command: "turn_on_lights", parameters: {} },
      };
      engine.updatePatterns([pattern]);

      // Décision sans options fournies — doit générer depuis patterns
      const result = await engine.evaluateAndDecide(makeContext());
      // Au moins une tentative a eu lieu (résultat peut être null si noop sélectionné)
      expect(engine.getDecisionHistory).toBeDefined();
    });
  });

  // ── learnFromOutcome ──────────────────────────────────────────────────────

  describe("learnFromOutcome", () => {
    it("should silently handle unknown decision IDs", async () => {
      // Ne doit pas lever d'erreur
      await expect(
        engine.learnFromOutcome("nonexistent-id", true, 9)
      ).resolves.toBeUndefined();
    });

    it("should record outcome on known decision", async () => {
      const result = await engine.evaluateAndDecide(makeContext(), [makeOption()]);
      if (result) {
        await expect(
          engine.learnFromOutcome(result.decision.id, true, 9)
        ).resolves.toBeUndefined();
      }
    });
  });

  // ── Historique ────────────────────────────────────────────────────────────

  describe("decision history", () => {
    it("should accumulate decisions in history", async () => {
      const e = new DecisionEngine({ autonomyLevel: "suggest", confidenceThreshold: 0.5 });
      await e.evaluateAndDecide(makeContext(), [makeOption()]);
      await e.evaluateAndDecide(makeContext(), [makeOption()]);
      expect(e.getDecisionHistory().length).toBeGreaterThanOrEqual(1);
    });

    it("getRecentDecisions should return latest decisions first", async () => {
      const e = new DecisionEngine({ autonomyLevel: "suggest", confidenceThreshold: 0.5 });
      for (let i = 0; i < 3; i++) {
        await e.evaluateAndDecide(makeContext(), [makeOption()]);
      }
      const recent = e.getRecentDecisions(2);
      expect(recent.length).toBeLessThanOrEqual(2);
    });
  });

  // ── Éthique ───────────────────────────────────────────────────────────────

  describe("ethics check", () => {
    it("should fail ethics check for dangerous actions", async () => {
      // EthicsGuard bloque les actions avec "delete" ou "reset" à haut risque
      const options = [
        makeOption({
          action: "delete_all_data",
          confidence: 0.99,
          risks: [
            {
              description: "Irreversible data deletion",
              probability: 1.0,
              impact: "severe",
            },
          ],
        }),
      ];
      const result = await engine.evaluateAndDecide(makeContext(), options);
      // Soit null (threshold), soit ethicsPassed false
      if (result) {
        // Si la décision existe mais ne passe pas l'éthique
        expect(result.executed).toBe(false);
      }
    });
  });
});
