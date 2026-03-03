/**
 * Voice Pipeline — Pipeline vocal complet pour Jarvis
 *
 * Orchestre :
 *   Micro → [Capture audio] → [Mistral STT] → [Agent Jarvis] → [TTS] → Haut-parleur
 *
 * Supporte :
 * - Mode wake word : écoute en continu, réagit à "Jarvis"
 * - Mode push-to-talk : activation manuelle
 * - Mode always-on : écoute et transcrit tout
 */

import { unlinkSync, existsSync } from "node:fs";
import { EventEmitter } from "node:events";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { AudioCapture, type AudioCaptureConfig, detectAudioTool } from "./audio-capture.js";
import {
  MistralSTTClient,
  createMistralSTTClient,
  type MistralSTTConfig,
} from "./mistral-stt-client.js";

const log = createSubsystemLogger("voice:pipeline");

// ============================================================================
// Types
// ============================================================================

export type VoicePipelineMode = "wake_word" | "push_to_talk" | "always_on";

export type VoicePipelineConfig = {
  /** Mode de déclenchement (défaut: wake_word) */
  mode?: VoicePipelineMode;
  /** Mot(s) déclencheur(s) (défaut: ["jarvis"]) */
  wakeWords?: string[];
  /** Configuration Mistral STT */
  stt?: Partial<MistralSTTConfig>;
  /** Configuration capture audio */
  capture?: AudioCaptureConfig;
  /** Activer les réponses vocales TTS (défaut: true) */
  ttsEnabled?: boolean;
  /** Langue (défaut: "fr") */
  language?: string;
  /** Délai max d'attente d'une réponse agent en ms (défaut: 30 000) */
  agentTimeoutMs?: number;
  /** Callback de dispatch vers l'agent Jarvis */
  onTranscription?: (text: string, context: TranscriptionContext) => Promise<string | null>;
  /** Callback de réponse TTS */
  onSpeak?: (text: string) => Promise<void>;
  /** Callback d'état */
  onStateChange?: (state: VoicePipelineState) => void;
};

export type VoicePipelineState =
  | "idle"       // En attente du wake word
  | "listening"  // Écoute active après wake word
  | "processing" // Transcription en cours (Mistral)
  | "thinking"   // Agent Jarvis traite la requête
  | "speaking"   // TTS répond
  | "error";     // Erreur

export type TranscriptionContext = {
  /** Texte transcrit brut */
  rawText: string;
  /** Si le wake word a été détecté dans la transcription */
  wakeWordDetected: boolean;
  /** Wake word détecté */
  detectedWakeWord?: string;
  /** Commande sans le wake word */
  command: string;
  /** Timestamp de la capture */
  capturedAt: Date;
  /** Durée de la capture audio */
  audioDurationSec?: number;
};

// ============================================================================
// Pipeline
// ============================================================================

export class VoicePipeline extends EventEmitter {
  private config: Required<VoicePipelineConfig>;
  private capture: AudioCapture;
  private sttClient: MistralSTTClient | null;
  private state: VoicePipelineState = "idle";
  private isRunning = false;
  private stopSignal = false;

  constructor(config: VoicePipelineConfig = {}) {
    super();

    this.config = {
      mode: "wake_word",
      wakeWords: ["jarvis"],
      stt: {},
      capture: {},
      ttsEnabled: true,
      language: "fr",
      agentTimeoutMs: 30_000,
      onTranscription: async (_text, ctx) => {
        log.info(`[Pipeline] Transcription reçue: "${ctx.command}" (pas de handler agent configuré)`);
        return null;
      },
      onSpeak: async (text) => {
        log.info(`[Pipeline] TTS: "${text.slice(0, 80)}" (pas de handler TTS configuré)`);
      },
      onStateChange: (state) => {
        log.info(`[Pipeline] État: ${state}`);
      },
      ...config,
    };

    this.capture = new AudioCapture(this.config.capture);
    this.sttClient = createMistralSTTClient(this.config.stt as MistralSTTConfig);
  }

  // ─── Cycle de vie ──────────────────────────────────────────────────────────

  /**
   * Démarre le pipeline vocal
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    const tool = await detectAudioTool();
    if (!tool) {
      throw new Error(
        "Impossible de démarrer le module vocal : aucun outil audio disponible.\n" +
        "Installez sox : brew install sox (macOS) | apt install sox (Linux)"
      );
    }

    if (!this.sttClient) {
      throw new Error(
        "Impossible de démarrer le module vocal : MISTRAL_API_KEY non configurée.\n" +
        "Ajoutez MISTRAL_API_KEY dans ~/.openclaw/.env"
      );
    }

    this.isRunning = true;
    this.stopSignal = false;

    log.info(`VoicePipeline démarré — mode: ${this.config.mode}, wake words: [${this.config.wakeWords.join(", ")}]`);
    this.emit("started");

    // Annonce vocale de démarrage
    await this.speak("Système vocal activé. Je vous écoute, Monsieur.");

    await this.runLoop();
  }

  /**
   * Arrête le pipeline
   */
  async stop(): Promise<void> {
    this.stopSignal = true;
    this.capture.cancel();
    this.isRunning = false;
    this.setState("idle");
    log.info("VoicePipeline arrêté");
    this.emit("stopped");
  }

