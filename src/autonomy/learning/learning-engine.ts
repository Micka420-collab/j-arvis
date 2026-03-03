/**
 * Moteur d'apprentissage de Jarvis
 * Analyse les interactions et extrait des patterns comportementaux
 */

import { randomUUID } from "node:crypto";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type {
  LearningEvent,
  LearnedPattern,
  LearningResult,
  UserPreference,
  Goal,
  KnowledgeNode,
  PatternContext,
} from "../types.js";
import { PatternDetector } from "./pattern-detector.js";
import { KnowledgeGraph } from "./knowledge-graph.js";

const log = createSubsystemLogger("autonomy:learning");

export type LearningEngineConfig = {
  minConfidenceThreshold: number;
  patternRetentionDays: number;
  maxPatternsPerCategory: number;
  learningRate: number; // 0-1, vitesse d'adaptation
};

const DEFAULT_CONFIG: LearningEngineConfig = {
  minConfidenceThreshold: 0.7,
  patternRetentionDays: 90,
  maxPatternsPerCategory: 50,
  learningRate: 0.1,
};

export class LearningEngine {
  private config: LearningEngineConfig;
  private patternDetector: PatternDetector;
  private knowledgeGraph: KnowledgeGraph;
  private eventHistory: LearningEvent[] = [];
  private patterns: Map<string, LearnedPattern> = new Map();
  private preferences: Map<string, UserPreference> = new Map();
  private goals: Map<string, Goal> = new Map();

  constructor(config: Partial<LearningEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.patternDetector = new PatternDetector();
    this.knowledgeGraph = new KnowledgeGraph();
    log.info("LearningEngine initialized");
  }

  /**
   * Traite un nouvel événement d'apprentissage
   */
  async processEvent(event: LearningEvent): Promise<LearningResult> {
    log.debug(`Processing event: ${event.type} from ${event.source}`);

    // Stocker l'événement
    this.eventHistory.push(event);
    this.trimEventHistory();

    const result: LearningResult = {
      patternsDetected: [],
      knowledgeAdded: [],
      preferencesUpdated: [],
      goalsInferred: [],
    };

    // Détecter les patterns selon le type d'événement
    switch (event.type) {
      case "user_command":
        await this.processUserCommand(event, result);
        break;
      case "user_feedback":
        await this.processUserFeedback(event, result);
        break;
      case "system_event":
        await this.processSystemEvent(event, result);
        break;
      case "interaction_pattern":
        await this.processInteractionPattern(event, result);
        break;
      case "decision_outcome":
        await this.processDecisionOutcome(event, result);
        break;
      case "goal_achievement":
        await this.processGoalAchievement(event, result);
        break;
    }

    return result;
  }

  /**
   * Analyse périodique pour découvrir de nouveaux patterns
   */
  async runPeriodicAnalysis(): Promise<LearningResult> {
    log.info("Running periodic learning analysis");

    const result: LearningResult = {
      patternsDetected: [],
      knowledgeAdded: [],
      preferencesUpdated: [],
      goalsInferred: [],
    };

    // Analyser les patterns temporels
    const temporalPatterns = this.analyzeTemporalPatterns();
    result.patternsDetected.push(...temporalPatterns);

    // Analyser les patterns de séquence
    const sequencePatterns = this.analyzeSequencePatterns();
    result.patternsDetected.push(...sequencePatterns);

    // Inférer les objectifs utilisateur
    const inferredGoals = this.inferUserGoals();
    result.goalsInferred.push(...inferredGoals);

    // Mettre à jour les préférences
    const updatedPreferences = await this.updatePreferencesFromHistory();
    result.preferencesUpdated.push(...updatedPreferences);

    log.info(
      `Periodic analysis complete: ${result.patternsDetected.length} patterns, ` +
        `${result.goalsInferred.length} goals, ${result.preferencesUpdated.length} preferences`
    );

    return result;
  }

