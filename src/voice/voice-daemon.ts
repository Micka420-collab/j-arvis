/**
 * Voice Daemon — Service vocal persistant pour Jarvis
 *
 * Daemon qui tourne en arrière-plan et gère :
 * - L'écoute continue des micros à domicile
 * - L'intégration avec le pipeline Jarvis (gateway + agents)
 * - Le TTS des réponses via les providers configurés
 * - La reconnexion automatique en cas d'erreur
 *
 * Utilisation :
 *   import { VoiceDaemon } from "./voice/voice-daemon.js";
 *   const daemon = new VoiceDaemon(config);
 *   await daemon.start();
 */

import { EventEmitter } from "node:events";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { VoicePipeline, type VoicePipelineConfig, type TranscriptionContext } from "./voice-pipeline.js";
import { detectAudioTool } from "./audio-capture.js";

const log = createSubsystemLogger("voice:daemon");

// ============================================================================
// Types
// ============================================================================

export type VoiceDaemonConfig = {
  /** Activé ou non (défaut: false — opt-in) */
  enabled?: boolean;
  /** Configuration du pipeline vocal */
  pipeline?: VoicePipelineConfig;
  /**
   * Fonction de dispatch vers l'agent Jarvis.
   * Reçoit la commande transcrite, retourne la réponse texte.
   */
  dispatchToJarvis: (command: string, userId?: string) => Promise<string | null>;
  /**
   * Fonction TTS — synthétise le texte en audio et le joue.
   * Si null, utilise le TTS système (say/espeak).
   */
  speakResponse?: ((text: string) => Promise<void>) | null;
  /** ID utilisateur pour le contexte des messages (défaut: "voice") */
  voiceUserId?: string;
  /** Délai de reconnexion en ms si erreur (défaut: 5 000) */
  reconnectDelayMs?: number;
  /** Nombre max de reconnexions (défaut: -1 = infini) */
  maxReconnects?: number;
};

export type VoiceDaemonStatus = {
  running: boolean;
  pipelineState: string;
  reconnectCount: number;
  lastTranscription?: string;
  lastResponseAt?: Date;
  toolAvailable?: string;
};

// ============================================================================
// Daemon
// ============================================================================

export class VoiceDaemon extends EventEmitter {
  private config: Required<VoiceDaemonConfig>;
  private pipeline: VoicePipeline | null = null;
  private isRunning = false;
  private reconnectCount = 0;
  private lastTranscription?: string;
  private lastResponseAt?: Date;

  constructor(config: VoiceDaemonConfig) {
    super();

    this.config = {
      enabled: false,
      pipeline: {},
      voiceUserId: "voice",
      reconnectDelayMs: 5_000,
      maxReconnects: -1,
      speakResponse: null,
      ...config,
    };
  }

