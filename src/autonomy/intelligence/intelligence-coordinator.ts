/**
 * IntelligenceCoordinator - Orchestrateur Central
 * 
 * Coordonne tous les modules d'intelligence pour prendre des décisions
 * cohérentes et intelligentes. Gère le flux de données entre les modules
 * et optimise les décisions finales.
 */

import { ContextEnricher, type EnrichedContext } from "./context-enricher.js";
import { PredictiveEngine, type PredictionResult } from "./predictive-engine.js";
import { ReinforcementLearner, type RLAction } from "./reinforcement-learner.js";
import { SemanticMemory, type SearchResult } from "./semantic-memory.js";
import { MultiModalProcessor, type UnifiedContext } from "../multi-modal-processor.js";
import type { Decision, Action, DecisionContext, ActionSuggestion } from "../types.js";

export interface CoordinationConfig {
  /** Poids du contexte enrichi (0-1) */
  contextWeight: number;
  /** Poids des prédictions (0-1) */
  predictionWeight: number;
  /** Poids de l'apprentissage par renforcement (0-1) */
  rlWeight: number;
  /** Poids de la mémoire sémantique (0-1) */
  memoryWeight: number;
  /** Seuil de confiance minimum pour une action autonome */
  autonomyThreshold: number;
  /** Nombre maximum de suggestions */
  maxSuggestions: number;
  /** Activer le mode explicatif */
  explainableMode: boolean;
}

export interface CoordinatedDecision {
  /** Décision finale */
  decision: Decision;
  /** Explication de la décision */
  explanation: DecisionExplanation;
  /** Confiance globale */
  confidence: number;
  /** Modules qui ont contribué */
  contributors: string[];
  /** Suggestions alternatives */
  alternatives: ActionSuggestion[];
  /** Temps de traitement */
  processingTime: number;
}

export interface DecisionExplanation {
  /** Résumé lisible */
  summary: string;
  /** Facteurs contextuels */
  contextualFactors: string[];
  /** Prédictions utilisées */
  predictions: string[];
  /** Souvenirs pertinents */
  relevantMemories: string[];
  /** Apprentissage appliqué */
  learningApplied: string;
  /** Raisonnement étape par étape */
  reasoning: string[];
}

export interface IntelligenceModules {
  contextEnricher: ContextEnricher;
  predictiveEngine: PredictiveEngine;
  reinforcementLearner: ReinforcementLearner;
  semanticMemory: SemanticMemory;
  multiModalProcessor: MultiModalProcessor;
}

export class IntelligenceCoordinator {
  private modules: IntelligenceModules;
  private config: CoordinationConfig;
  private decisionHistory: CoordinatedDecision[] = [];
  private lastProcessingTime = 0;

  constructor(modules: IntelligenceModules, config?: Partial<CoordinationConfig>) {
    this.modules = modules;
    this.config = {
      contextWeight: 0.25,
      predictionWeight: 0.25,
      rlWeight: 0.3,
      memoryWeight: 0.2,
      autonomyThreshold: 0.75,
      maxSuggestions: 3,
      explainableMode: true,
      ...config,
    };
  }

