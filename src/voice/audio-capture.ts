/**
 * Audio Capture — Enregistrement depuis les micros locaux
 *
 * Capture l'audio des microphones à domicile via sox, arecord ou ffmpeg.
 * Détecte automatiquement l'outil disponible sur le système.
 *
 * Modes supportés :
 * - Enregistrement ponctuel (durée fixe)
 * - Enregistrement par détection de silence (VAD — Voice Activity Detection)
 * - Streaming continu (pour la détection de wake word)
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("voice:capture");

// ============================================================================
// Types
// ============================================================================

export type AudioCaptureConfig = {
  /** Dispositif microphone (défaut: microphone par défaut du système) */
  device?: string;
  /** Taux d'échantillonnage en Hz (défaut: 16000) */
  sampleRate?: number;
  /** Nombre de canaux (défaut: 1 — mono) */
  channels?: number;
  /** Durée max d'enregistrement en secondes (défaut: 30) */
  maxDurationSec?: number;
  /** Seuil de silence pour arrêter l'enregistrement (dBFS, défaut: -40) */
  silenceThresholdDb?: number;
  /** Durée de silence avant arrêt en secondes (défaut: 1.5) */
  silenceDurationSec?: number;
  /** Répertoire de sortie pour les fichiers audio temp (défaut: tmpdir) */
  outputDir?: string;
};

export type CaptureResult = {
  /** Chemin vers le fichier audio capturé */
  filePath: string;
  /** Durée en secondes */
  durationSec: number;
  /** Outil utilisé pour la capture */
  capturedBy: "sox" | "arecord" | "ffmpeg";
};

export type CaptureError = {
  code: "no_tool" | "device_error" | "timeout" | "cancelled" | "unknown";
  message: string;
};

export type CaptureResponse =
  | { success: true; result: CaptureResult }
  | { success: false; error: CaptureError };

// ============================================================================
// Détection des outils disponibles
// ============================================================================

type AudioTool = "sox" | "arecord" | "ffmpeg" | null;

let _cachedAudioTool: AudioTool | undefined;

async function detectAudioTool(): Promise<AudioTool> {
  if (_cachedAudioTool !== undefined) return _cachedAudioTool;

  const tools: Array<"sox" | "arecord" | "ffmpeg"> = ["sox", "arecord", "ffmpeg"];

  for (const tool of tools) {
    const available = await checkCommand(tool);
    if (available) {
      log.info(`Outil audio détecté: ${tool}`);
      _cachedAudioTool = tool;
      return tool;
    }
  }

  log.error(
    "Aucun outil d'enregistrement audio trouvé. " +
    "Installez sox (recommandé), arecord (Linux) ou ffmpeg."
  );
  _cachedAudioTool = null;
  return null;
}

