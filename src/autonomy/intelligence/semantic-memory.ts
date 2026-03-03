/**
 * Mémoire Sémantique
 * Utilise des embeddings pour stocker et retrouver des souvenirs contextuels
 * Implémentation simplifiée sans dépendances ML lourdes
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("autonomy:semantic-memory");

export type MemoryEntry = {
  id: string;
  content: string;
  embedding: number[];
  timestamp: Date;
  category: "interaction" | "preference" | "fact" | "event" | "emotion";
  importance: number; // 0-1
  accessCount: number;
  lastAccessed: Date;
  metadata?: Record<string, unknown>;
};

export type SearchResult = {
  entry: MemoryEntry;
  similarity: number;
  relevance: number; // Similarité pondérée par importance
};

export class SemanticMemory {
  private memories: Map<string, MemoryEntry> = new Map();
  private maxSize: number;
  private embeddingSize: number;

  constructor(maxSize: number = 1000, embeddingSize: number = 128) {
    this.maxSize = maxSize;
    this.embeddingSize = embeddingSize;
  }

  /**
   * Stocke un nouveau souvenir
   */
  async store(
    content: string,
    category: MemoryEntry["category"],
    importance: number = 0.5,
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry> {
    // Générer un embedding (simplifié - hash-based pour la démo)
    const embedding = this.generateEmbedding(content);

    const entry: MemoryEntry = {
      id: this.generateId(),
      content,
      embedding,
      timestamp: new Date(),
      category,
      importance: Math.max(0, Math.min(1, importance)),
      accessCount: 0,
      lastAccessed: new Date(),
      metadata,
    };

    // Gestion de la taille
    if (this.memories.size >= this.maxSize) {
      this.evictLeastImportant();
    }

    this.memories.set(entry.id, entry);
    log.debug(`Stored memory: ${content.substring(0, 50)}...`);

    return entry;
  }

  /**
   * Recherche des souvenirs similaires
   */
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    const queryEmbedding = this.generateEmbedding(query);
    const results: SearchResult[] = [];

    for (const entry of this.memories.values()) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      const relevance = similarity * (0.5 + entry.importance * 0.5); // Pondération importance

      if (similarity > 0.3) {
        // Seuil minimum
        results.push({ entry, similarity, relevance });
      }
    }

    // Mettre à jour les compteurs d'accès
    const topResults = results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, topK);

    for (const result of topResults) {
      result.entry.accessCount++;
      result.entry.lastAccessed = new Date();
    }

    return topResults;
  }

  /**
   * Recherche contextuelle (avec filtres)
   */
  async searchContextual(
    query: string,
    options: {
      category?: MemoryEntry["category"];
      since?: Date;
      until?: Date;
      minImportance?: number;
    },
    topK: number = 5
  ): Promise<SearchResult[]> {
    let results = await this.search(query, this.memories.size);

    // Filtrer
    if (options.category) {
      results = results.filter((r) => r.entry.category === options.category);
    }
    if (options.since) {
      results = results.filter((r) => r.entry.timestamp >= options.since!);
    }
    if (options.until) {
      results = results.filter((r) => r.entry.timestamp <= options.until!);
    }
    if (options.minImportance !== undefined) {
      results = results.filter((r) => r.entry.importance >= options.minImportance!);
    }

    return results.slice(0, topK);
  }

  /**
   * Récupère des souvenirs liés à un sujet
   */
  async recall(
    subject: string,
    context?: string
  ): Promise<{
    memories: MemoryEntry[];
    summary: string;
    confidence: number;
  }> {
    const query = context ? `${subject} ${context}` : subject;
    const results = await this.search(query, 10);

    if (results.length === 0) {
      return {
        memories: [],
        summary: "Aucun souvenir trouvé",
        confidence: 0,
      };
    }

    // Générer un résumé
    const memories = results.map((r) => r.entry);
    const summary = this.generateSummary(memories, subject);
    const confidence = results[0].relevance;

    return { memories, summary, confidence };
  }

  /**
   * Met à jour l'importance d'un souvenir
   */
  reinforceMemory(id: string, delta: number = 0.1): boolean {
    const entry = this.memories.get(id);
    if (!entry) return false;

    entry.importance = Math.min(1, entry.importance + delta);
    entry.accessCount++;
    entry.lastAccessed = new Date();

    return true;
  }

  /**
   * Oublie un souvenir (diminue l'importance)
   */
  fadeMemory(id: string, delta: number = 0.1): boolean {
    const entry = this.memories.get(id);
    if (!entry) return false;

    entry.importance = Math.max(0, entry.importance - delta);

    // Supprimer si trop faible
    if (entry.importance < 0.1) {
      this.memories.delete(id);
      log.debug(`Forgotten memory: ${id}`);
    }

    return true;
  }

  /**
   * Consolide les souvenirs (fusionne les similaires)
   */
  async consolidate(): Promise<{
    merged: number;
    removed: number;
  }> {
    const entries = Array.from(this.memories.values());
    const toRemove: string[] = [];
    let merged = 0;

    for (let i = 0; i < entries.length; i++) {
      if (toRemove.includes(entries[i].id)) continue;

      for (let j = i + 1; j < entries.length; j++) {
        if (toRemove.includes(entries[j].id)) continue;

        const similarity = this.cosineSimilarity(
          entries[i].embedding,
          entries[j].embedding
        );

        // Fusionner si très similaires
        if (similarity > 0.9) {
          entries[i].content += `; ${entries[j].content}`;
          entries[i].importance = Math.max(entries[i].importance, entries[j].importance);
          entries[i].accessCount += entries[j].accessCount;
          toRemove.push(entries[j].id);
          merged++;
        }
      }
    }

    // Supprimer les doublons
    for (const id of toRemove) {
      this.memories.delete(id);
    }

    log.info(`Consolidated: ${merged} merged, ${toRemove.length} removed`);
    return { merged, removed: toRemove.length };
  }

  /**
   * Obtient les souvenirs les plus importants
   */
  getMostImportant(limit: number = 10): MemoryEntry[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  /**
   * Obtient les souvenirs récents
   */
  getRecent(limit: number = 10): MemoryEntry[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Génère un récit autobiographique
   */
  generateNarrative(timeframe: "day" | "week" | "month" = "day"): string {
    const cutoff = new Date();
    switch (timeframe) {
      case "day":
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case "week":
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case "month":
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
    }

    const relevant = Array.from(this.memories.values())
      .filter((m) => m.timestamp > cutoff)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (relevant.length === 0) {
      return `Aucun souvenir notable cette ${timeframe === "day" ? "journée" : timeframe === "week" ? "semaine" : "mois"}.`;
    }

    // Grouper par catégorie
    const byCategory = new Map<MemoryEntry["category"], MemoryEntry[]>();
    for (const m of relevant) {
      if (!byCategory.has(m.category)) {
        byCategory.set(m.category, []);
      }
      byCategory.get(m.category)!.push(m);
    }

    let narrative = `Récapitulatif de la ${timeframe === "day" ? "journée" : timeframe === "week" ? "semaine" : "mois"}:\n\n`;

    for (const [category, memories] of byCategory) {
      narrative += `${this.categoryEmoji(category)} **${this.capitalize(category)}** (${memories.length})\n`;
      for (const m of memories.slice(0, 3)) {
        narrative += `  • ${m.content.substring(0, 60)}...\n`;
      }
      narrative += "\n";
    }

    return narrative;
  }

  /**
   * Exporte toutes les mémoires
   */
  export(): MemoryEntry[] {
    return Array.from(this.memories.values());
  }

  /**
   * Importe des mémoires
   */
  import(entries: MemoryEntry[]): void {
    for (const entry of entries) {
      this.memories.set(entry.id, {
        ...entry,
        timestamp: new Date(entry.timestamp),
        lastAccessed: new Date(entry.lastAccessed),
      });
    }
  }

  getStats(): {
    total: number;
    byCategory: Record<string, number>;
    averageImportance: number;
    oldest: Date | null;
    newest: Date | null;
  } {
    const entries = Array.from(this.memories.values());
    const byCategory: Record<string, number> = {};
    let totalImportance = 0;
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      totalImportance += entry.importance;

      if (!oldest || entry.timestamp < oldest) oldest = entry.timestamp;
      if (!newest || entry.timestamp > newest) newest = entry.timestamp;
    }

    return {
      total: entries.length,
      byCategory,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
      oldest,
      newest,
    };
  }

  // ============================================================================
  // Méthodes privées
  // ============================================================================

  /**
   * Génère un embedding simple (hash-based pour la démo)
   * Dans une vraie implémentation, utiliserai un modèle comme sentence-transformers
   */
  private generateEmbedding(text: string): number[] {
    // Embedding basé sur les caractéristiques du texte
    const embedding: number[] = new Array(this.embeddingSize).fill(0);

    // Features: longueur, présence de mots-clés, etc.
    const normalized = text.toLowerCase();

    // Mots-clés sémantiques (simplifié)
    const keywords = [
      "travail", "maison", "famille", "santé", "plaisir",
      "stress", "bonheur", "fatigue", "énergie", "calme",
    ];

    for (let i = 0; i < this.embeddingSize; i++) {
      // Hash simple du texte + position
      let value = 0;
      for (let j = 0; j < normalized.length; j++) {
        value += normalized.charCodeAt(j) * (i + 1) * (j + 1);
      }

      // Ajouter présence de mots-clés
      if (i < keywords.length) {
        value += normalized.includes(keywords[i]) ? 100 : 0;
      }

      embedding[i] = Math.sin(value) * 0.5 + 0.5; // Normaliser 0-1
    }

    // Normaliser le vecteur
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / (magnitude || 1));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private evictLeastImportant(): void {
    let leastImportant: MemoryEntry | null = null;

    for (const entry of this.memories.values()) {
      if (!leastImportant || entry.importance < leastImportant.importance) {
        leastImportant = entry;
      }
    }

    if (leastImportant) {
      this.memories.delete(leastImportant.id);
      log.debug(`Evicted memory: ${leastImportant.id}`);
    }
  }

  private generateSummary(memories: MemoryEntry[], subject: string): string {
    const categories = new Set(memories.map((m) => m.category));
    const count = memories.length;

    return `Je me souviens de ${count} chose${count > 1 ? "s" : ""} concernant "${subject}" ` + `dans les catégories: ${Array.from(categories).join(", ")}.`;
  }

  private categoryEmoji(category: MemoryEntry["category"]): string {
    const emojis: Record<string, string> = {
      interaction: "💬",
      preference: "⚙️",
      fact: "📋",
      event: "📅",
      emotion: "😊",
    };
    return emojis[category] || "📝";
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
