/**
 * LanceDB Adapter — Mémoire vectorielle long-terme pour le LearningEngine
 *
 * Connecte le LearningEngine à l'extension memory-lancedb d'OpenClaw.
 * Permet la persistance des patterns appris entre les sessions.
 *
 * Architecture :
 *   LearningEngine  →  LanceDBAdapter  →  LanceDB (via extension memory-lancedb)
 *
 * Usage :
 *   const adapter = await LanceDBAdapter.create({ dbPath, embeddingApiKey });
 *   const engine  = new PersistentLearningEngine({}, adapter);
 *   await engine.loadFromVectorStore();  // charge les patterns existants
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { LearnedPattern } from "../types.js";

const log = createSubsystemLogger("autonomy:lancedb-adapter");

// ============================================================================
// Types
// ============================================================================

export type LanceDBAdapterConfig = {
  /** Chemin vers la base LanceDB (défaut : ~/.openclaw/memory/jarvis-patterns) */
  dbPath?: string;
  /** Clé API OpenAI pour les embeddings (ou modèle local compatible) */
  embeddingApiKey?: string;
  /** Base URL de l'API d'embeddings (défaut : api.openai.com) */
  embeddingBaseUrl?: string;
  /** Modèle d'embedding (défaut : text-embedding-3-small) */
  embeddingModel?: string;
  /** Nombre de dimensions des vecteurs (défaut : 1536) */
  vectorDimensions?: number;
  /** Score minimum de similarité pour les recherches (0-1, défaut : 0.5) */
  minSearchScore?: number;
};

export type VectorizedPattern = {
  id: string;
  name: string;
  description: string;
  confidence: number;
  frequency: number;
  category: string;
  actionCommand?: string;
  actionType: string;
  contextHour?: number;
  firstObserved: number;   // timestamp ms
  lastObserved: number;    // timestamp ms
  serialized: string;      // JSON complet du pattern
};

export type VectorSearchResult = {
  pattern: VectorizedPattern;
  score: number;
};

// ============================================================================
// Embedding minimal (sans dépendance directe à openai SDK)
// ============================================================================