  /**
   * Point d'entrée principal - Coordonne tous les modules pour une décision
   */
  async coordinate(baseContext: DecisionContext): Promise<CoordinatedDecision> {
    const startTime = Date.now();
    const contributors: string[] = [];
    const reasoning: string[] = [];

    try {
      // Étape 1: Enrichir le contexte
      reasoning.push("🔍 Enrichissement du contexte...");
      const enrichedContext = await this.enrichContext(baseContext);
      contributors.push("context-enricher");

      // Étape 2: Traitement multi-modal
      reasoning.push("🔄 Fusion des entrées multi-modales...");
      const unifiedContext = await this.processMultiModal(baseContext);
      if (unifiedContext) contributors.push("multi-modal-processor");

      // Étape 3: Prédiction des besoins
      reasoning.push("🔮 Prédiction des besoins futurs...");
      const predictions = await this.predictNeeds(enrichedContext);
      contributors.push("predictive-engine");

      // Étape 4: Consultation de la mémoire
      reasoning.push("🧠 Récupération des souvenirs pertinents...");
      const memories = await this.queryMemory(enrichedContext);
      contributors.push("semantic-memory");

      // Étape 5: Décision par RL
      reasoning.push("🎓 Prise de décision par apprentissage...");
      const rlDecision = await this.makeRLDecision(enrichedContext, predictions);
      contributors.push("reinforcement-learner");

      // Étape 6: Fusion et optimisation
      reasoning.push("⚖️ Fusion des recommandations...");
      const finalDecision = this.fuseRecommendations(
        enrichedContext,
        predictions,
        memories,
        rlDecision
      );

      // Étape 7: Générer l'explication
      const explanation = this.generateExplanation(
        enrichedContext,
        predictions,
        memories,
        rlDecision,
        reasoning
      );

      // Construire le résultat final
      const coordinatedDecision: CoordinatedDecision = {
        decision: finalDecision,
        explanation,
        confidence: this.calculateOverallConfidence(predictions, rlDecision),
        contributors,
        alternatives: await this.generateAlternatives(enrichedContext, rlDecision),
        processingTime: Date.now() - startTime,
      };

      // Historiser
      this.decisionHistory.push(coordinatedDecision);
      if (this.decisionHistory.length > 100) {
        this.decisionHistory.shift();
      }

      this.lastProcessingTime = coordinatedDecision.processingTime;

      return coordinatedDecision;
    } catch (error) {
      console.error("[IntelligenceCoordinator] Error during coordination:", error);
      throw error;
    }
  }

  /**
   * Enrichit le contexte avec les données temporelles, environnementales et émotionnelles
   */
  private async enrichContext(baseContext: DecisionContext): Promise<EnrichedContext> {
    return await this.modules.contextEnricher.enrichContext({
      userId: baseContext.userId,
      timestamp: baseContext.timestamp,
      emotionalInput: baseContext.emotionalState,
    });
  }

  /**
   * Traite les entrées multi-modales si disponibles
   */
  private async processMultiModal(baseContext: DecisionContext): Promise<UnifiedContext | null> {
    if (!baseContext.multimodalInput) return null;
    
    return await this.modules.multiModalProcessor.process({
      text: baseContext.multimodalInput.text,
      voice: baseContext.multimodalInput.voice,
      sensors: baseContext.multimodalInput.sensors,
      calendar: baseContext.multimodalInput.calendar,
      smartHome: baseContext.multimodalInput.smartHome,
    });
  }

  /**
   * Prédit les besoins futurs de l'utilisateur
   */
  private async predictNeeds(context: EnrichedContext): Promise<PredictionResult[]> {
    const eventsToPredict = [
      "lights_on",
      "make_coffee",
      "start_focus_mode",
      "play_music",
      "adjust_temperature",
    ];

    return this.modules.predictiveEngine.predictMultiple(
      eventsToPredict,
      60, // horizon: 1 heure
      new Date()
    );
  }

