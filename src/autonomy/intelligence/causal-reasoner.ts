/**
 * Causal Reasoner - Moteur de Raisonnement Causal
 * 
 * Analyse les relations de cause à effet dans les comportements utilisateur,
 * identifie les facteurs influents et permet des analyses contrefactuelles
 * ("what if" scenarios).
 */

import type { Decision, ActionOutcome } from "../types.js";

export interface CausalEvent {
  id: string;
  type: string;
  timestamp: Date;
  variables: Record<string, number | boolean | string>;
  outcome?: number; // Résultat numérique (-1 à 1)
}

export interface CausalRelation {
  cause: string;
  effect: string;
  strength: number; // 0 à 1
  confidence: number; // 0 à 1
  conditions?: string[]; // Conditions nécessaires
  timeLag: number; // Délai moyen en minutes
  evidenceCount: number; // Nombre d'observations
}

export interface CausalGraph {
  nodes: string[];
  edges: CausalRelation[];
  timestamp: Date;
}

export interface CounterfactualScenario {
  originalEvent: CausalEvent;
  hypotheticalChange: Partial<CausalEvent>;
  predictedOutcome: number;
  confidence: number;
  reasoning: string[];
}

export interface RootCauseAnalysis {
  problem: string;
  rootCauses: Array<{
    factor: string;
    contribution: number;
    evidence: string[];
  }>;
  recommendations: string[];
  confidence: number;
}

export interface InterventionSuggestion {
  target: string;
  action: string;
  expectedEffect: string;
  expectedImprovement: number;
  sideEffects: string[];
  confidence: number;
}

export class CausalReasoner {
  private events: CausalEvent[] = [];
  private causalGraph: CausalGraph = { nodes: [], edges: [], timestamp: new Date() };
  private maxEvents = 10000;
  private minConfidenceThreshold = 0.6;

  /**
   * Enregistre un événement pour analyse causale
   */
  recordEvent(event: Omit<CausalEvent, "id">): string {
    const id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullEvent: CausalEvent = { ...event, id };

    this.events.push(fullEvent);

    // Limiter la taille de l'historique
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Mettre à jour le graphe causal périodiquement
    if (this.events.length % 100 === 0) {
      this.updateCausalGraph();
    }

    return id;
  }

  /**
   * Analyse la corrélation temporelle pour identifier les relations causales
   */
  discoverCausalRelations(
    causeType: string,
    effectType: string,
    maxTimeLag: number = 60 // minutes
  ): CausalRelation | null {
    const causeEvents = this.events.filter((e) => e.type === causeType);
    const effectEvents = this.events.filter((e) => e.type === effectType);

    if (causeEvents.length < 5 || effectEvents.length < 5) {
      return null; // Pas assez de données
    }

    // Analyser les co-occurrences temporelles
    let coOccurrences = 0;
    let totalTimeLag = 0;
    const timeLags: number[] = [];

    for (const cause of causeEvents) {
      const matchingEffect = effectEvents.find(
        (effect) =>
          effect.timestamp > cause.timestamp &&
          effect.timestamp.getTime() - cause.timestamp.getTime() <= maxTimeLag * 60000
      );

      if (matchingEffect) {
        coOccurrences++;
        const lag =
          (matchingEffect.timestamp.getTime() - cause.timestamp.getTime()) / 60000;
        totalTimeLag += lag;
        timeLags.push(lag);
      }
    }

    if (coOccurrences < 3) {
      return null;
    }

    // Calculer les métriques
    const correlationStrength = coOccurrences / causeEvents.length;
    const avgTimeLag = totalTimeLag / coOccurrences;

    // Calculer la variance du délai (mesure de régularité)
    const variance =
      timeLags.reduce((sum, lag) => sum + Math.pow(lag - avgTimeLag, 2), 0) /
      timeLags.length;
    const regularityScore = Math.max(0, 1 - variance / (avgTimeLag * avgTimeLag || 1));

    // Confiance basée sur la quantité et la régularité
    const confidence = Math.min(1, (coOccurrences / 10) * regularityScore * correlationStrength);

    return {
      cause: causeType,
      effect: effectType,
      strength: correlationStrength,
      confidence,
      timeLag: avgTimeLag,
      evidenceCount: coOccurrences,
    };
  }

  /**
   * Construit un graphe causal complet
   */
  buildCausalGraph(eventTypes: string[]): CausalGraph {
    const edges: CausalRelation[] = [];
    const nodes = new Set<string>(eventTypes);

    // Tester toutes les paires possibles
    for (let i = 0; i < eventTypes.length; i++) {
      for (let j = 0; j < eventTypes.length; j++) {
        if (i === j) continue;

        const relation = this.discoverCausalRelations(eventTypes[i], eventTypes[j]);
        if (relation && relation.confidence > this.minConfidenceThreshold) {
          edges.push(relation);
        }
      }
    }

    this.causalGraph = {
      nodes: Array.from(nodes),
      edges: edges.sort((a, b) => b.strength - a.strength),
      timestamp: new Date(),
    };

    return this.causalGraph;
  }

