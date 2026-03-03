/**
 * Mistral STT Client — Transcription vocale via l'API Mistral
 *
 * Utilise l'endpoint compatible Whisper de Mistral AI pour transcrire
 * l'audio capturé par les microphones locaux.
 *
 * API : https://api.mistral.ai/v1/audio/transcriptions
 * Modèle : mistral-stt (ou voix-latest)
 */

import { createReadStream, statSync } from "node:fs";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("voice:mistral-stt");

// ============================================================================
// Types
// ============================================================================

export type MistralSTTConfig = {
  /** Clé API Mistral */
  apiKey: string;
  /** Modèle STT Mistral (défaut : "mistral-stt") */
  model?: string;
  /** Langue principale (défaut : "fr") */
  language?: string;
  /** URL de base de l'API (défaut : "https://api.mistral.ai/v1") */
  baseUrl?: string;
  /** Timeout en ms (défaut : 30 000) */
  timeoutMs?: number;
  /** Prompt de contexte pour améliorer la précision */
  prompt?: string;
};

export type TranscriptionResult = {
  /** Texte transcrit */
  text: string;
  /** Langue détectée */
  language?: string;
  /** Durée audio en secondes */
  duration?: number;
  /** Confiance (0-1) si disponible */
  confidence?: number;
};

export type TranscriptionError = {
  code: "no_audio" | "api_error" | "timeout" | "auth_error" | "file_too_large" | "unknown";
  message: string;
};

export type TranscriptionResponse =
  | { success: true; result: TranscriptionResult }
  | { success: false; error: TranscriptionError };

// ============================================================================
// Constantes
// ============================================================================

const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";
const DEFAULT_MODEL = "mistral-stt";
const DEFAULT_LANGUAGE = "fr";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — limite Mistral

// Prompt de contexte par défaut pour Jarvis
const DEFAULT_JARVIS_PROMPT =
  "Jarvis, assistant IA domotique. Commandes vocales en français. " +
  "Termes: lumière, thermostat, alarme, minuterie, rappel, musique, météo.";

// ============================================================================
// Client Mistral STT
// ============================================================================

export class MistralSTTClient {
  private config: Required<MistralSTTConfig>;

  constructor(config: MistralSTTConfig) {
    this.config = {
      model: DEFAULT_MODEL,
      language: DEFAULT_LANGUAGE,
      baseUrl: DEFAULT_BASE_URL,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      prompt: DEFAULT_JARVIS_PROMPT,
      ...config,
    };
  }

  /**
   * Transcrit un fichier audio en texte via l'API Mistral
   * @param audioFilePath Chemin vers le fichier audio (.wav, .mp3, .m4a, .ogg, .flac)
   */
  async transcribeFile(audioFilePath: string): Promise<TranscriptionResponse> {
    // Vérifier la taille du fichier
    try {
      const stat = statSync(audioFilePath);
      if (stat.size === 0) {
        return { success: false, error: { code: "no_audio", message: "Fichier audio vide" } };
      }
      if (stat.size > MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          error: {
            code: "file_too_large",
            message: `Fichier trop grand (${Math.round(stat.size / 1024 / 1024)}MB > 25MB)`,
          },
        };
      }
    } catch {
      return {
        success: false,
        error: { code: "unknown", message: `Fichier introuvable: ${audioFilePath}` },
      };
    }

    log.info(`Transcription: ${audioFilePath} → Mistral ${this.config.model}`);

    try {
      // Construire le FormData avec le fichier audio
      const formData = new FormData();

      // Lire le fichier comme Blob
      const fileContent = await this.readFileAsBlob(audioFilePath);
      const filename = audioFilePath.split("/").pop() ?? "audio.wav";
      formData.append("file", fileContent, filename);
      formData.append("model", this.config.model);
      formData.append("language", this.config.language);
      formData.append("response_format", "json");
      if (this.config.prompt) {
        formData.append("prompt", this.config.prompt);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(`${this.config.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          // Content-Type est défini automatiquement par FormData (multipart/form-data)
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 401) {
        return {
          success: false,
          error: { code: "auth_error", message: "Clé API Mistral invalide (401)" },
        };
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return {
          success: false,
          error: {
            code: "api_error",
            message: `Mistral API ${response.status}: ${errorText.slice(0, 200)}`,
          },
        };
      }

      const data = (await response.json()) as {
        text: string;
        language?: string;
        duration?: number;
      };

      const text = (data.text ?? "").trim();

      if (!text) {
        return { success: false, error: { code: "no_audio", message: "Aucun texte détecté" } };
      }

      log.info(`Transcription OK: "${text.slice(0, 80)}..."`);

      return {
        success: true,
        result: {
          text,
          language: data.language ?? this.config.language,
          duration: data.duration,
        },
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: { code: "timeout", message: "Timeout de transcription" } };
      }
      return {
        success: false,
        error: { code: "unknown", message: String(err) },
      };
    }
  }

  /**
   * Transcrit depuis un buffer audio (pratique pour la capture en temps réel)
   */
  async transcribeBuffer(
    audioBuffer: Buffer,
    filename = "capture.wav"
  ): Promise<TranscriptionResponse> {
    const { writeFileSync, mkdtempSync, unlinkSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");

    const tmpDir = mkdtempSync(join(tmpdir(), "jarvis-stt-"));
    const tmpFile = join(tmpDir, filename);

    try {
      writeFileSync(tmpFile, audioBuffer);
      return await this.transcribeFile(tmpFile);
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  private async readFileAsBlob(filePath: string): Promise<Blob> {
    const { readFileSync } = await import("node:fs");
    const buffer = readFileSync(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "wav";
    const mimeType = AUDIO_MIME_TYPES[ext] ?? "audio/wav";
    return new Blob([buffer], { type: mimeType });
  }
}

// ============================================================================
// Mapping MIME types audio
// ============================================================================

const AUDIO_MIME_TYPES: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  flac: "audio/flac",
  webm: "audio/webm",
  opus: "audio/opus",
  aac: "audio/aac",
};

// ============================================================================
// Factory — créé depuis la config Jarvis
// ============================================================================

/**
 * Crée un client STT Mistral depuis les variables d'environnement / config
 */
export function createMistralSTTClient(
  overrides?: Partial<MistralSTTConfig>
): MistralSTTClient | null {
  const apiKey =
    overrides?.apiKey ??
    process.env.MISTRAL_API_KEY ??
    process.env.MISTRAL_STT_API_KEY;

  if (!apiKey) {
    log.warn(
      "MistralSTT: MISTRAL_API_KEY non configurée — STT non disponible. " +
      "Ajoutez MISTRAL_API_KEY dans votre .env ou ~/.openclaw/.env"
    );
    return null;
  }

  return new MistralSTTClient({
    apiKey,
    model: process.env.MISTRAL_STT_MODEL ?? "mistral-stt",
    language: process.env.MISTRAL_STT_LANGUAGE ?? "fr",
    baseUrl: process.env.MISTRAL_API_BASE_URL ?? DEFAULT_BASE_URL,
    ...overrides,
  });
}
