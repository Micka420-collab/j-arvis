/**
 * Wake Word Detector — Détection du mot déclencheur pour Jarvis
 *
 * Deux modes supportés :
 *
 * 1. **Picovoice Porcupine** (recommandé) — détection locale précise.
 *    Requiert : `@picovoice/porcupine-node` + clé API Picovoice.
 *    Avantage : fonctionne entièrement offline, très faible CPU.
 *
 * 2. **Fallback keyword** — simple correspondance de chaîne sur la transcription.
 *    Utilisé automatiquement si Porcupine n'est pas installé.
 *    Aucune dépendance externe.
 *
 * Usage :
 *   const detector = await WakeWordDetector.create({
 *     keywords: ["jarvis", "hey jarvis"],
 *     picovoiceApiKey: process.env.PICOVOICE_API_KEY,
 *   });
 *   detector.on("wake", (keyword) => console.log(`Wake word detected: ${keyword}`));
 *   await detector.start();
 */

import { EventEmitter } from "node:events";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("voice:wake-word");

// ============================================================================
// Types
// ============================================================================

export type WakeWordConfig = {
  /**
   * Mots / phrases déclencheurs (en minuscules).
   * Ex : ["jarvis", "hey jarvis", "ok jarvis"]
   */
  keywords: string[];

  /**
   * Clé API Picovoice AccessKey.
   * Obtenable gratuitement sur https://console.picovoice.ai/
   * Si absent, bascule sur le mode fallback keyword.
   */
  picovoiceApiKey?: string;

  /**
   * Chemins vers les fichiers modèles .ppn Picovoice personnalisés.
   * Si non fourni, utilise les mots-clés intégrés (en anglais uniquement).
   * Pour français, fournir un modèle custom : https://picovoice.ai/docs/porcupine/
   */
  porcupineModelPaths?: string[];

  /**
   * Sensibilité de détection Picovoice (0.0-1.0).
   * Plus haut = plus sensible mais plus de faux positifs.
   * Défaut : 0.5
   */
  sensitivity?: number;

  /**
   * Index du périphérique microphone (-1 = par défaut).
   * Défaut : -1
   */
  micDeviceIndex?: number;

  /**
   * Mode fallback : vérifier si la transcription Whisper contient un des keywords.
   * Actif automatiquement si Picovoice absent.
   */
  fallbackMode?: "substring" | "word_boundary" | "fuzzy";

  /**
   * Langue pour la normalisation des mots-clés.
   * Défaut : "fr"
   */
  language?: string;
};

export type WakeWordEvent = {
  keyword: string;
  confidence?: number;
  mode: "porcupine" | "fallback";
  timestamp: Date;
};

type WakeWordDetectorEvents = {
  wake: [event: WakeWordEvent];
  error: [error: Error];
  ready: [];
  stopped: [];
};

// ============================================================================
// Detecteur principal
// ============================================================================

export class WakeWordDetector extends EventEmitter<WakeWordDetectorEvents> {
  private config: Required<
    Pick<WakeWordConfig, "keywords" | "sensitivity" | "fallbackMode" | "language" | "micDeviceIndex">
  > &
    Pick<WakeWordConfig, "picovoiceApiKey" | "porcupineModelPaths">;

  private mode: "porcupine" | "fallback" = "fallback";
  private running = false;

  // Porcupine instance (lazy-loaded)
  private porcupine: {
    process: (frame: Int16Array) => number;
    release: () => void;
    frameLength: number;
    sampleRate: number;
  } | null = null;

  // Recorder audio pour Porcupine (PvRecorder)
  private recorder: {
    start: () => void;
    stop: () => void;
    read: () => Int16Array;
    isRecording: boolean;
    release: () => void;
  } | null = null;

  private constructor(config: WakeWordConfig) {
    super();
    this.config = {
      keywords: config.keywords.map((k) => k.toLowerCase().trim()),
      picovoiceApiKey: config.picovoiceApiKey,
      porcupineModelPaths: config.porcupineModelPaths,
      sensitivity: config.sensitivity ?? 0.5,
      micDeviceIndex: config.micDeviceIndex ?? -1,
      fallbackMode: config.fallbackMode ?? "word_boundary",
      language: config.language ?? "fr",
    };
  }