  /**
   * Analyse contrefactuelle: "Que se serait-il passé si..."
   */
  analyzeCounterfactual(
    eventId: string,
    hypotheticalChange: Partial<CausalEvent>
  ): CounterfactualScenario | null {
    const originalEvent = this.events.find((e) => e.id === eventId);
    if (!originalEvent) return null;

    const reasoning: string[] = [];
    reasoning.push(`Événement original: ${originalEvent.type}`);

    // Trouver les relations causales pertinentes
    const relevantRelations = this.causalGraph.edges.filter(
      (edge) => edge.cause === originalEvent.type || edge.effect === originalEvent.type
    );

    // Calculer l'impact du changement hypothétique
    let predictedOutcome = originalEvent.outcome || 0;
    let confidence = 1.0;

    for (const relation of relevantRelations) {
      if (relation.cause === originalEvent.type) {
        // Si on modifie la cause, l'effet change
        const outcomeChange = this.estimateOutcomeChange(
          hypotheticalChange,
          originalEvent,
          relation
        );
        predictedOutcome += outcomeChange * relation.strength;
        confidence *= relation.confidence;
        reasoning.push(
          `Relation ${relation.cause} → ${relation.effect}: impact ${(outcomeChange * relation.strength).toFixed(2)}`
        );
      }
    }

    return {
      originalEvent,
      hypotheticalChange,
      predictedOutcome: Math.max(-1, Math.min(1, predictedOutcome)),
      confidence: Math.max(0, confidence),
      reasoning,
    };
  }

  /**
   * Analyse des causes racines
   */
  analyzeRootCauses(problem: string, timeframe: number = 7 * 24 * 60 * 60 * 1000): RootCauseAnalysis {
    const cutoff = new Date(Date.now() - timeframe);
    const recentEvents = this.events.filter((e) => e.timestamp > cutoff);

    const rootCauses: RootCauseAnalysis["rootCauses"] = [];
    const reasoning: string[] = [];

    // Identifier les facteurs corrélés au problème
    const problemEvents = recentEvents.filter((e) =>
      e.type.toLowerCase().includes(problem.toLowerCase())
    );

    if (problemEvents.length === 0) {
      return {
        problem,
        rootCauses: [],
        recommendations: ["Pas assez de données pour analyser ce problème"],
        confidence: 0,
      };
    }

    // Analyser les événements précédant les problèmes
    const precedingEvents: Map<string, number> = new Map();

    for (const problemEvent of problemEvents) {
      const preceding = recentEvents.filter(
        (e) =>
          e.timestamp < problemEvent.timestamp &&
          problemEvent.timestamp.getTime() - e.timestamp.getTime() < 60 * 60 * 1000 // 1 heure avant
      );

      for (const event of preceding) {
        const count = precedingEvents.get(event.type) || 0;
        precedingEvents.set(event.type, count + 1);
      }
    }

    // Trier par fréquence
    const sortedFactors = Array.from(precedingEvents.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [factor, count] of sortedFactors) {
      const contribution = count / problemEvents.length;
      if (contribution > 0.3) {
        rootCauses.push({
          factor,
          contribution,
          evidence: [
            `${count} occurrences avant ${problemEvents.length} problèmes`,
            `Contribution: ${(contribution * 100).toFixed(0)}%`,
          ],
        });
        reasoning.push(`Facteur identifié: ${factor} (${(contribution * 100).toFixed(0)}%)`);
      }
    }

    // Générer des recommandations
    const recommendations = this.generateRecommendations(rootCauses);

    return {
      problem,
      rootCauses,
      recommendations,
      confidence: rootCauses.length > 0 ? Math.max(...rootCauses.map((c) => c.contribution)) : 0,
    };
  }

  /**
   * Suggère des interventions pour influencer un résultat
   */
  suggestInterventions(targetOutcome: string, currentContext: Record<string, unknown>): InterventionSuggestion[] {
    const suggestions: InterventionSuggestion[] = [];

    // Analyser le graphe causal pour trouver les leviers d'action
    const relevantRelations = this.causalGraph.edges.filter(
      (edge) =>
        edge.effect.toLowerCase().includes(targetOutcome.toLowerCase()) &&
        edge.confidence > 0.6
    );

    for (const relation of relevantRelations) {
      const expectedImprovement = relation.strength * relation.confidence;

      suggestions.push({
        target: relation.effect,
        action: `Augmenter ${relation.cause}`,
        expectedEffect: `Améliorer ${targetOutcome}`,
        expectedImprovement,
        sideEffects: this.identifySideEffects(relation.cause),
        confidence: relation.confidence,
      });
    }

    // Trier par impact attendu
    return suggestions.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
  }

