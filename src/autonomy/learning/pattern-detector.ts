/**
 * Détecteur de patterns comportementaux
 * Utilise des algorithmes de détection de patterns dans les séquences temporelles
 */

import { randomUUID } from "node:crypto";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { LearningEvent, LearnedPattern, PatternContext } from "../types.js";

const log = createSubsystemLogger("autonomy:patterns");

export type PatternDetectorConfig = {
  minSupport: number; // Nombre minimum d'occurrences
  maxGapMinutes: number; // Écart maximum entre événements d'une séquence
  similarityThreshold: number; // Seuil de similarité pour regrouper (0-1)
};

const DEFAULT_CONFIG: PatternDetectorConfig = {
  minSupport: 3,
  maxGapMinutes: 30,
  similarityThreshold: 0.8,
};

export class PatternDetector {
  private config: PatternDetectorConfig;

  constructor(config: Partial<PatternDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Détecte les patterns cycliques (récurrents dans le temps)
   */
  detectCyclicPatterns(events: LearningEvent[]): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];

    // Grouper par type d'événement et heure
    const timeBuckets = this.bucketByTimeOfDay(events);

    for (const [bucketKey, bucketEvents] of timeBuckets) {
      if (bucketEvents.length < this.config.minSupport) continue;

      // Analyser les séquences dans ce bucket horaire
      const sequences = this.extractSequences(bucketEvents);

      for (const seq of sequences) {
        const confidence = this.calculateCyclicConfidence(seq, bucketEvents);
        if (confidence >= 0.6) {
          const [hour, minute] = bucketKey.split(":").map(Number);
          patterns.push({
            id: randomUUID(),
            name: `Cyclic: ${seq.name}`,
            description: `Recurring pattern at ${hour}:${minute.toString().padStart(2, "0")}`,
            confidence,
            frequency: seq.count,
            firstObserved: seq.firstSeen,
            lastObserved: seq.lastSeen,
            context: {
              timeOfDay: { hour, minute },
            },
            action: seq.action,
          });
        }
      }
    }

