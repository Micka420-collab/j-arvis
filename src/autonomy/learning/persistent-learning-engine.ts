/**
 * PersistentLearningEngine — LearningEngine avec mémoire vectorielle LanceDB
 *
 * Étend LearningEngine en ajoutant :
 *  - Persistance automatique des patterns dans LanceDB
 *  - Chargement des patterns au démarrage depuis la mémoire long-terme
 *  - Recherche sémantique de patterns similaires
 *  - Fallback transparent vers le mode in-memory si LanceDB absent
 *
 * Usage :
 *   const engine = await PersistentLearningEngine.create();
 *   // Utilisation identique au LearningEngine standard
 *   await engine.processEvent(event);
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { LearningEngine, type LearningEngineConfig } from "./learning-engine.js";
import { LanceDBAdapter, type LanceDBAdapterConfig } from "./lancedb-adapter.js";
import type { LearnedPattern, LearningEvent, LearningResult } from "../types.js";

const log = createSubsystemLogger("autonomy:persistent-learning");

// ============================================================================
// Config
// ============================================================================

export type PersistentLearningConfig = {
  /** Config du LearningEngine de base */
  learning?: Partial<LearningEngineConfig>;
  /** Config de l'adaptateur LanceDB */
  lancedb?: LanceDBAdapterConfig;
  /**
   * Sauvegarder automatiquement les nouveaux patterns dans LanceDB
   * Défaut : true
   */
  autoPersist?: boolean;
  /**
   * Utiliser LanceDB pour enrichir la recherche de patterns similaires
   * Défaut : true
   */
  useVectorSearch?: boolean;
};

// ============================================================================
// Engine
// ============================================================================

export class PersistentLearningEngine extends LearningEngine {
  private adapter: LanceDBAdapter | null = null;
  private autoPersist: boolean;
  private useVectorSearch: boolean;

  private constructor(
    config: Partial<LearningEngineConfig>,
    adapter: LanceDBAdapter | null,
    options: { autoPersist: boolean; useVectorSearch: boolean }
  ) {
    super(config);
    this.adapter = adapter;
    this.autoPersist = options.autoPersist;
    this.useVectorSearch = options.useVectorSearch;
  }

  /**
   * Crée et initialise le moteur avec persistance LanceDB optionnelle.
   * Ne lève jamais d'erreur : si LanceDB est absent, fonctionne en mémoire seule.
   */
  static async create(
    config: PersistentLearningConfig = {}
  ): Promise<PersistentLearningEngine> {
    const {
      learning = {},
      lancedb = {},
      autoPersist = true,
      useVectorSearch = true,
    } = config;

    // Tenter d'initialiser LanceDB (retourne null si indisponible)
    const adapter = await LanceDBAdapter.create(lancedb);

    const engine = new PersistentLearningEngine(learning, adapter, {
      autoPersist,
      useVectorSearch,
    });

    if (adapter?.isAvailable()) {
      log.info("PersistentLearningEngine: LanceDB ready — long-term memory enabled");
    } else {
      log.info("PersistentLearningEngine: running in memory-only mode");
    }

    return engine;
  }

  /**
   * Charge les patterns précédemment appris depuis LanceDB.
   * À appeler au démarrage de Jarvis pour restaurer la mémoire long-terme.
   */
  async loadFromVectorStore(): Promise<number> {
    if (!this.adapter?.isAvailable()) return 0;

    try {
      const storedPatterns = await this.adapter.loadAllPatterns();
      if (storedPatterns.length === 0) return 0;

      // Injecter les patterns comme événements interaction_pattern
      for (const pattern of storedPatterns) {
        const event: LearningEvent = {
          id: `restore-${pattern.id}`,
          type: "interaction_pattern",
          source: "lancedb_restore",
          timestamp: new Date(),
          userId: "system",
          payload: pattern,
        };
        await super.processEvent(event);
      }

      log.info(`Restored ${storedPatterns.length} patterns from LanceDB`);
      return storedPatterns.length;
    } catch (err) {
      log.warn(`Failed to load patterns from LanceDB: ${String(err)}`);
      return 0;
    }
  }

  /**
   * Override de processEvent : après traitement normal, persiste les nouveaux patterns.
   */
  override async processEvent(event: LearningEvent): Promise<LearningResult> {
    const result = await super.processEvent(event);

    // Persister les nouveaux patterns découverts
    if (this.autoPersist && result.patternsDetected.length > 0) {
      await this.persistPatterns(result.patternsDetected);
    }

    return result;
  }

  /**
   * Recherche sémantique de patterns similaires à une requête.
   * Combine la recherche en mémoire et la recherche vectorielle LanceDB.
   */
  async findSimilarPatternsSemantic(
    query: string,
    limit = 5
  ): Promise<LearnedPattern[]> {
    const vectorResults: LearnedPattern[] =
      this.useVectorSearch && this.adapter?.isAvailable()
        ? await this.adapter.searchSimilarPatterns(query, limit)
        : [];

    // Fusionner avec les patterns in-memory (sans doublons)
    const inMemoryIds = new Set(this.getPatterns().map((p) => p.id));
    const merged = [...this.getPatterns()];

    for (const vPattern of vectorResults) {
      if (!inMemoryIds.has(vPattern.id)) {
        merged.push(vPattern);
      }
    }

    // Trier par confiance
    merged.sort((a, b) => b.confidence - a.confidence);
    return merged.slice(0, limit);
  }

  /**
   * Sauvegarde un ou plusieurs patterns dans LanceDB.
   */
  async persistPatterns(patterns: LearnedPattern[]): Promise<void> {
    if (!this.adapter?.isAvailable()) return;

    let saved = 0;
    for (const pattern of patterns) {
      const ok = await this.adapter.storePattern(pattern);
      if (ok) saved++;
    }

    if (saved > 0) {
      log.debug(`Persisted ${saved}/${patterns.length} patterns to LanceDB`);
    }
  }

  /**
   * Compte les patterns stockés dans LanceDB.
   */
  async countStoredPatterns(): Promise<number> {
    return this.adapter?.count() ?? 0;
  }

  /**
   * Indique si la persistance LanceDB est active.
   */
  isLanceDBActive(): boolean {
    return this.adapter?.isAvailable() ?? false;
  }
}

// ============================================================================
// Singleton (optionnel — pour usage depuis d'autres modules)
// ============================================================================

let _instance: PersistentLearningEngine | null = null;

/**
 * Retourne le moteur d'apprentissage persistant global de Jarvis.
 * Crée l'instance si elle n'existe pas encore.
 */
export async function getPersistentLearningEngine(
  config?: PersistentLearningConfig
): Promise<PersistentLearningEngine> {
  if (!_instance) {
    _instance = await PersistentLearningEngine.create(config);
    await _instance.loadFromVectorStore();
  }
  return _instance;
}