  /**
   * Analyse les chaînes causales (effet en cascade)
   */
  analyzeCausalChain(initialEvent: string, depth: number = 3): Array<{
    step: number;
    event: string;
    probability: number;
    cumulativeEffect: number;
  }> {
    const chain: Array<{ step: number; event: string; probability: number; cumulativeEffect: number }> = [];
    let currentEvents = [initialEvent];
    let cumulativeProbability = 1.0;

    for (let step = 1; step <= depth; step++) {
      const nextEvents: string[] = [];

      for (const event of currentEvents) {
        const relations = this.causalGraph.edges.filter((e) => e.cause === event);

        for (const relation of relations) {
          cumulativeProbability *= relation.strength * relation.confidence;

          chain.push({
            step,
            event: relation.effect,
            probability: cumulativeProbability,
            cumulativeEffect: relation.strength,
          });

          nextEvents.push(relation.effect);
        }
      }

      currentEvents = nextEvents;
      if (currentEvents.length === 0) break;
    }

    return chain;
  }

  /**
   * Évalue l'impact d'une décision passée
   */
  evaluateDecisionImpact(decision: Decision): {
    predictedOutcome: number;
    actualOutcome: number;
    accuracy: number;
    lessons: string[];
  } {
    // Trouver les événements liés à cette décision
    const relatedEvents = this.events.filter(
      (e) =>
        e.timestamp > decision.timestamp &&
        e.timestamp.getTime() - decision.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    // Calculer l'impact prédit vs réel
    const predictedOutcome = decision.reasoning.predictedOutcomes.reduce(
      (sum, o) => sum + o.probability * (o.impact === "positive" ? 1 : o.impact === "negative" ? -1 : 0),
      0
    );

    const actualOutcome = relatedEvents.reduce((sum, e) => sum + (e.outcome || 0), 0) / (relatedEvents.length || 1);

    const accuracy = 1 - Math.abs(predictedOutcome - actualOutcome) / 2;

    const lessons: string[] = [];
    if (accuracy < 0.5) {
      lessons.push("Les facteurs de contexte n'ont pas été correctement évalués");
    }
    if (relatedEvents.length < 3) {
      lessons.push("Pas assez de données pour évaluer l'impact");
    }

    return {
      predictedOutcome,
      actualOutcome,
      accuracy: Math.max(0, accuracy),
      lessons,
    };
  }

  /**
   * Identifie les confusions causales (corrélations non causales)
   */
  identifyConfounders(eventA: string, eventB: string): string[] {
    const confounders: string[] = [];

    // Chercher un troisième événement qui cause les deux
    for (const node of this.causalGraph.nodes) {
      if (node === eventA || node === eventB) continue;

      const aToNode = this.causalGraph.edges.find(
        (e) => e.cause === node && e.effect === eventA
      );
      const bToNode = this.causalGraph.edges.find(
        (e) => e.cause === node && e.effect === eventB
      );

      if (aToNode && bToNode && aToNode.confidence > 0.6 && bToNode.confidence > 0.6) {
        confounders.push(node);
      }
    }

    return confounders;
  }

  // Méthodes privées

  private updateCausalGraph(): void {
    const eventTypes = [...new Set(this.events.map((e) => e.type))];
    this.buildCausalGraph(eventTypes);
  }

  private estimateOutcomeChange(
    change: Partial<CausalEvent>,
    original: CausalEvent,
    relation: CausalRelation
  ): number {
    let changeMagnitude = 0;

    // Comparer les variables
    for (const [key, newValue] of Object.entries(change.variables || {})) {
      const oldValue = original.variables[key];
      if (typeof oldValue === "number" && typeof newValue === "number") {
        changeMagnitude += (newValue - oldValue) / 10; // Normaliser
      } else if (oldValue !== newValue) {
        changeMagnitude += 0.5; // Changement binaire
      }
    }

    return changeMagnitude;
  }

  private generateRecommendations(rootCauses: RootCauseAnalysis["rootCauses"]): string[] {
    const recommendations: string[] = [];

    for (const cause of rootCauses) {
      if (cause.contribution > 0.7) {
        recommendations.push(`Surveiller attentivement: ${cause.factor}`);
      }
      recommendations.push(`Réduire ${cause.factor} pour diminuer le risque`);
    }

    if (recommendations.length === 0) {
      recommendations.push("Collecter plus de données pour identifier les causes");
    }

    return [...new Set(recommendations)];
  }

  private identifySideEffects(action: string): string[] {
    const sideEffects: string[] = [];

    // Trouver les effets secondaires dans le graphe causal
    const secondaryEffects = this.causalGraph.edges.filter((e) => e.cause === action);

    for (const effect of secondaryEffects) {
      if (effect.strength > 0.5) {
        sideEffects.push(`${effect.effect} (probabilité: ${(effect.strength * 100).toFixed(0)}%)`);
      }
    }

    return sideEffects;
  }

  // Getters

  getCausalGraph(): CausalGraph {
    return this.causalGraph;
  }

  getEventHistory(): CausalEvent[] {
    return [...this.events];
  }

  getStats(): {
    totalEvents: number;
    causalRelations: number;
    avgRelationStrength: number;
    lastUpdate: Date;
  } {
    const avgStrength =
      this.causalGraph.edges.reduce((sum, e) => sum + e.strength, 0) /
      (this.causalGraph.edges.length || 1);

    return {
      totalEvents: this.events.length,
      causalRelations: this.causalGraph.edges.length,
      avgRelationStrength: avgStrength,
      lastUpdate: this.causalGraph.timestamp,
    };
  }
}