  /**
   * Déclenche manuellement une écoute (mode push-to-talk)
   */
  async triggerListen(): Promise<void> {
    if (!this.isRunning) return;
    await this.runListenCycle();
  }

  // ─── Boucle principale ────────────────────────────────────────────────────

  private async runLoop(): Promise<void> {
    while (this.isRunning && !this.stopSignal) {
      try {
        await this.runListenCycle();

        // Pause courte entre les cycles
        if (!this.stopSignal) {
          await sleep(500);
        }
      } catch (err) {
        log.error(`Erreur dans la boucle vocale: ${String(err)}`);
        this.setState("error");
        await sleep(2000); // Attendre avant de relancer
        if (!this.stopSignal) this.setState("idle");
      }
    }
  }

  private async runListenCycle(): Promise<void> {
    // ── Étape 1 : Capture audio ──────────────────────────────────────────
    this.setState("listening");

    const captureResult = await this.capture.captureUntilSilence();

    if (!captureResult.success) {
      log.warn(`Capture audio échouée: ${captureResult.error.message}`);
      this.setState("idle");
      return;
    }

    const audioFile = captureResult.result.filePath;

    // ── Étape 2 : Transcription Mistral STT ──────────────────────────────
    this.setState("processing");

    const transcription = await this.sttClient!.transcribeFile(audioFile);

    // Nettoyage fichier audio
    try {
      if (existsSync(audioFile)) unlinkSync(audioFile);
    } catch { /* ignore */ }

    if (!transcription.success) {
      if (transcription.error.code !== "no_audio") {
        log.warn(`STT échoué: ${transcription.error.message}`);
      }
      this.setState("idle");
      return;
    }

    const rawText = transcription.result.text;
    log.info(`STT: "${rawText}"`);

    // ── Étape 3 : Détection wake word + extraction commande ──────────────
    const wakeWordResult = this.detectWakeWord(rawText);

    if (this.config.mode === "wake_word" && !wakeWordResult.detected) {
      // Pas de wake word en mode wake_word → ignorer
      log.info(`Pas de wake word dans: "${rawText.slice(0, 60)}" — ignoré`);
      this.setState("idle");
      return;
    }

    const command = wakeWordResult.command.trim() || rawText.trim();

    if (!command) {
      this.setState("idle");
      return;
    }

    const context: TranscriptionContext = {
      rawText,
      wakeWordDetected: wakeWordResult.detected,
      detectedWakeWord: wakeWordResult.word,
      command,
      capturedAt: new Date(),
      audioDurationSec: captureResult.result.durationSec,
    };

    this.emit("transcription", context);

    // ── Étape 4 : Dispatch vers l'agent Jarvis ───────────────────────────
    this.setState("thinking");

    const responseText = await this.runWithTimeout(
      this.config.onTranscription(command, context),
      this.config.agentTimeoutMs,
      null
    );

    // ── Étape 5 : Réponse TTS ────────────────────────────────────────────
    if (responseText && this.config.ttsEnabled) {
      this.setState("speaking");
      await this.speak(responseText);
    }

    this.setState("idle");
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private detectWakeWord(text: string): {
    detected: boolean;
    word?: string;
    command: string;
  } {
    const lower = text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

    for (const wakeWord of this.config.wakeWords) {
      const wakeNorm = wakeWord.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

      // Cherche le wake word dans le texte
      const idx = lower.indexOf(wakeNorm);
      if (idx !== -1) {
        // Extrait la commande après le wake word
        const afterWake = text.slice(idx + wakeWord.length).trim();
        // Supprime la ponctuation de début
        const command = afterWake.replace(/^[,;:.!?\s]+/, "").trim();

        return { detected: true, word: wakeWord, command };
      }
    }

    return { detected: false, command: text };
  }

  private async speak(text: string): Promise<void> {
    try {
      await this.config.onSpeak(text);
      this.emit("spoke", text);
    } catch (err) {
      log.warn(`TTS échoué: ${String(err)}`);
    }
  }

  private setState(newState: VoicePipelineState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.config.onStateChange(newState);
      this.emit("state", newState);
    }
  }

  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
  ): Promise<T> {
    return Promise.race([
      promise,
      sleep(timeoutMs).then(() => fallback),
    ]);
  }

  getState(): VoicePipelineState { return this.state; }
  isActive(): boolean { return this.isRunning; }
}

// ============================================================================
// Utilitaire
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