  // ─── Cycle de vie ──────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (!this.config.enabled) {
      log.info("VoiceDaemon désactivé (enabled: false) — ignoré");
      return;
    }

    if (this.isRunning) {
      log.warn("VoiceDaemon déjà en cours d'exécution");
      return;
    }

    log.info("VoiceDaemon démarrage...");

    // Vérifier les prérequis
    const tool = await detectAudioTool();
    if (!tool) {
      log.error(
        "VoiceDaemon: impossible de démarrer — aucun outil audio détecté.\n" +
        "  → Linux  : sudo apt install sox\n" +
        "  → macOS  : brew install sox\n" +
        "  → Alternative : installer arecord (paquet alsa-utils) ou ffmpeg"
      );
      this.emit("error", new Error("Aucun outil audio"));
      return;
    }

    if (!process.env.MISTRAL_API_KEY && !process.env.MISTRAL_STT_API_KEY) {
      log.error(
        "VoiceDaemon: MISTRAL_API_KEY non configurée.\n" +
        "  → Ajoutez MISTRAL_API_KEY dans ~/.openclaw/.env\n" +
        "  → Obtenez une clé sur https://console.mistral.ai"
      );
      this.emit("error", new Error("MISTRAL_API_KEY manquante"));
      return;
    }

    this.isRunning = true;
    this.reconnectCount = 0;

    await this.launchPipeline();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pipeline) {
      await this.pipeline.stop();
      this.pipeline = null;
    }
    log.info("VoiceDaemon arrêté — À bientôt, Monsieur.");
    this.emit("stopped");
  }

  getStatus(): VoiceDaemonStatus {
    return {
      running: this.isRunning,
      pipelineState: this.pipeline?.getState() ?? "idle",
      reconnectCount: this.reconnectCount,
      lastTranscription: this.lastTranscription,
      lastResponseAt: this.lastResponseAt,
    };
  }

  // ─── Pipeline ──────────────────────────────────────────────────────────────

  private async launchPipeline(): Promise<void> {
    try {
      this.pipeline = new VoicePipeline({
        ...this.config.pipeline,
        mode: this.config.pipeline?.mode ?? "wake_word",
        wakeWords: this.config.pipeline?.wakeWords ?? ["jarvis", "hey jarvis", "allo jarvis"],
        language: this.config.pipeline?.language ?? "fr",

        // Handler de transcription → dispatch Jarvis
        onTranscription: async (command: string, ctx: TranscriptionContext) => {
          log.info(`Commande vocale: "${command}"`);
          this.lastTranscription = command;
          this.emit("command", command, ctx);

          try {
            const response = await this.config.dispatchToJarvis(
              command,
              this.config.voiceUserId
            );

            if (response) {
              this.lastResponseAt = new Date();
              this.emit("response", response);
              log.info(`Réponse Jarvis: "${response.slice(0, 80)}"`);
            }

            return response;
          } catch (err) {
            log.error(`Erreur dispatch Jarvis: ${String(err)}`);
            return "Désolé, Monsieur, je rencontre une difficulté technique.";
          }
        },

        // Handler TTS — utilise la fonction fournie, sinon ElevenLabs → TTS système
        onSpeak: this.config.speakResponse
          ? this.config.speakResponse
          : async (text: string) => {
              await this.speakWithBestTTS(text);
            },

        onStateChange: (state) => {
          log.info(`Pipeline vocal: ${state}`);
          this.emit("state", state);
        },
      });

      // Events de monitoring
      this.pipeline.on("transcription", (ctx: TranscriptionContext) => {
        this.emit("transcription", ctx);
      });

      this.pipeline.on("error", async (err: Error) => {
        log.error(`Erreur pipeline: ${err.message}`);
        await this.handlePipelineError(err);
      });

      await this.pipeline.start();
    } catch (err) {
      log.error(`Impossible de lancer le pipeline vocal: ${String(err)}`);
      await this.handlePipelineError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async handlePipelineError(err: Error): Promise<void> {
    this.pipeline = null;
    this.emit("pipeline_error", err);

    if (!this.isRunning) return;

    // Reconnexion automatique
    const maxReconnects = this.config.maxReconnects;
    if (maxReconnects !== -1 && this.reconnectCount >= maxReconnects) {
      log.error(`Nombre max de reconnexions atteint (${maxReconnects}) — abandon`);
      this.isRunning = false;
      this.emit("fatal", err);
      return;
    }

    this.reconnectCount++;
    log.warn(`Reconnexion vocale #${this.reconnectCount} dans ${this.config.reconnectDelayMs}ms...`);

    await sleep(this.config.reconnectDelayMs);

    if (this.isRunning) {
      await this.launchPipeline();
    }
  }

  // ─── TTS — ElevenLabs (priorité) + fallback système ─────────────────────

  /**
   * Synthétise le texte en audio avec ElevenLabs si configuré,
   * sinon utilise le TTS système (say / espeak-ng / PowerShell).
   *
   * Pipeline TTS :
   *   1. ElevenLabs API (ELEVENLABS_API_KEY ou XI_API_KEY) → mp3 → play
   *   2. Sinon : say (macOS) | espeak-ng (Linux) | PowerShell SAPI (Windows)
   */
  async speakWithBestTTS(text: string): Promise<void> {
    const cleanText = this.cleanTextForTTS(text);
    if (!cleanText) return;

    // Tentative ElevenLabs
    const xiApiKey = process.env.ELEVENLABS_API_KEY ?? process.env.XI_API_KEY;
    if (xiApiKey) {
      try {
        await this.speakWithElevenLabs(cleanText, xiApiKey);
        return;
      } catch (err) {
        log.warn(`[TTS] ElevenLabs échoué, fallback système: ${String(err)}`);
      }
    }

    // Fallback TTS système
    await this.speakWithSystemTTS(cleanText);
  }

  /**
   * ElevenLabs TTS via l'API REST (v1/text-to-speech/{voiceId}/stream)
   * Joue l'audio via un player système (mpg123 / afplay / ffplay)
   */
  private async speakWithElevenLabs(text: string, apiKey: string): Promise<void> {
    const voiceId = process.env.ELEVENLABS_VOICE_ID ?? process.env.JARVIS_ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB"; // "Adam" par défaut
    const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2"; // Multilingue (FR/EN)
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
          speed: 1.0,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`ElevenLabs ${response.status}: ${errBody}`);
    }

    // Écrire l'audio dans un fichier temporaire puis le jouer
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { writeFile, unlink } = await import("node:fs/promises");
    const { spawn } = await import("node:child_process");

    const tmpPath = join(tmpdir(), `jarvis-tts-${Date.now()}.mp3`);

    try {
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      await writeFile(tmpPath, audioBuffer);

      // Player selon plateforme
      await new Promise<void>((resolve, reject) => {
        let player: string;
        let args: string[];

        if (process.platform === "darwin") {
          player = "afplay";
          args = [tmpPath];
        } else {
          // Linux : essaie mpg123 puis ffplay
          player = "mpg123";
          args = ["-q", tmpPath];
        }

        const proc = spawn(player, args, { stdio: "ignore" });
        proc.on("close", (code) => {
          if (code !== 0 && player === "mpg123") {
            // Fallback ffplay
            const ff = spawn("ffplay", ["-nodisp", "-autoexit", tmpPath], { stdio: "ignore" });
            ff.on("close", () => resolve());
            ff.on("error", () => resolve()); // Silencieux si indisponible
          } else {
            resolve();
          }
        });
        proc.on("error", () => {
          if (player === "mpg123") {
            const ff = spawn("ffplay", ["-nodisp", "-autoexit", tmpPath], { stdio: "ignore" });
            ff.on("close", () => resolve());
            ff.on("error", reject);
          } else {
            reject(new Error(`Player ${player} non disponible`));
          }
        });
      });
    } finally {
      // Nettoyer le fichier temporaire
      await unlink(tmpPath).catch(() => {/* ignore */});
    }

    log.info("[TTS] ElevenLabs — réponse vocale jouée");
  }

  // ─── TTS système fallback ─────────────────────────────────────────────────

  /** Nettoie le texte pour la synthèse vocale */
  private cleanTextForTTS(text: string): string {
    return text
      .replace(/[*_~`#>\[\]]/g, "")     // Markdown
      .replace(/https?:\/\/\S+/g, "")   // URLs
      .replace(/:[a-z_]+:/g, "")        // Emojis texte :emoji:
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
  }

  private async speakWithSystemTTS(text: string): Promise<void> {
    if (!text) return;

    const { spawn } = await import("node:child_process");

    return new Promise((resolve) => {
      let proc;

      if (process.platform === "darwin") {
        // macOS — commande `say` native
        const voice = process.env.JARVIS_TTS_VOICE ?? "Thomas"; // Voix française
        proc = spawn("say", ["-v", voice, text], { stdio: "ignore" });
      } else if (process.platform === "linux") {
        // Linux — espeak-ng (français)
        const voice = process.env.JARVIS_TTS_VOICE ?? "fr+m3"; // Voix masculine française
        proc = spawn("espeak-ng", ["-v", voice, text], { stdio: "ignore" });
      } else {
        // Windows — PowerShell SAPI
        proc = spawn("powershell", [
          "-Command",
          `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${text.replace(/'/g, "''")}')`,
        ], { stdio: "ignore" });
      }

      if (!proc) {
        resolve();
        return;
      }

      proc.on("close", () => resolve());
      proc.on("error", (err) => {
        log.warn(`TTS système échoué: ${err.message}`);
        resolve();
      });
    });
  }
}

// ============================================================================
// Factory — intégration avec AutonomyGatewayIntegration
// ============================================================================

/**
 * Crée un VoiceDaemon intégré au gateway Jarvis
 * À appeler depuis gateway-integration.ts ou le point d'entrée du daemon
 */
export function createVoiceDaemon(params: {
  dispatchToJarvis: (command: string, userId?: string) => Promise<string | null>;
  speakResponse?: (text: string) => Promise<void>;
  enabled?: boolean;
  ownerUserId?: string;
  wakeWords?: string[];
  captureDevice?: string;
}): VoiceDaemon {
  return new VoiceDaemon({
    enabled: params.enabled ?? false,
    voiceUserId: params.ownerUserId ?? "voice",
    dispatchToJarvis: params.dispatchToJarvis,
    speakResponse: params.speakResponse ?? null,
    reconnectDelayMs: 5_000,
    maxReconnects: -1, // Reconnexion infinie

    pipeline: {
      mode: "wake_word",
      wakeWords: params.wakeWords ?? ["jarvis", "hey jarvis"],
      language: "fr",
      ttsEnabled: true,
      capture: {
        device: params.captureDevice ?? "",
        sampleRate: 16_000,
        channels: 1,
        maxDurationSec: 30,
        silenceThresholdDb: -35,
        silenceDurationSec: 1.5,
      },
      stt: {
        model: "mistral-stt",
        language: "fr",
        prompt:
          "Jarvis, assistant IA domotique. Commandes vocales en français. " +
          "Termes: lumière, thermostat, alarme, minuterie, rappel, musique, météo, " +
          "volume, chauffage, volets, caméra, sécurité.",
      },
    },
  });
}

// ============================================================================
// Utilitaire
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