    log.info(`Detected ${patterns.length} cyclic patterns`);
    return patterns;
  }

  /**
   * Détecte les patterns de séquence (chaînes d'actions)
   */
  detectSequencePatterns(events: LearningEvent[]): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];

    // Construire un graphe de transition entre événements
    const transitions = this.buildTransitionGraph(events);

    // Trouver les chemins fréquents
    const frequentPaths = this.findFrequentPaths(transitions);

    for (const path of frequentPaths) {
      if (path.support >= this.config.minSupport) {
        patterns.push({
          id: randomUUID(),
          name: `Sequence: ${path.description}`,
          description: `Common action sequence (${path.support} times)`,
          confidence: path.confidence,
          frequency: path.support,
          firstObserved: path.firstSeen,
          lastObserved: path.lastSeen,
          context: {},
          action: {
            type: path.confidence > 0.8 ? "execute" : "suggest",
            command: path.commands.join(" → "),
          },
        });
      }
    }

    log.info(`Detected ${patterns.length} sequence patterns`);
    return patterns;
  }

  /**
   * Détecte les patterns basés sur le contexte environnemental
   */
  detectContextualPatterns(events: LearningEvent[]): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];

    // Grouper par contexte (jour de semaine, météo, etc.)
    const contextGroups = this.groupByContext(events);

    for (const [contextKey, contextEvents] of contextGroups) {
      if (contextEvents.length < this.config.minSupport) continue;

      const commonActions = this.findCommonActions(contextEvents);
      for (const action of commonActions) {
        patterns.push({
          id: randomUUID(),
          name: `Contextual: ${action.name}`,
          description: `Action common when ${contextKey}`,
          confidence: action.frequency / contextEvents.length,
          frequency: action.frequency,
          firstObserved: action.firstSeen,
          lastObserved: action.lastSeen,
          context: this.parseContextKey(contextKey),
          action: {
            type: "suggest",
            command: action.command,
          },
        });
      }
    }

    return patterns;
  }

  /**
   * Détecte les anomalies (comportements inhabituels)
   */
  detectAnomalies(events: LearningEvent[], baseline: LearnedPattern[]): LearningEvent[] {
    const anomalies: LearningEvent[] = [];

    for (const event of events) {
      let isAnomaly = true;

      for (const pattern of baseline) {
        if (this.matchesPattern(event, pattern)) {
          isAnomaly = false;
          break;
        }
      }

      if (isAnomaly) {
        anomalies.push(event);
      }
    }

    return anomalies;
  }

  /**
   * Compare deux événements pour déterminer leur similarité
   */
  calculateSimilarity(e1: LearningEvent, e2: LearningEvent): number {
    if (e1.type !== e2.type) return 0;

    let similarity = 0.5; // Base pour même type

    // Comparer les payloads
    const p1 = JSON.stringify(e1.payload);
    const p2 = JSON.stringify(e2.payload);
    const payloadSimilarity = this.stringSimilarity(p1, p2);

    // Comparer les contextes temporels
    const timeDiff = Math.abs(e1.timestamp.getTime() - e2.timestamp.getTime());
    const timeSimilarity = Math.max(0, 1 - timeDiff / (24 * 60 * 60 * 1000)); // Sur 24h

    similarity = similarity * 0.3 + payloadSimilarity * 0.5 + timeSimilarity * 0.2;

    return similarity;
  }

  /**
   * Regroupe les événements similaires
   */
  clusterEvents(events: LearningEvent[]): LearningEvent[][] {
    const clusters: LearningEvent[][] = [];
    const visited = new Set<string>();

    for (const event of events) {
      if (visited.has(event.id)) continue;

      const cluster: LearningEvent[] = [event];
      visited.add(event.id);

      for (const other of events) {
        if (visited.has(other.id)) continue;

        if (this.calculateSimilarity(event, other) >= this.config.similarityThreshold) {
          cluster.push(other);
          visited.add(other.id);
        }
      }

      if (cluster.length >= this.config.minSupport) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  // ============================================================================
  // Méthodes privées utilitaires
  // ============================================================================

  private bucketByTimeOfDay(
    events: LearningEvent[]
  ): Map<string, LearningEvent[]> {
    const buckets = new Map<string, LearningEvent[]>();

    for (const event of events) {
      const hour = event.timestamp.getHours();
      const minute = Math.floor(event.timestamp.getMinutes() / 15) * 15; // Buckets de 15 min
      const key = `${hour}:${minute}`;

      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)!.push(event);
    }

    return buckets;
  }

  private extractSequences(
    events: LearningEvent[]
  ): Array<{
    name: string;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    action: { type: "suggest" | "execute" | "notify"; command: string };
  }> {
    const sequences: Map<string, { count: number; first: Date; last: Date }> =
      new Map();

    for (const event of events) {
      if (event.type === "user_command") {
        const cmd = (event.payload as { command?: string }).command || "unknown";
        const existing = sequences.get(cmd);
        if (existing) {
          existing.count++;
          existing.last = event.timestamp;
        } else {
          sequences.set(cmd, {
            count: 1,
            first: event.timestamp,
            last: event.timestamp,
          });
        }
      }
    }

    return Array.from(sequences.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      firstSeen: data.first,
      lastSeen: data.last,
      action: { type: "suggest" as const, command: name },
    }));
  }

  private calculateCyclicConfidence(
    seq: { count: number; firstSeen: Date; lastSeen: Date },
    allEvents: LearningEvent[]
  ): number {
    const daysSpan =
      (seq.lastSeen.getTime() - seq.firstSeen.getTime()) / (24 * 60 * 60 * 1000);

    if (daysSpan < 1) return 0.3; // Trop tôt pour dire

    const frequency = seq.count / daysSpan;
    const regularity = this.calculateRegularity(allEvents);

    return Math.min((frequency * 0.5 + regularity * 0.5) * 2, 1.0);
  }

  private calculateRegularity(events: LearningEvent[]): number {
    if (events.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < events.length; i++) {
      intervals.push(
        events[i].timestamp.getTime() - events[i - 1].timestamp.getTime()
      );
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      intervals.length;
    const cv = Math.sqrt(variance) / mean; // Coefficient de variation

    return Math.max(0, 1 - cv); // Plus c'est régulier, plus c'est proche de 1
  }

  private buildTransitionGraph(
    events: LearningEvent[]
  ): Map<string, Map<string, number>> {
    const graph = new Map<string, Map<string, number>>();

    // Trier par timestamp
    const sorted = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Vérifier l'écart temporel
      const gap =
        (next.timestamp.getTime() - current.timestamp.getTime()) / (60 * 1000);
      if (gap > this.config.maxGapMinutes) continue;

      const from = this.eventToKey(current);
      const to = this.eventToKey(next);

      if (!graph.has(from)) {
        graph.set(from, new Map());
      }
      const transitions = graph.get(from)!;
      transitions.set(to, (transitions.get(to) || 0) + 1);
    }

    return graph;
  }

  private findFrequentPaths(
    graph: Map<string, Map<string, number>>
  ): Array<{
    description: string;
    commands: string[];
    support: number;
    confidence: number;
    firstSeen: Date;
    lastSeen: Date;
  }> {
    const paths: Array<{
      description: string;
      commands: string[];
      support: number;
      confidence: number;
      firstSeen: Date;
      lastSeen: Date;
    }> = [];

    // DFS pour trouver les chemins fréquents
    for (const [from, transitions] of graph) {
      for (const [to, count] of transitions) {
        if (count >= this.config.minSupport) {
          paths.push({
            description: `${from} → ${to}`,
            commands: [from, to],
            support: count,
            confidence: count / this.getTotalOutgoing(graph, from),
            firstSeen: new Date(),
            lastSeen: new Date(),
          });
        }
      }
    }

    return paths;
  }

  private getTotalOutgoing(
    graph: Map<string, Map<string, number>>,
    node: string
  ): number {
    const transitions = graph.get(node);
    if (!transitions) return 0;
    return Array.from(transitions.values()).reduce((a, b) => a + b, 0);
  }

  private groupByContext(
    events: LearningEvent[]
  ): Map<string, LearningEvent[]> {
    const groups = new Map<string, LearningEvent[]>();

    for (const event of events) {
      const context = this.extractContextKey(event);
      if (!groups.has(context)) {
        groups.set(context, []);
      }
      groups.get(context)!.push(event);
    }

    return groups;
  }

  private extractContextKey(event: LearningEvent): string {
    const dayOfWeek = event.timestamp.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hour = event.timestamp.getHours();
    const timeOfDay =
      hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

    return `${isWeekend ? "weekend" : "weekday"}-${timeOfDay}`;
  }

  private parseContextKey(key: string): PatternContext {
    const [day, time] = key.split("-");
    return {
      dayOfWeek: day === "weekend" ? 0 : 1,
    };
  }

  private findCommonActions(
    events: LearningEvent[]
  ): Array<{
    name: string;
    command: string;
    frequency: number;
    firstSeen: Date;
    lastSeen: Date;
  }> {
    const actions = new Map<
      string,
      { count: number; first: Date; last: Date }
    >();

    for (const event of events) {
      if (event.type === "user_command") {
        const cmd = (event.payload as { command?: string }).command || "unknown";
        const existing = actions.get(cmd);
        if (existing) {
          existing.count++;
          existing.last = event.timestamp;
        } else {
          actions.set(cmd, {
            count: 1,
            first: event.timestamp,
            last: event.timestamp,
          });
        }
      }
    }

    return Array.from(actions.entries()).map(([cmd, data]) => ({
      name: cmd,
      command: cmd,
      frequency: data.count,
      firstSeen: data.first,
      lastSeen: data.last,
    }));
  }

  private matchesPattern(event: LearningEvent, pattern: LearnedPattern): boolean {
    // Vérifier si l'événement correspond au pattern
    if (event.type === "user_command" && pattern.action.command) {
      const cmd = (event.payload as { command?: string }).command || "";
      return cmd
        .toLowerCase()
        .includes(pattern.action.command.toLowerCase());
    }
    return false;
  }

  private eventToKey(event: LearningEvent): string {
    if (event.type === "user_command") {
      return (event.payload as { command?: string }).command || "unknown";
    }
    return `${event.type}:${JSON.stringify(event.payload)}`;
  }

  private stringSimilarity(s1: string, s2: string): number {
    // Distance de Levenshtein normalisée
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // suppression
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }
}