async function fetchEmbedding(
  text: string,
  apiKey: string,
  model: string,
  baseUrl: string
): Promise<number[] | null> {
  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: text }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      log.warn(`Embedding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    log.warn(`Embedding fetch failed: ${String(err)}`);
    return null;
  }
}

// ============================================================================
// Adaptateur principal
// ============================================================================

export class LanceDBAdapter {
  private db: import("@lancedb/lancedb").Connection | null = null;
  private table: import("@lancedb/lancedb").Table | null = null;
  private initPromise: Promise<void> | null = null;
  private available = false; // false si LanceDB n'est pas installé

  private readonly dbPath: string;
  private readonly embeddingApiKey: string;
  private readonly embeddingModel: string;
  private readonly embeddingBaseUrl: string;
  private readonly vectorDim: number;
  private readonly minScore: number;

  static readonly TABLE_NAME = "jarvis_patterns";

  constructor(config: LanceDBAdapterConfig = {}) {
    this.dbPath = config.dbPath
      ?? join(homedir(), ".openclaw", "memory", "jarvis-patterns");
    this.embeddingApiKey = config.embeddingApiKey
      ?? process.env.OPENAI_API_KEY
      ?? process.env.JARVIS_EMBEDDING_API_KEY
      ?? "";
    this.embeddingModel = config.embeddingModel ?? "text-embedding-3-small";
    this.embeddingBaseUrl = config.embeddingBaseUrl ?? "https://api.openai.com/v1";
    this.vectorDim = config.vectorDimensions ?? 1536;
    this.minScore = config.minSearchScore ?? 0.5;
  }

  /**
   * Crée et initialise l'adaptateur.
   * Retourne null si LanceDB n'est pas disponible (mode dégradé gracieux).
   */
  static async create(config: LanceDBAdapterConfig = {}): Promise<LanceDBAdapter | null> {
    const adapter = new LanceDBAdapter(config);
    try {
      await adapter.init();
      if (!adapter.available) {
        log.warn("LanceDB not available — patterns will be in-memory only");
        return null;
      }
      log.info(`LanceDB adapter ready (db: ${adapter.dbPath})`);
      return adapter;
    } catch (err) {
      log.warn(`LanceDB adapter init failed: ${String(err)} — in-memory fallback`);
      return null;
    }
  }

  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    let lancedb: typeof import("@lancedb/lancedb");
    try {
      lancedb = await import("@lancedb/lancedb");
    } catch {
      this.available = false;
      return;
    }

    this.db = await lancedb.connect(this.dbPath);
    const tables = await this.db.tableNames();

    if (tables.includes(LanceDBAdapter.TABLE_NAME)) {
      this.table = await this.db.openTable(LanceDBAdapter.TABLE_NAME);
    } else {
      // Créer la table avec un schéma vide
      this.table = await this.db.createTable(LanceDBAdapter.TABLE_NAME, [
        {
          id: "__schema__",
          name: "",
          description: "",
          confidence: 0,
          frequency: 0,
          category: "other",
          actionCommand: "",
          actionType: "suggest",
          contextHour: -1,
          firstObserved: 0,
          lastObserved: 0,
          serialized: "{}",
          vector: Array.from({ length: this.vectorDim }).fill(0),
        },
      ]);
      await this.table.delete('id = "__schema__"');
    }

    this.available = true;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  /**
   * Stocke un pattern appris dans LanceDB.
   * Génère un vecteur sémantique à partir du nom + description.
   */
  async storePattern(pattern: LearnedPattern): Promise<boolean> {
    if (!this.available || !this.table) return false;
    if (!this.embeddingApiKey) {
      log.debug("No embedding API key — pattern not vectorized");
      return false;
    }

    try {
      const textToEmbed = `${pattern.name}. ${pattern.description}. ${pattern.action.command ?? ""}`;
      const vector = await fetchEmbedding(
        textToEmbed,
        this.embeddingApiKey,
        this.embeddingModel,
        this.embeddingBaseUrl
      );

      if (!vector) return false;

      const row: VectorizedPattern & { vector: number[] } = {
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        confidence: pattern.confidence,
        frequency: pattern.frequency,
        category: "pattern",
        actionCommand: pattern.action.command,
        actionType: pattern.action.type,
        contextHour: pattern.context.timeOfDay?.hour ?? -1,
        firstObserved: pattern.firstObserved.getTime(),
        lastObserved: pattern.lastObserved.getTime(),
        serialized: JSON.stringify(pattern),
        vector,
      };

      // Supprimer si déjà existant (upsert)
      try {
        await this.table.delete(`id = '${pattern.id}'`);
      } catch {
        // Peut ne pas exister — OK
      }

      await this.table.add([row]);
      log.debug(`Pattern stored in LanceDB: ${pattern.name}`);
      return true;
    } catch (err) {
      log.warn(`Failed to store pattern ${pattern.id}: ${String(err)}`);
      return false;
    }
  }

  /**
   * Recherche sémantique de patterns similaires à une requête texte.
   */
  async searchSimilarPatterns(query: string, limit = 5): Promise<LearnedPattern[]> {
    if (!this.available || !this.table || !this.embeddingApiKey) return [];

    try {
      const vector = await fetchEmbedding(
        query,
        this.embeddingApiKey,
        this.embeddingModel,
        this.embeddingBaseUrl
      );
      if (!vector) return [];

      const results = await this.table
        .vectorSearch(vector)
        .limit(limit)
        .toArray();

      const patterns: LearnedPattern[] = [];
      for (const row of results) {
        const distance = row._distance ?? 0;
        const score = 1 / (1 + distance);
        if (score < this.minScore) continue;

        try {
          const pattern = JSON.parse(row.serialized as string) as LearnedPattern;
          // Restaurer les dates
          pattern.firstObserved = new Date(pattern.firstObserved);
          pattern.lastObserved = new Date(pattern.lastObserved);
          patterns.push(pattern);
        } catch {
          log.warn(`Failed to deserialize pattern from LanceDB: ${row.id}`);
        }
      }

      return patterns;
    } catch (err) {
      log.warn(`Search failed: ${String(err)}`);
      return [];
    }
  }

  /**
   * Charge tous les patterns persistés depuis LanceDB.
   */
  async loadAllPatterns(): Promise<LearnedPattern[]> {
    if (!this.available || !this.table) return [];

    try {
      const rows = await this.table.query().toArray();
      const patterns: LearnedPattern[] = [];

      for (const row of rows) {
        if (row.id === "__schema__") continue;
        try {
          const pattern = JSON.parse(row.serialized as string) as LearnedPattern;
          pattern.firstObserved = new Date(pattern.firstObserved);
          pattern.lastObserved = new Date(pattern.lastObserved);
          patterns.push(pattern);
        } catch {
          log.warn(`Skipping corrupted pattern: ${row.id}`);
        }
      }

      log.info(`Loaded ${patterns.length} patterns from LanceDB`);
      return patterns;
    } catch (err) {
      log.warn(`Failed to load patterns: ${String(err)}`);
      return [];
    }
  }

  /**
   * Supprime un pattern par ID.
   */
  async deletePattern(patternId: string): Promise<void> {
    if (!this.available || !this.table) return;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patternId)) {
      throw new Error(`Invalid pattern ID format: ${patternId}`);
    }
    await this.table.delete(`id = '${patternId}'`);
  }

  /**
   * Compte le nombre de patterns stockés.
   */
  async count(): Promise<number> {
    if (!this.available || !this.table) return 0;
    return this.table.countRows();
  }

  isAvailable(): boolean {
    return this.available;
  }
}