  // ── Création ──────────────────────────────────────────────────────────────

  /**
   * Crée et initialise le détecteur.
   * Tente Porcupine en premier, bascule sur fallback si indisponible.
   */
  static async create(config: WakeWordConfig): Promise<WakeWordDetector> {
    const detector = new WakeWordDetector(config);

    if (config.picovoiceApiKey) {
      const ok = await detector.tryInitPorcupine();
      if (ok) {
        detector.mode = "porcupine";
        log.info("Wake word detector: Porcupine mode ready");
      } else {
        log.warn("Porcupine init failed — using fallback keyword mode");
        detector.mode = "fallback";
      }
    } else {
      log.info("Wake word detector: fallback keyword mode (no Picovoice key)");
      detector.mode = "fallback";
    }

    return detector;
  }

  // ── Porcupine init ────────────────────────────────────────────────────────

  private async tryInitPorcupine(): Promise<boolean> {
    try {
      // Import dynamique — optionnel
      const { Porcupine, BuiltinKeyword } = await import(
        "@picovoice/porcupine-node" as string
      ) as {
        Porcupine: {
          new (
            apiKey: string,
            keywords: unknown[],
            sensitivities: number[],
            modelPath?: string
          ): {
            process: (frame: Int16Array) => number;
            release: () => void;
            frameLength: number;
            sampleRate: number;
          };
        };
        BuiltinKeyword: Record<string, unknown>;
      };

      const { PvRecorder } = await import("@picovoice/pvrecorder-node" as string) as {
        PvRecorder: {
          new (
            deviceIndex: number,
            frameLength: number
          ): {
            start: () => void;
            stop: () => void;
            read: () => Int16Array;
            isRecording: boolean;
            release: () => void;
          };
        };
      };

      // Mapper les keywords vers les enums Porcupine intégrés ou des modèles custom
      const picoKeywords = this.resolvePorcupineKeywords(BuiltinKeyword);
      const sensitivities = picoKeywords.map(() => this.config.sensitivity);

      this.porcupine = new Porcupine(
        this.config.picovoiceApiKey!,
        picoKeywords,
        sensitivities
      );

      this.recorder = new PvRecorder(
        this.config.micDeviceIndex,
        this.porcupine.frameLength
      );

      return true;
    } catch (err) {
      log.debug(`Porcupine not available: ${String(err)}`);
      return false;
    }
  }

  private resolvePorcupineKeywords(
    BuiltinKeyword: Record<string, unknown>
  ): unknown[] {
    const keywords: unknown[] = [];

    for (const kw of this.config.keywords) {
      // Porcupine propose des keywords intégrés (en anglais)
      const normalized = kw.replace(/\s+/g, "_").toUpperCase();

      if (this.config.porcupineModelPaths?.length) {
        // Utiliser les modèles custom (.ppn files)
        keywords.push(this.config.porcupineModelPaths[0]);
      } else if (BuiltinKeyword[normalized] !== undefined) {
        // Keyword intégré (ex: JARVIS, COMPUTER, ALEXA...)
        keywords.push(BuiltinKeyword[normalized]);
      } else {
        // Fallback sur le keyword "JARVIS" si disponible, sinon "COMPUTER"
        const fallback = BuiltinKeyword["JARVIS"] ?? BuiltinKeyword["COMPUTER"];
        if (fallback !== undefined) {
          keywords.push(fallback);
          log.warn(`No Porcupine model for "${kw}" — using built-in fallback`);
        }
      }
    }

    // Si aucun keyword résolu, utiliser "JARVIS" ou "COMPUTER" par défaut
    if (keywords.length === 0) {
      const fallback = BuiltinKeyword["JARVIS"] ?? BuiltinKeyword["COMPUTER"];
      if (fallback !== undefined) keywords.push(fallback);
    }

    return keywords;
  }

