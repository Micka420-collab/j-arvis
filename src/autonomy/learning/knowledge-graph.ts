/**
 * Graphe de connaissances pour stocker et relier les informations apprises
 * Structure de graphe orienté avec pondération des relations
 * Persistance JSON sur disque dans ~/.openclaw/knowledge-graph.json
 */

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  EdgeType,
} from "../types.js";

const log = createSubsystemLogger("autonomy:knowledge");

const PERSISTENCE_DIR = join(homedir(), ".openclaw");
const PERSISTENCE_FILE = join(PERSISTENCE_DIR, "knowledge-graph.json");
const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // nodeId -> edgeIds
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private isDirty = false;

  constructor() {
    this.loadFromDisk();
    this.startAutosave();
  }

  /**
   * Charge le graphe depuis le fichier JSON sur disque
   */
  loadFromDisk(): void {
    if (!existsSync(PERSISTENCE_FILE)) {
      log.info("Pas de graphe persisté — démarrage avec un graphe vide");
      return;
    }
    try {
      const raw = readFileSync(PERSISTENCE_FILE, "utf-8");
      const data = JSON.parse(raw) as {
        nodes: Array<KnowledgeNode & { createdAt: string; updatedAt: string }>;
        edges: KnowledgeEdge[];
        adjacencyList: Array<[string, string[]]>;
      };
      // Restaurer les Maps avec les dates correctement désérialisées
      for (const n of data.nodes) {
        this.nodes.set(n.id, { ...n, createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt) });
      }
      for (const e of data.edges) {
        this.edges.set(e.id, e);
      }
      for (const [nodeId, edgeIds] of data.adjacencyList) {
        this.adjacencyList.set(nodeId, new Set(edgeIds));
      }
      log.info(`Graphe de connaissances chargé : ${this.nodes.size} nœuds, ${this.edges.size} relations`);
    } catch (err) {
      log.warn(`Impossible de charger le graphe de connaissances : ${String(err)}`);
    }
  }

  /**
   * Sauvegarde le graphe sur disque (JSON)
   */
  saveToDisk(): void {
    try {
      if (!existsSync(PERSISTENCE_DIR)) {
        mkdirSync(PERSISTENCE_DIR, { recursive: true });
      }
      const data = {
        version: 1,
        savedAt: new Date().toISOString(),
        nodes: [...this.nodes.values()],
        edges: [...this.edges.values()],
        adjacencyList: [...this.adjacencyList.entries()].map(([k, v]) => [k, [...v]]),
      };
      writeFileSync(PERSISTENCE_FILE, JSON.stringify(data, null, 2), "utf-8");
      this.isDirty = false;
      log.debug(`Graphe sauvegardé : ${this.nodes.size} nœuds`);
    } catch (err) {
      log.warn(`Erreur sauvegarde graphe : ${String(err)}`);
    }
  }

  /**
   * Lance l'autosave périodique
   */
  private startAutosave(): void {
    this.autosaveTimer = setInterval(() => {
      if (this.isDirty) {
        this.saveToDisk();
      }
    }, AUTOSAVE_INTERVAL_MS);
    // Éviter que le timer empêche Node de quitter
    if (this.autosaveTimer.unref) {
      this.autosaveTimer.unref();
    }
  }

  /**
   * Arrête l'autosave et sauvegarde immédiatement si nécessaire
   */
  destroy(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    if (this.isDirty) {
      this.saveToDisk();
    }
  }

  /**
   * Ajoute un nœud au graphe
   */
  addNode(
    type: KnowledgeNodeType,
    label: string,
    data: unknown,
    confidence = 0.5
  ): KnowledgeNode {
    const existing = this.findNodeByLabel(label, type);
    if (existing) {
      // Mettre à jour le nœud existant
      existing.confidence = Math.min(existing.confidence + 0.1, 1.0);
      existing.updatedAt = new Date();
      existing.accessCount++;
      existing.data = data;
      this.isDirty = true;
      return existing;
    }

    const node: KnowledgeNode = {
      id: randomUUID(),
      type,
      label,
      data,
      confidence,
      createdAt: new Date(),
      updatedAt: new Date(),
      accessCount: 1,
    };

    this.nodes.set(node.id, node);
    this.adjacencyList.set(node.id, new Set());
    this.isDirty = true;
    log.debug(`Added knowledge node: ${label} (${type})`);
    return node;
  }

  /**
   * Ajoute une relation (arête) entre deux nœuds
   */
  addEdge(
    sourceId: string,
    targetId: string,
    type: EdgeType,
    weight = 0.5,
    metadata?: Record<string, unknown>
  ): KnowledgeEdge | null {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      log.warn("Cannot add edge: source or target node not found");
      return null;
    }

    // Vérifier si une relation similaire existe déjà
    const existing = this.findEdge(sourceId, targetId, type);
    if (existing) {
      existing.weight = Math.min(existing.weight + 0.1, 1.0);
      return existing;
    }

    const edge: KnowledgeEdge = {
      id: randomUUID(),
      source: sourceId,
      target: targetId,
      type,
      weight,
      metadata,
    };

    this.edges.set(edge.id, edge);
    this.adjacencyList.get(sourceId)!.add(edge.id);
    log.debug(`Added edge: ${sourceId} ${type} ${targetId}`);
    return edge;
  }

  /**
   * Recherche des nœuds par label (fuzzy search)
   */
  searchNodes(query: string, type?: KnowledgeNodeType): KnowledgeNode[] {
    const results: Array<{ node: KnowledgeNode; score: number }> = [];

    for (const node of this.nodes.values()) {
      if (type && node.type !== type) continue;

      const score = this.calculateRelevance(node, query);
      if (score > 0.3) {
        results.push({ node, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map((r) => r.node);
  }

  /**
   * Trouve les nœuds liés à un nœud donné
   */
  findRelated(
    nodeId: string,
    options: {
      edgeType?: EdgeType;
      direction?: "out" | "in" | "both";
      minWeight?: number;
    } = {}
  ): Array<{ node: KnowledgeNode; edge: KnowledgeEdge }> {
    const { edgeType, direction = "out", minWeight = 0 } = options;
    const results: Array<{ node: KnowledgeNode; edge: KnowledgeEdge }> = [];

    if (direction === "out" || direction === "both") {
      const edgeIds = this.adjacencyList.get(nodeId) || new Set();
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId)!;
        if (edge.weight < minWeight) continue;
        if (edgeType && edge.type !== edgeType) continue;

        const targetNode = this.nodes.get(edge.target)!;
        results.push({ node: targetNode, edge });
      }
    }

    if (direction === "in" || direction === "both") {
      // Chercher les arêtes où ce nœud est la cible
      for (const edge of this.edges.values()) {
        if (edge.target === nodeId) {
          if (edge.weight < minWeight) continue;
          if (edgeType && edge.type !== edgeType) continue;

          const sourceNode = this.nodes.get(edge.source)!;
          results.push({ node: sourceNode, edge });
        }
      }
    }

    return results.sort((a, b) => b.edge.weight - a.edge.weight);
  }

  /**
   * Trouve les chemins entre deux nœuds
   */
  findPaths(
    startId: string,
    endId: string,
    maxDepth = 3
  ): Array<{ path: KnowledgeEdge[]; totalWeight: number }> {
    const paths: Array<{ path: KnowledgeEdge[]; totalWeight: number }> = [];

    const dfs = (
      current: string,
      target: string,
      path: KnowledgeEdge[],
      visited: Set<string>,
      depth: number
    ) => {
      if (depth > maxDepth) return;
      if (current === target) {
        const totalWeight =
          path.reduce((sum, e) => sum + e.weight, 0) / path.length;
        paths.push({ path: [...path], totalWeight });
        return;
      }

      visited.add(current);
      const edgeIds = this.adjacencyList.get(current) || new Set();

      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId)!;
        if (visited.has(edge.target)) continue;

        path.push(edge);
        dfs(edge.target, target, path, visited, depth + 1);
        path.pop();
      }

      visited.delete(current);
    };

    dfs(startId, endId, [], new Set(), 0);
    return paths.sort((a, b) => b.totalWeight - a.totalWeight);
  }

  /**
   * Infère de nouvelles relations par transitivité
   */
  inferRelations(): KnowledgeEdge[] {
    const inferred: KnowledgeEdge[] = [];

    // Si A → B et B → C, alors A → C (avec un poids réduit)
    for (const edge1 of this.edges.values()) {
      for (const edge2 of this.edges.values()) {
        if (edge1.target === edge2.source && edge1.source !== edge2.target) {
          // Vérifier si cette relation existe déjà
          const existing = this.findEdge(edge1.source, edge2.target, "depends_on");
          if (!existing) {
            const inferredEdge = this.addEdge(
              edge1.source,
              edge2.target,
              "depends_on",
              edge1.weight * edge2.weight * 0.8,
              { inferred: true, from: [edge1.id, edge2.id] }
            );
            if (inferredEdge) {
              inferred.push(inferredEdge);
            }
          }
        }
      }
    }

    log.info(`Inferred ${inferred.length} new relations`);
    return inferred;
  }

  /**
   * Calcule la centralité d'un nœud (importance dans le graphe)
   */
  calculateCentrality(nodeId: string): number {
    const node = this.nodes.get(nodeId);
    if (!node) return 0;

    // Combinaison de degré, confiance et nombre d'accès
    const outgoing = this.adjacencyList.get(nodeId)?.size || 0;
    let incoming = 0;
    for (const edge of this.edges.values()) {
      if (edge.target === nodeId) incoming++;
    }

    const degreeScore = (outgoing + incoming) / (this.nodes.size || 1);
    const confidenceScore = node.confidence;
    const usageScore = Math.min(node.accessCount / 100, 1);

    return degreeScore * 0.3 + confidenceScore * 0.4 + usageScore * 0.3;
  }

  /**
   * Récupère les connaissances les plus importantes
   */
  getMostImportant(limit = 10): KnowledgeNode[] {
    return Array.from(this.nodes.values())
      .map((node) => ({ node, centrality: this.calculateCentrality(node.id) }))
      .sort((a, b) => b.centrality - a.centrality)
      .slice(0, limit)
      .map((r) => r.node);
  }

  /**
   * Récupère les connaissances par type
   */
  getByType(type: KnowledgeNodeType): KnowledgeNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.type === type)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Met à jour la confiance d'un nœud
   */
  updateConfidence(nodeId: string, delta: number): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.confidence = Math.max(0, Math.min(1, node.confidence + delta));
      node.updatedAt = new Date();
    }
  }

  /**
   * Supprime les nœuds avec une confiance trop faible
   */
  prune(minConfidence = 0.1): number {
    let removed = 0;
    for (const [id, node] of this.nodes) {
      if (node.confidence < minConfidence) {
        this.removeNode(id);
        removed++;
      }
    }
    log.info(`Pruned ${removed} low-confidence nodes`);
    return removed;
  }

  /**
   * Exporte le graphe au format JSON
   */
  export(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  /**
   * Importe un graphe depuis JSON
   */
  import(data: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }): void {
    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
      this.adjacencyList.set(node.id, new Set());
    }
    for (const edge of data.edges) {
      this.edges.set(edge.id, edge);
      this.adjacencyList.get(edge.source)?.add(edge.id);
    }
    log.info(`Imported ${data.nodes.length} nodes and ${data.edges.length} edges`);
  }

  /**
   * Obtient des statistiques sur le graphe
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    byType: Record<string, number>;
    averageConfidence: number;
  } {
    const byType: Record<string, number> = {};
    let totalConfidence = 0;

    for (const node of this.nodes.values()) {
      byType[node.type] = (byType[node.type] || 0) + 1;
      totalConfidence += node.confidence;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      byType,
      averageConfidence:
        this.nodes.size > 0 ? totalConfidence / this.nodes.size : 0,
    };
  }

  // ============================================================================
  // Méthodes privées
  // ============================================================================

  private findNodeByLabel(
    label: string,
    type: KnowledgeNodeType
  ): KnowledgeNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.type === type && node.label.toLowerCase() === label.toLowerCase()) {
        return node;
      }
    }
    return undefined;
  }

  private findEdge(
    sourceId: string,
    targetId: string,
    type: EdgeType
  ): KnowledgeEdge | undefined {
    for (const edge of this.edges.values()) {
      if (
        edge.source === sourceId &&
        edge.target === targetId &&
        edge.type === type
      ) {
        return edge;
      }
    }
    return undefined;
  }

  private removeNode(nodeId: string): void {
    // Supprimer les arêtes associées
    const edgeIds = this.adjacencyList.get(nodeId) || new Set();
    for (const edgeId of edgeIds) {
      this.edges.delete(edgeId);
    }

    // Supprimer les références dans d'autres nœuds
    for (const [id, edges] of this.adjacencyList) {
      if (id !== nodeId) {
        for (const edgeId of edges) {
          const edge = this.edges.get(edgeId);
          if (edge?.target === nodeId) {
            this.edges.delete(edgeId);
            edges.delete(edgeId);
          }
        }
      }
    }

    this.adjacencyList.delete(nodeId);
    this.nodes.delete(nodeId);
  }

  private calculateRelevance(node: KnowledgeNode, query: string): number {
    const labelLower = node.label.toLowerCase();
    const queryLower = query.toLowerCase();

    if (labelLower === queryLower) return 1.0;
    if (labelLower.includes(queryLower)) return 0.8;

    // Recherche dans les données
    const dataStr = JSON.stringify(node.data).toLowerCase();
    if (dataStr.includes(queryLower)) return 0.5;

    return 0;
  }
}