function checkCommand(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("which", [cmd], { stdio: "ignore" });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

// ============================================================================
// Capture principale
// ============================================================================

export class AudioCapture {
  private config: Required<AudioCaptureConfig>;
  private activeProcess: ChildProcess | null = null;

  constructor(config: AudioCaptureConfig = {}) {
    this.config = {
      device: config.device ?? "",
      sampleRate: config.sampleRate ?? 16_000,
      channels: config.channels ?? 1,
      maxDurationSec: config.maxDurationSec ?? 30,
      silenceThresholdDb: config.silenceThresholdDb ?? -40,
      silenceDurationSec: config.silenceDurationSec ?? 1.5,
      outputDir: config.outputDir ?? join(tmpdir(), "jarvis-voice"),
    };

    // Créer le répertoire de sortie
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Enregistre audio jusqu'à détection de silence ou durée max
   * Mode principal pour la reconnaissance vocale après wake word
   */
  async captureUntilSilence(): Promise<CaptureResponse> {
    const tool = await detectAudioTool();
    if (!tool) {
      return {
        success: false,
        error: {
          code: "no_tool",
          message: "Aucun outil audio disponible (sox, arecord ou ffmpeg requis)",
        },
      };
    }

    const outFile = join(
      this.config.outputDir,
      `capture_${Date.now()}.wav`
    );

    const startTime = Date.now();

    try {
      let captureResult: CaptureResponse;

      switch (tool) {
        case "sox":
          captureResult = await this.captureWithSox(outFile);
          break;
        case "arecord":
          captureResult = await this.captureWithArecord(outFile);
          break;
        case "ffmpeg":
          captureResult = await this.captureWithFfmpeg(outFile);
          break;
      }

      if (!captureResult.success) return captureResult;

      const durationSec = (Date.now() - startTime) / 1000;
      return {
        success: true,
        result: { ...captureResult.result, durationSec, capturedBy: tool },
      };
    } catch (err) {
      return { success: false, error: { code: "unknown", message: String(err) } };
    }
  }

  /**
   * Enregistrement de durée fixe (pour test ou mode push-to-talk)
   */
  async captureFixed(durationSec: number): Promise<CaptureResponse> {
    const tool = await detectAudioTool();
    if (!tool) {
      return {
        success: false,
        error: { code: "no_tool", message: "Aucun outil audio disponible" },
      };
    }

    const outFile = join(this.config.outputDir, `capture_fixed_${Date.now()}.wav`);

    try {
      return await this.captureWithDuration(tool, outFile, durationSec);
    } catch (err) {
      return { success: false, error: { code: "unknown", message: String(err) } };
    }
  }

  /**
   * Annule la capture en cours
   */
  cancel(): void {
    if (this.activeProcess) {
      this.activeProcess.kill("SIGINT");
      this.activeProcess = null;
      log.info("Capture audio annulée");
    }
  }

  // ─── Sox (recommandé — meilleure VAD) ────────────────────────────────────

  private captureWithSox(outFile: string): Promise<CaptureResponse> {
    return new Promise((resolve) => {
      const args = [
        ...(this.config.device ? ["-t", "alsa", this.config.device] : ["-d"]),
        "-r", String(this.config.sampleRate),
        "-c", String(this.config.channels),
        "-b", "16",
        outFile,
        // VAD (Voice Activity Detection) — arrêt automatique sur silence
        "silence",
        "1", "0.1", `${Math.abs(this.config.silenceThresholdDb)}d`, // début après 0.1s de son
        "1", String(this.config.silenceDurationSec), `${Math.abs(this.config.silenceThresholdDb)}d`, // fin après silence
        // Durée maximale
        "trim", "0", String(this.config.maxDurationSec),
      ];

      log.info(`SOX capture: sox ${args.join(" ")}`);

      const proc = spawn("sox", args, { stdio: ["ignore", "pipe", "pipe"] });
      this.activeProcess = proc;

      const timeoutTimer = setTimeout(() => {
        proc.kill("SIGINT");
        resolve({
          success: true,
          result: { filePath: outFile, durationSec: this.config.maxDurationSec, capturedBy: "sox" },
        });
      }, (this.config.maxDurationSec + 5) * 1000);

      proc.on("close", (code) => {
        clearTimeout(timeoutTimer);
        this.activeProcess = null;

        if (code === 0 || code === 2 /* SIGINT = normal sox exit */) {
          resolve({
            success: true,
            result: { filePath: outFile, durationSec: 0, capturedBy: "sox" },
          });
        } else {
          resolve({ success: false, error: { code: "device_error", message: `sox exit ${code}` } });
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timeoutTimer);
        this.activeProcess = null;
        resolve({ success: false, error: { code: "device_error", message: err.message } });
      });
    });
  }

  // ─── arecord (Linux ALSA) ────────────────────────────────────────────────

  private captureWithArecord(outFile: string): Promise<CaptureResponse> {
    return new Promise((resolve) => {
      const deviceArgs = this.config.device ? ["-D", this.config.device] : [];
      const args = [
        ...deviceArgs,
        "-f", "S16_LE",
        "-r", String(this.config.sampleRate),
        "-c", String(this.config.channels),
        "-d", String(this.config.maxDurationSec),
        outFile,
      ];

      log.info(`arecord capture: arecord ${args.join(" ")}`);

      const proc = spawn("arecord", args, { stdio: ["ignore", "pipe", "pipe"] });
      this.activeProcess = proc;

      // arecord n'a pas de VAD — on écoute pendant maxDurationSec
      proc.on("close", (code) => {
        this.activeProcess = null;
        if (code === 0 || code === 1) {
          resolve({
            success: true,
            result: { filePath: outFile, durationSec: this.config.maxDurationSec, capturedBy: "arecord" },
          });
        } else {
          resolve({ success: false, error: { code: "device_error", message: `arecord exit ${code}` } });
        }
      });

      proc.on("error", (err) => {
        this.activeProcess = null;
        resolve({ success: false, error: { code: "device_error", message: err.message } });
      });
    });
  }

  // ─── FFmpeg ───────────────────────────────────────────────────────────────

  private captureWithFfmpeg(outFile: string): Promise<CaptureResponse> {
    return new Promise((resolve) => {
      const inputDevice = this.config.device
        ? ["-i", this.config.device]
        : ["-f", process.platform === "darwin" ? "avfoundation" : "alsa", "-i", "default"];

      const args = [
        ...inputDevice,
        "-ar", String(this.config.sampleRate),
        "-ac", String(this.config.channels),
        "-t", String(this.config.maxDurationSec),
        "-y", // overwrite output
        outFile,
      ];

      log.info(`ffmpeg capture: ffmpeg ${args.join(" ")}`);

      const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
      this.activeProcess = proc;

      proc.on("close", (code) => {
        this.activeProcess = null;
        if (code === 0) {
          resolve({
            success: true,
            result: { filePath: outFile, durationSec: this.config.maxDurationSec, capturedBy: "ffmpeg" },
          });
        } else {
          resolve({ success: false, error: { code: "device_error", message: `ffmpeg exit ${code}` } });
        }
      });

      proc.on("error", (err) => {
        this.activeProcess = null;
        resolve({ success: false, error: { code: "device_error", message: err.message } });
      });
    });
  }

  private captureWithDuration(
    tool: "sox" | "arecord" | "ffmpeg",
    outFile: string,
    durationSec: number
  ): Promise<CaptureResponse> {
    // Sauvegarde config et force durée fixe
    const savedMax = this.config.maxDurationSec;
    this.config.maxDurationSec = durationSec;

    let capture: Promise<CaptureResponse>;
    switch (tool) {
      case "sox":    capture = this.captureWithSox(outFile);    break;
      case "arecord": capture = this.captureWithArecord(outFile); break;
      case "ffmpeg": capture = this.captureWithFfmpeg(outFile); break;
    }

    return capture.finally(() => {
      this.config.maxDurationSec = savedMax;
    });
  }
}

// ============================================================================
// Utilitaires exports
// ============================================================================

export { detectAudioTool };

/**
 * Liste les dispositifs audio disponibles sur le système
 */
export async function listAudioDevices(): Promise<string[]> {
  const tool = await detectAudioTool();
  if (!tool) return [];

  return new Promise((resolve) => {
    let cmd: string;
    let args: string[];

    switch (tool) {
      case "sox":
        cmd = "sox";
        args = ["--version"]; // On utilisera aplay/arecord -l à la place
        break;
      case "arecord":
        cmd = "arecord";
        args = ["-l"];
        break;
      case "ffmpeg":
        cmd = "ffmpeg";
        args = ["-f", "alsa", "-list_devices", "true", "-i", "dummy"];
        break;
      default:
        return resolve([]);
    }

    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const output: string[] = [];

    proc.stdout?.on("data", (d: Buffer) => output.push(d.toString()));
    proc.stderr?.on("data", (d: Buffer) => output.push(d.toString()));
    proc.on("close", () => resolve(output));
    proc.on("error", () => resolve([]));
  });
}