  // ── Démarrage / Arrêt ─────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    if (this.mode === "porcupine" && this.porcupine && this.recorder) {
      await this.startPorcupineLoop();
    } else {
      // Mode fallback : on attend les appels à checkTranscription()
      log.info("Wake word detector started in fallback mode — call checkTranscription() with transcribed text");
    }

    this.emit("ready");
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.recorder) {
      try {
        this.recorder.stop();
      } catch { /* ignore */ }
    }

    if (this.porcupine) {
      try {
        this.porcupine.release();
      } catch { /* ignore */ }
      this.porcupine = null;
    }

    if (this.recorder) {
      try {
        this.recorder.release();
      } catch { /* ignore */ }
      this.recorder = null;
    }

    this.emit("stopped");
    log.info("Wake word detector stopped");
  }

  // ── Boucle Porcupine ──────────────────────────────────────────────────────

  private async startPorcupineLoop(): Promise<void> {
    const porcupine = this.porcupine!;
    const recorder = this.recorder!;

    recorder.start();
    log.info("Porcupine wake word detection started — listening...");

    const loop = async () => {
      while (this.running) {
        try {
          const frame = recorder.read();
          const keywordIndex = porcupine.process(frame);

          if (keywordIndex >= 0) {
            const detectedKeyword = this.config.keywords[keywordIndex] ?? this.config.keywords[0];
            const event: WakeWordEvent = {
              keyword: detectedKeyword,
              confidence: this.config.sensitivity,
              mode: "porcupine",
              timestamp: new Date(),
            };
            log.info(`Wake word detected (Porcupine): "${detectedKeyword}"`);
            this.emit("wake", event);
          }
        } catch (err) {
          if (this.running) {
            log.warn(`Porcupine processing error: ${String(err)}`);
            this.emit("error", err instanceof Error ? err : new Error(String(err)));
          }
          break;
        }

        // Yield pour ne pas bloquer la boucle d'événements Node
        await new Promise((r) => setImmediate(r));
      }
    };

    loop().catch((err) => {
      log.error(`Porcupine loop crashed: ${String(err)}`);
      this.emit("error", err);
    });
  }

  // ── Mode fallback ─────────────────────────────────────────────────────────

  /**
   * Vérifie si une transcription contient un wake word (mode fallback).
   * À appeler depuis la VoicePipeline après chaque transcription Mistral.
   *
   * @returns Le keyword détecté ou null
   */
  checkTranscription(transcription: string): WakeWordEvent | null {
    const normalized = transcription.toLowerCase().trim();

    for (const keyword of this.config.keywords) {
      let found = false;

      switch (this.config.fallbackMode) {
        case "substring":
          found = normalized.includes(keyword);
          break;

        case "word_boundary": {
          // Vérifier que le mot est isolé (pas "jarvistest")
          const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$|[,.!?])`, "i");
          found = regex.test(normalized);
          break;
        }

        case "fuzzy": {
          // Correspondance approximative simple (Levenshtein léger)
          found = normalized.includes(keyword) || this.fuzzyMatch(normalized, keyword);
          break;
        }
      }

      if (found) {
        const event: WakeWordEvent = {
          keyword,
          confidence: 1.0,
          mode: "fallback",
          timestamp: new Date(),
        };
        this.emit("wake", event);
        return event;
      }
    }

    return null;
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  private fuzzyMatch(text: string, keyword: string): boolean {
    // Tolérance d'1 caractère pour les mots courts, 2 pour les longs
    const maxDist = keyword.length <= 4 ? 1 : 2;
    const words = text.split(/\s+/);
    for (const word of words) {
      if (this.levenshtein(word, keyword) <= maxDist) return true;
    }
    return false;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  // ── Getters publics ───────────────────────────────────────────────────────

  getMode(): "porcupine" | "fallback" {
    return this.mode;
  }

  isRunning(): boolean {
    return this.running;
  }

  getKeywords(): string[] {
    return [...this.config.keywords];
  }
}