  /**
   * Traite une commande utilisateur
   */
  private async processUserCommand(
    event: LearningEvent,
    result: LearningResult
  ): Promise<void> {
    const payload = event.payload as {
      command: string;
      parameters?: Record<string, unknown>;
      context?: PatternContext;
    };

    // Extraire la commande et les paramètres
    const { command, parameters, context } = payload;

    // Rechercher des patterns existants similaires
    const similarPatterns = this.findSimilarPatterns(command, context);

    if (similarPatterns.length > 0) {
      // Renforcer les patterns existants
      for (const pattern of similarPatterns) {
        this.reinforcePattern(pattern.id);
      }
    } else if (context) {
      // Créer un nouveau pattern potentiel
      const newPattern = this.createPatternFromCommand(command, parameters, context);
      if (newPattern.confidence >= this.config.minConfidenceThreshold) {
        this.patterns.set(newPattern.id, newPattern);
        result.patternsDetected.push(newPattern);
        log.info(`New pattern learned: ${newPattern.name}`);
      }
    }

    // Extraire les préférences implicites
    const implicitPrefs = this.extractImplicitPreferences(command, parameters);
    for (const pref of implicitPrefs) {
      this.updatePreference(pref);
      result.preferencesUpdated.push(pref);
    }
  }

  /**
   * Traite un feedback utilisateur
   */
  private async processUserFeedback(
    event: LearningEvent,
    result: LearningResult
  ): Promise<void> {
    const payload = event.payload as {
      originalAction: string;
      feedback: "positive" | "negative" | "corrected";
      correction?: string;
      context?: PatternContext;
    };

    const { originalAction, feedback, correction, context } = payload;

    // Mettre à jour la confiance des patterns associés
    const relatedPatterns = this.findPatternsByAction(originalAction);
    for (const pattern of relatedPatterns) {
      if (feedback === "positive") {
        this.reinforcePattern(pattern.id);
      } else if (feedback === "negative") {
        this.reducePatternConfidence(pattern.id);
      } else if (feedback === "corrected" && correction) {
        // Mettre à jour le pattern avec la correction
        this.updatePatternWithCorrection(pattern.id, correction);
      }
    }

    // Si correction, créer un nouveau pattern amélioré
    if (correction && context) {
      const correctedPattern = this.createPatternFromCommand(
        correction,
        {},
        context
      );
      correctedPattern.confidence = Math.min(
        correctedPattern.confidence + 0.2,
        1.0
      );
      this.patterns.set(correctedPattern.id, correctedPattern);
      result.patternsDetected.push(correctedPattern);
    }
  }

  /**
   * Traite un événement système
   */
  private async processSystemEvent(
    event: LearningEvent,
    result: LearningResult
  ): Promise<void> {
    const payload = event.payload as {
      eventType: string;
      data: Record<string, unknown>;
    };

    // Analyser les événements système pour détecter des patterns
    // Par exemple: lumières allumées à certaines heures, température, etc.
    if (payload.eventType.startsWith("domotic:")) {
      const domoticPattern = this.analyzeDomoticEvent(payload);
      if (domoticPattern) {
        result.patternsDetected.push(domoticPattern);
      }
    }
  }

  /**
   * Traite un pattern d'interaction
   */
  private async processInteractionPattern(
    event: LearningEvent,
    result: LearningResult
  ): Promise<void> {
    // Déjà un pattern détecté, le stocker directement
    const pattern = event.payload as LearnedPattern;
    this.patterns.set(pattern.id, pattern);
    result.patternsDetected.push(pattern);
  }

  /**
   * Traite le résultat d'une décision
   */
  private async processDecisionOutcome(
    event: LearningEvent,
    result: LearningResult
  ): Promise<void> {
    const payload = event.payload as {
      decisionId: string;
      success: boolean;
      userSatisfaction?: number;
      lessonsLearned: string[];
    };

    // Mettre à jour les patterns basés sur le succès/échec
    if (payload.success && payload.userSatisfaction && payload.userSatisfaction > 7) {
      // Renforcer les patterns qui ont conduit à cette décision
      log.info(`Decision ${payload.decisionId} was successful, reinforcing patterns`);
    }
  }

  /**
   * Traite l'accomplissement d'un objectif
   */
  private async processGoalAchievement(
    event: LearningEvent,
    result: LearningResult
  ): Promise<void> {
    const payload = event.payload as {
      goalId: string;
      success: boolean;
      methods: string[];
    };

    // Analyser quelles méthodes ont fonctionné
    if (payload.success) {
      for (const method of payload.methods) {
        const methodPattern = this.patterns.get(method);
        if (methodPattern) {
          this.reinforcePattern(method);
        }
      }
    }
  }

