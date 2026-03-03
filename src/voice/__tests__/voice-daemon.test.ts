/**
 * Tests unitaires — VoiceDaemon + VoicePipeline (surface publique)
 * Couvre : construction, start/stop, dispatch, statut
 * Les dépendances réseau et audio sont toutes mockées.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { VoiceDaemonConfig, VoiceDaemonStatus } from "../voice-daemon.js";

// ─── Mocks système ────────────────────────────────────────────────────────────

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock AudioCapture — empêche tout accès réel au micro
vi.mock("../audio-capture.js", () => ({
  detectAudioTool: vi.fn().mockResolvedValue("sox"),
  AudioCapture: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    getState: vi.fn().mockReturnValue("idle"),
  })),
}));

// Mock VoicePipeline — contrôle total des événements
const mockPipelineEmitter = new Map<string, ((...args: unknown[]) => void)[]>();
const mockPipeline = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockReturnValue("idle"),
  getLastTranscription: vi.fn().mockReturnValue(undefined),
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    if (!mockPipelineEmitter.has(event)) mockPipelineEmitter.set(event, []);
    mockPipelineEmitter.get(event)!.push(cb);
  }),
  off: vi.fn(),
  emit: vi.fn((event: string, ...args: unknown[]) => {
    for (const cb of mockPipelineEmitter.get(event) ?? []) cb(...args);
  }),
  removeAllListeners: vi.fn(),
};

vi.mock("../voice-pipeline.js", () => ({
  VoicePipeline: vi.fn().mockImplementation(() => mockPipeline),
}));

// Mock MistralSTT — pas d'appel réseau
vi.mock("../mistral-stt-client.js", () => ({
  createMistralSTTClient: vi.fn().mockReturnValue({
    transcribe: vi.fn().mockResolvedValue({ text: "Jarvis, allume les lumières", language: "fr" }),
  }),
  MistralSTTClient: vi.fn(),
}));

// ─── Import après mocks ───────────────────────────────────────────────────────
const { VoiceDaemon } = await import("../voice-daemon.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDaemon(overrides: Partial<VoiceDaemonConfig> = {}) {
  const dispatchToJarvis = vi.fn().mockResolvedValue("Lumières allumées, Micka.");
  const speakResponse = vi.fn().mockResolvedValue(undefined);
  const daemon = new VoiceDaemon({
    enabled: true,
    dispatchToJarvis,
    speakResponse,
    voiceUserId: "voice-test",
    reconnectDelayMs: 100,
    maxReconnects: 0,
    ...overrides,
  });
  return { daemon, dispatchToJarvis, speakResponse };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("VoiceDaemon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipelineEmitter.clear();
  });

  afterEach(async () => {
    // Stopper tous les daemons
  });

  // ── Construction ──────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should instantiate without errors", () => {
      const { daemon } = makeDaemon();
      expect(daemon).toBeDefined();
    });

    it("should work with enabled=false (silent mode)", () => {
      const { daemon } = makeDaemon({ enabled: false });
      expect(daemon).toBeDefined();
    });

    it("should work without speakResponse (fallback to system TTS)", () => {
      const daemon = new VoiceDaemon({
        enabled: true,
        dispatchToJarvis: vi.fn().mockResolvedValue(null),
        speakResponse: null,
      });
      expect(daemon).toBeDefined();
    });
  });

  // ── getStatus avant start ──────────────────────────────────────────────────

  describe("getStatus before start", () => {
    it("should return running=false initially", () => {
      const { daemon } = makeDaemon();
      const status: VoiceDaemonStatus = daemon.getStatus();
      expect(status.running).toBe(false);
    });

    it("should return reconnectCount=0 initially", () => {
      const { daemon } = makeDaemon();
      expect(daemon.getStatus().reconnectCount).toBe(0);
    });
  });

  // ── start / stop ──────────────────────────────────────────────────────────

  describe("start", () => {
    it("should set running=true after start", async () => {
      const { daemon } = makeDaemon();
      await daemon.start();
      expect(daemon.getStatus().running).toBe(true);
    });

    it("should not start twice (idempotent)", async () => {
      const { daemon } = makeDaemon();
      await daemon.start();
      await daemon.start(); // deuxième start
      // mockPipeline.start ne doit être appelé qu'une seule fois
      expect(mockPipeline.start).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop", () => {
    it("should set running=false after stop", async () => {
      const { daemon } = makeDaemon();
      await daemon.start();
      await daemon.stop();
      expect(daemon.getStatus().running).toBe(false);
    });

    it("should not error when stopping a non-running daemon", async () => {
      const { daemon } = makeDaemon();
      await expect(daemon.stop()).resolves.toBeUndefined();
    });
  });

  // ── dispatch ──────────────────────────────────────────────────────────────

  describe("dispatchToJarvis", () => {
    it("should call dispatchToJarvis when transcription event fires", async () => {
      const { daemon, dispatchToJarvis } = makeDaemon();
      await daemon.start();

      // Simuler un événement de transcription du pipeline
      mockPipeline.emit("transcription", {
        text: "Jarvis, quelle heure est-il ?",
        userId: "voice-test",
      });

      // Attendre que le dispatch async se complète
      await new Promise((r) => setTimeout(r, 50));

      expect(dispatchToJarvis).toHaveBeenCalledWith(
        "Jarvis, quelle heure est-il ?",
        "voice-test"
      );
    });

    it("should call speakResponse with the Jarvis reply", async () => {
      const { daemon, speakResponse } = makeDaemon();
      await daemon.start();

      mockPipeline.emit("transcription", {
        text: "Allume le salon",
        userId: "voice-test",
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(speakResponse).toHaveBeenCalledWith("Lumières allumées, Micka.");
    });

    it("should not call speakResponse when Jarvis returns null", async () => {
      const { daemon, speakResponse } = makeDaemon({
        dispatchToJarvis: vi.fn().mockResolvedValue(null),
      });
      await daemon.start();

      mockPipeline.emit("transcription", { text: "commande inconnue", userId: "voice-test" });
      await new Promise((r) => setTimeout(r, 50));

      expect(speakResponse).not.toHaveBeenCalled();
    });
  });

  // ── getStatus ─────────────────────────────────────────────────────────────

  describe("getStatus", () => {
    it("should include pipelineState from the mock pipeline", async () => {
      const { daemon } = makeDaemon();
      await daemon.start();
      const status = daemon.getStatus();
      expect(status.pipelineState).toBeDefined();
    });

    it("should track lastTranscription after dispatch", async () => {
      const { daemon } = makeDaemon();
      await daemon.start();

      mockPipeline.emit("transcription", {
        text: "Test transcription",
        userId: "voice-test",
      });
      await new Promise((r) => setTimeout(r, 50));

      const status = daemon.getStatus();
      expect(status.lastTranscription).toBe("Test transcription");
    });
  });

  // ── Robustesse ────────────────────────────────────────────────────────────

  describe("robustness", () => {
    it("should handle dispatch errors gracefully", async () => {
      const { daemon } = makeDaemon({
        dispatchToJarvis: vi.fn().mockRejectedValue(new Error("Agent timeout")),
      });
      await daemon.start();

      // Ne doit pas lever d'erreur non gérée
      mockPipeline.emit("transcription", { text: "crash test", userId: "voice-test" });
      await new Promise((r) => setTimeout(r, 50));

      expect(daemon.getStatus().running).toBe(true);
    });

    it("should handle speakResponse errors gracefully", async () => {
      const { daemon } = makeDaemon({
        speakResponse: vi.fn().mockRejectedValue(new Error("TTS failure")),
      });
      await daemon.start();

      mockPipeline.emit("transcription", { text: "tts crash test", userId: "voice-test" });
      await new Promise((r) => setTimeout(r, 50));

      expect(daemon.getStatus().running).toBe(true);
    });
  });
});