  /**
   * Consulte la mémoire sémantique pour des informations pertinentes
   */
  private async queryMemory(context: EnrichedContext): Promise<SearchResult[]> {
    const queries = [
      `préférences ${context.temporal.timeOfDay}`,
      `habitudes ${context.temporal.dayOfWeek === 0 || context.temporal.dayOfWeek === 6 ? "weekend" : "semaine"}`,
      context.emotional.mood ? `humeur ${context.emotional.mood}` : "",
      context.weather?.condition ? `météo ${context.weather.condition}` : "",
    ].filter(Boolean);

    const allResults: SearchResult[] = [];
    
    for (const query of queries) {
      const results = await this.modules.semanticMemory.search(query, 3);
      allResults.push(...results);
    }

    // Dédoublonner et trier par pertinence
    const uniqueResults = new Map<string, SearchResult>();
    for (const result of allResults) {
      const existing = uniqueResults.get(result.entry.id);
      if (!existing || existing.similarity < result.similarity) {
        uniqueResults.set(result.entry.id, result);
      }
    }

    return Array.from(uniqueResults.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  /**
   * Prend une décision via l'apprentissage par renforcement
   */
  private async makeRLDecision(
    context: EnrichedContext,
    predictions: PredictionResult[]
  ): Promise<RLAction> {
    // Construire l'état à partir du contexte
    const state = this.buildRLState(context, predictions);
    
    // Actions possibles
    const actions = this.generatePossibleActions(context, predictions);
    
    // Choisir la meilleure action
    return this.modules.reinforcementLearner.chooseActionWithConfidence(state, actions);
  }

  /**
   * Construit l'état pour le RL à partir du contexte
   */
  private buildRLState(context: EnrichedContext, predictions: PredictionResult[]): string {
    const parts = [
      context.temporal.timeOfDay,
      context.temporal.isWeekend ? "weekend" : "weekday",
      context.emotional.energyLevel
        ? context.emotional.energyLevel > 7
          ? "high_energy"
          : context.emotional.energyLevel > 4
          ? "medium_energy"
          : "low_energy"
        : "unknown_energy",
      context.emotional.mood || "neutral",
    ];

    // Ajouter les prédictions pertinentes
    const highConfidencePredictions = predictions
      .filter((p) => p.confidence > 0.7)
      .map((p) => p.event);
    
    if (highConfidencePredictions.length > 0) {
      parts.push(...highConfidencePredictions);
    }

    return parts.join("_");
  }

  /**
   * Génère les actions possibles basées sur le contexte
   */
  private generatePossibleActions(
    context: EnrichedContext,
    predictions: PredictionResult[]
  ): string[] {
    const actions: string[] = [];

    // Actions basées sur le moment de la journée
    const timeActions: Record<string, string[]> = {
      morning: ["suggest_coffee", "suggest_weather", "suggest_schedule", "suggest_focus"],
      afternoon: ["suggest_break", "suggest_music", "suggest_meeting_prep"],
      evening: ["suggest_relax", "suggest_dinner", "suggest_entertainment"],
      night: ["suggest_sleep", "suggest_night_mode"],
    };

    actions.push(...(timeActions[context.temporal.timeOfDay] || []));

    // Actions basées sur les prédictions
    predictions
      .filter((p) => p.confidence > 0.6)
      .forEach((p) => {
        actions.push(`predicted_${p.event}`);
      });

    // Actions basées sur la météo
    if (context.weather) {
      if (context.weather.condition === "rain" && context.temporal.timeOfDay === "morning") {
        actions.push("suggest_umbrella");
      }
      if (context.weather.temperature && context.weather.temperature > 25) {
        actions.push("suggest_cooling");
      }
    }

    // Actions basées sur l'état émotionnel
    if (context.emotional.stressLevel && context.emotional.stressLevel > 7) {
      actions.push("suggest_breathing", "suggest_break");
    }
    if (context.emotional.energyLevel && context.emotional.energyLevel < 3) {
      actions.push("suggest_rest", "suggest_coffee");
    }

    return [...new Set(actions)]; // Dédoublonner
  }

  /**
   * Fusionne toutes les recommandations pour une décision finale
   */
  private fuseRecommendations(
    context: EnrichedContext,
    predictions: PredictionResult[],
    memories: SearchResult[],
    rlDecision: RLAction
  ): Decision {
    const now = new Date();

    // Déterminer si on agit de manière autonome ou on suggère
    const shouldActAutonomously =
      rlDecision.confidence > this.config.autonomyThreshold &&
      this.hasHighConfidencePredictions(predictions);

    // Construire l'action
    const action: Action = {
      id: `action_${Date.now()}`,
      type: this.mapRLActionToType(rlDecision.action),
      description: this.generateActionDescription(rlDecision.action, context),
      parameters: this.buildActionParameters(rlDecision.action, context, predictions),
      confidence: rlDecision.confidence,
      requiresConfirmation: !shouldActAutonomously,
      estimatedImpact: this.estimateImpact(rlDecision.action, context),
    };

    return {
      id: `decision_${Date.now()}`,
      timestamp: now,
      context: {
        userId: context.userId,
        location: context.location?.isHome ? "home" : "away",
        timeOfDay: context.temporal.timeOfDay,
        weather: context.weather?.condition,
        emotionalState: context.emotional,
        activeTasks: [],
        recentActivity: [],
        availableData: Object.keys(context),
      },
      suggestedActions: [action],
      selectedAction: action,
      reasoning: {
        contextFactors: this.extractContextFactors(context),
        predictedOutcomes: predictions
          .filter((p) => p.confidence > 0.5)
          .map((p) => ({
            scenario: p.event,
            probability: p.confidence,
            impact: p.trend === "increasing" ? "positive" : "neutral",
          })),
        risks: this.assessRisks(context, action),
        confidence: rlDecision.confidence,
      },
      metadata: {
        processingTime: this.lastProcessingTime,
        contributingModules: ["context-enricher", "predictive-engine", "rl-learner", "semantic-memory"],
        dataQuality: this.assessDataQuality(context),
      },
    };
  }

  /**
   * Génère une explication lisible de la décision
   */
  private generateExplanation(
    context: EnrichedContext,
    predictions: PredictionResult[],
    memories: SearchResult[],
    rlDecision: RLAction,
    reasoning: string[]
  ): DecisionExplanation {
    const factors: string[] = [];

    // Facteurs temporels
    factors.push(
      `Il est ${context.temporal.timeOfDay} sur un ${context.temporal.isWeekend ? "weekend" : "jour de semaine"}`
    );

    // Facteurs émotionnels
    if (context.emotional.mood) {
      factors.push(`Votre humeur semble être "${context.emotional.mood}"`);
    }
    if (context.emotional.energyLevel !== undefined) {
      factors.push(`Niveau d'énergie estimé: ${context.emotional.energyLevel}/10`);
    }

    // Facteurs environnementaux
    if (context.weather) {
      factors.push(`Météo actuelle: ${context.weather.condition}, ${context.weather.temperature}°C`);
    }

    return {
      summary: `J'ai décidé de "${this.generateActionDescription(rlDecision.action, context)}" ` +
        `car cela correspond à vos habitudes ${context.temporal.timeOfDay === "morning" ? "matinales" : "du moment"}. ` +
        `Confiance: ${(rlDecision.confidence * 100).toFixed(0)}%`,
      contextualFactors: factors,
      predictions: predictions
        .filter((p) => p.confidence > 0.5)
        .map((p) => `${p.event}: ${(p.confidence * 100).toFixed(0)}% de probabilité (${p.trend})`),
      relevantMemories: memories.slice(0, 3).map((m) => m.entry.content),
      learningApplied: `Apprentissage: l'action "${rlDecision.action}" a été privilégiée ` +
        `basée sur vos retours précédents.`,
      reasoning,
    };
  }

  /**
   * Calcule la confiance globale de la décision
   */
  private calculateOverallConfidence(
    predictions: PredictionResult[],
    rlDecision: RLAction
  ): number {
    const avgPredictionConfidence =
      predictions.reduce((sum, p) => sum + p.confidence, 0) / (predictions.length || 1);

    return (
      this.config.rlWeight * rlDecision.confidence +
      this.config.predictionWeight * avgPredictionConfidence
    );
  }

  /**
   * Génère des suggestions alternatives
   */
  private async generateAlternatives(
    context: EnrichedContext,
    chosenAction: RLAction
  ): Promise<ActionSuggestion[]> {
    const allActions = this.generatePossibleActions(context, []);
    const alternatives: ActionSuggestion[] = [];

    for (const action of allActions) {
      if (action === chosenAction.action) continue;

      alternatives.push({
        id: `alt_${Date.now()}_${alternatives.length}`,
        action,
        description: this.generateActionDescription(action, context),
        confidence: chosenAction.confidence * 0.8, // Légèrement moins confiant
        reason: `Alternative basée sur le contexte ${context.temporal.timeOfDay}`,
      });

      if (alternatives.length >= this.config.maxSuggestions - 1) break;
    }

    return alternatives;
  }

  // Helpers

  private hasHighConfidencePredictions(predictions: PredictionResult[]): boolean {
    return predictions.some((p) => p.confidence > 0.75);
  }

  private mapRLActionToType(action: string): string {
    const typeMap: Record<string, string> = {
      suggest_coffee: "SUGGESTION",
      suggest_relax: "SUGGESTION",
      suggest_focus: "AUTOMATION",
      predicted_lights_on: "AUTOMATION",
      suggest_weather: "NOTIFICATION",
    };
    return typeMap[action] || "SUGGESTION";
  }

  private generateActionDescription(action: string, context: EnrichedContext): string {
    const descriptions: Record<string, string> = {
      suggest_coffee: "Préparer un café",
      suggest_relax: "Activer le mode relaxation",
      suggest_focus: "Activer le mode focus",
      suggest_weather: `Informer sur la météo (${context.weather?.condition})`,
      suggest_music: "Lancer de la musique adaptée",
      suggest_break: "Suggérer une pause",
      predicted_lights_on: "Allumer les lumières",
      predicted_make_coffee: "Préparer le café",
    };
    return descriptions[action] || action.replace(/_/g, " ");
  }

  private buildActionParameters(
    action: string,
    context: EnrichedContext,
    predictions: PredictionResult[]
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      context: {
        timeOfDay: context.temporal.timeOfDay,
        weather: context.weather,
      },
    };

    if (action.includes("coffee")) {
      params.intensity = "medium";
      params.size = "normal";
    }

    if (action.includes("relax")) {
      params.lighting = "warm";
      params.musicGenre = "ambient";
    }

    if (action.includes("focus")) {
      params.notifications = "off";
      params.lighting = "cool";
    }

    return params;
  }

  private estimateImpact(action: string, context: EnrichedContext): number {
    // Estimer l'impact positif de l'action (0-1)
    let impact = 0.5;

    if (action.includes("coffee") && context.temporal.timeOfDay === "morning") {
      impact = 0.8;
    }
    if (action.includes("relax") && context.emotional.stressLevel && context.emotional.stressLevel > 6) {
      impact = 0.9;
    }
    if (action.includes("focus") && context.emotional.productivityMode) {
      impact = 0.85;
    }

    return impact;
  }

  private extractContextFactors(context: EnrichedContext): string[] {
    return [
      `time:${context.temporal.timeOfDay}`,
      `location:${context.location?.isHome ? "home" : "away"}`,
      `weather:${context.weather?.condition || "unknown"}`,
      `mood:${context.emotional.mood || "unknown"}`,
    ];
  }

  private assessRisks(context: EnrichedContext, action: Action): string[] {
    const risks: string[] = [];

    if (action.type === "AUTOMATION" && context.emotional.stressLevel && context.emotional.stressLevel > 8) {
      risks.push("Utilisateur potentiellement irritable - confirmer avant action");
    }

    if (context.weather?.condition === "storm" && action.type === "SUGGESTION") {
      risks.push("Conditions météo défavorables - adapter les suggestions");
    }

    return risks;
  }

  private assessDataQuality(context: EnrichedContext): number {
    let quality = 1.0;

    if (!context.weather) quality -= 0.1;
    if (!context.emotional.mood) quality -= 0.1;
    if (!context.location) quality -= 0.1;

    return Math.max(0.5, quality);
  }

  // Getters pour monitoring

  getDecisionHistory(): CoordinatedDecision[] {
    return [...this.decisionHistory];
  }

  getStats(): {
    totalDecisions: number;
    avgProcessingTime: number;
    avgConfidence: number;
    topContributors: Array<{ module: string; count: number }>;
  } {
    const totalDecisions = this.decisionHistory.length;
    
    if (totalDecisions === 0) {
      return {
        totalDecisions: 0,
        avgProcessingTime: 0,
        avgConfidence: 0,
        topContributors: [],
      };
    }

    const moduleCounts = new Map<string, number>();
    for (const decision of this.decisionHistory) {
      for (const contributor of decision.contributors) {
        moduleCounts.set(contributor, (moduleCounts.get(contributor) || 0) + 1);
      }
    }

    return {
      totalDecisions,
      avgProcessingTime:
        this.decisionHistory.reduce((sum, d) => sum + d.processingTime, 0) / totalDecisions,
      avgConfidence:
        this.decisionHistory.reduce((sum, d) => sum + d.confidence, 0) / totalDecisions,
      topContributors: Array.from(moduleCounts.entries())
        .map(([module, count]) => ({ module, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}