  /**
   * Analyse les patterns temporels
   */
  private analyzeTemporalPatterns(): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];

    // Grouper les événements par heure
    const hourlyEvents = new Map<number, LearningEvent[]>();
    for (const event of this.eventHistory) {
      const hour = event.timestamp.getHours();
      if (!hourlyEvents.has(hour)) {
        hourlyEvents.set(hour, []);
      }
      hourlyEvents.get(hour)!.push(event);
    }

    // Détecter les patterns récurrents
    for (const [hour, events] of hourlyEvents) {
      if (events.length >= 3) {
        // Regrouper par type de commande
        const commandGroups = this.groupByCommand(events);
        for (const [command, count] of commandGroups) {
          if (count >= 3) {
            const pattern: LearnedPattern = {
              id: randomUUID(),
              name: `Daily ${command} at ${hour}:00`,
              description: `User regularly executes "${command}" around ${hour}:00`,
              confidence: Math.min(count / 7, 1.0), // Max confiance après 7 jours
              frequency: count,
              firstObserved: events[0].timestamp,
              lastObserved: events[events.length - 1].timestamp,
              context: {
                timeOfDay: { hour, minute: 0 },
              },
              action: {
                type: "suggest",
                command,
              },
            };
            patterns.push(pattern);
          }
        }
      }
    }

    return patterns;
  }

  /**
   * Analyse les patterns de séquence
   */
  private analyzeSequencePatterns(): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];

    // Rechercher des séquences de commandes fréquentes
    // Par exemple: "allume lumière salon" suivi de "mets la musique"
    const sequences = this.findFrequentSequences();

    for (const seq of sequences) {
      const pattern: LearnedPattern = {
        id: randomUUID(),
        name: `Sequence: ${seq.commands.join(" → ")}`,
        description: `Frequent command sequence with ${seq.frequency} occurrences`,
        confidence: Math.min(seq.frequency / 5, 1.0),
        frequency: seq.frequency,
        firstObserved: seq.firstSeen,
        lastObserved: seq.lastSeen,
        context: {},
        action: {
          type: seq.frequency >= 5 ? "execute" : "suggest",
          command: seq.commands.join("; "),
        },
      };
      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Infère les objectifs utilisateur
   */
  private inferUserGoals(): Goal[] {
    const inferredGoals: Goal[] = [];

    // Analyser les patterns pour inférer des objectifs
    const domoticPatterns = Array.from(this.patterns.values()).filter(
      (p) => p.name.includes("light") || p.name.includes("temperature")
    );

    if (domoticPatterns.length >= 3) {
      const goal: Goal = {
        id: randomUUID(),
        title: "Optimisation du confort domestique",
        description: "Maintien d'un environnement domestique confortable et efficient",
        category: "home",
        priority: 7,
        status: "active",
        createdAt: new Date(),
        progress: 0,
        subGoals: [],
        dependencies: [],
        successCriteria: ["Température optimale maintenue", "Économies d'énergie"],
        learnedBehavior: true,
      };
      inferredGoals.push(goal);
    }

    // Détecter les objectifs de productivité
    const workPatterns = this.eventHistory.filter(
      (e) =>
        e.type === "user_command" &&
        ((e.payload as { command?: string }).command?.includes("work") ||
          (e.payload as { command?: string }).command?.includes("focus"))
    );

    if (workPatterns.length >= 5) {
      const goal: Goal = {
        id: randomUUID(),
        title: "Amélioration de la productivité",
        description: "Optimisation de l'environnement de travail",
        category: "productivity",
        priority: 8,
        status: "active",
        createdAt: new Date(),
        progress: 0,
        subGoals: [],
        dependencies: [],
        successCriteria: ["Sessions de focus régulières", "Environnement optimisé"],
        learnedBehavior: true,
      };
      inferredGoals.push(goal);
    }

    return inferredGoals;
  }

  /**
   * Met à jour les préférences depuis l'historique
   */
  private async updatePreferencesFromHistory(): Promise<UserPreference[]> {
    const updated: UserPreference[] = [];

    // Analyser les préférences de communication
    const responseTimes = this.analyzeResponseTimePreferences();
    if (responseTimes) {
      const pref: UserPreference = {
        id: randomUUID(),
        category: "communication",
        key: "preferred_response_time",
        value: responseTimes,
        confidence: 0.8,
        learnedFrom: this.eventHistory.slice(-10).map((e) => e.id),
      };
      this.preferences.set(pref.id, pref);
      updated.push(pref);
    }

    return updated;
  }

  // ============================================================================
  // Méthodes utilitaires
  // ============================================================================

  private trimEventHistory(): void {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 jours
    const cutoff = new Date(Date.now() - maxAge);
    this.eventHistory = this.eventHistory.filter((e) => e.timestamp > cutoff);
  }

  private findSimilarPatterns(
    command: string,
    context?: PatternContext
  ): LearnedPattern[] {
    return Array.from(this.patterns.values()).filter(
      (p) =>
        p.action.command?.toLowerCase().includes(command.toLowerCase()) ||
        (context && this.contextsMatch(p.context, context))
    );
  }

  private findPatternsByAction(action: string): LearnedPattern[] {
    return Array.from(this.patterns.values()).filter(
      (p) => p.action.command?.toLowerCase() === action.toLowerCase()
    );
  }

  private contextsMatch(c1: PatternContext, c2: PatternContext): boolean {
    if (c1.timeOfDay && c2.timeOfDay) {
      return Math.abs(c1.timeOfDay.hour - c2.timeOfDay.hour) <= 1;
    }
    return false;
  }

  private createPatternFromCommand(
    command: string,
    parameters: Record<string, unknown> = {},
    context: PatternContext
  ): LearnedPattern {
    return {
      id: randomUUID(),
      name: command.split(" ").slice(0, 3).join(" "),
      description: `Learned from user command: ${command}`,
      confidence: 0.5, // Confiance initiale modérée
      frequency: 1,
      firstObserved: new Date(),
      lastObserved: new Date(),
      context,
      action: {
        type: "suggest",
        command,
        parameters,
      },
    };
  }

  private reinforcePattern(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.frequency++;
      pattern.confidence = Math.min(
        pattern.confidence + this.config.learningRate * (1 - pattern.confidence),
        1.0
      );
      pattern.lastObserved = new Date();
    }
  }

  private reducePatternConfidence(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.confidence = Math.max(pattern.confidence - this.config.learningRate, 0);
      if (pattern.confidence < 0.2) {
        this.patterns.delete(patternId);
      }
    }
  }

  private updatePatternWithCorrection(patternId: string, correction: string): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.action.command = correction;
      pattern.description += ` (corrected: ${correction})`;
    }
  }

  private groupByCommand(events: LearningEvent[]): Map<string, number> {
    const groups = new Map<string, number>();
    for (const event of events) {
      if (event.type === "user_command") {
        const cmd = (event.payload as { command?: string }).command || "unknown";
        groups.set(cmd, (groups.get(cmd) || 0) + 1);
      }
    }
    return groups;
  }

  private findFrequentSequences(): Array<{
    commands: string[];
    frequency: number;
    firstSeen: Date;
    lastSeen: Date;
  }> {
    // Implémentation simplifiée - dans la vraie vie, utiliser un algorithme de séquence mining
    return [];
  }

  private extractImplicitPreferences(
    command: string,
    parameters?: Record<string, unknown>
  ): UserPreference[] {
    const prefs: UserPreference[] = [];

    // Extraire les préférences de température
    const tempMatch = command.match(/(\d+)\s*°?\s*[Cc]/);
    if (tempMatch) {
      prefs.push({
        id: randomUUID(),
        category: "domotics",
        key: "preferred_temperature",
        value: parseInt(tempMatch[1]),
        confidence: 0.6,
        learnedFrom: [],
      });
    }

    return prefs;
  }

  private analyzeDomoticEvent(payload: {
    eventType: string;
    data: Record<string, unknown>;
  }): LearnedPattern | null {
    // Analyser les événements domotiques pour créer des patterns
    return null;
  }

  private analyzeResponseTimePreferences(): { morning: number; afternoon: number; evening: number } | null {
    // Analyser les temps de réponse préférés
    return null;
  }

  private updatePreference(pref: UserPreference): void {
    const existing = Array.from(this.preferences.values()).find(
      (p) => p.category === pref.category && p.key === pref.key
    );
    if (existing) {
      existing.value = pref.value;
      existing.confidence = Math.min(existing.confidence + 0.1, 1.0);
      existing.lastConfirmed = new Date();
    } else {
      this.preferences.set(pref.id, pref);
    }
  }

  // ============================================================================
  // Getters publics
  // ============================================================================

  getPatterns(): LearnedPattern[] {
    return Array.from(this.patterns.values()).sort(
      (a, b) => b.confidence - a.confidence
    );
  }

  getPreferences(): UserPreference[] {
    return Array.from(this.preferences.values());
  }

  getGoals(): Goal[] {
    return Array.from(this.goals.values());
  }

  getKnowledgeGraph(): KnowledgeGraph {
    return this.knowledgeGraph;
  }
}
