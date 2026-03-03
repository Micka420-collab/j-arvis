/**
 * Digital Twin - Simulateur de Scénarios
 * 
 * Crée un jumeau numérique de l'environnement utilisateur pour simuler
 * des scénarios avant de prendre des décisions réelles.
 */

import type { Decision, Action, ActionOutcome } from "../types.js";
import type { CausalReasoner, CausalEvent } from "./causal-reasoner.js";
import type { PredictiveEngine } from "./predictive-engine.js";

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  initialState: EnvironmentState;
  actions: Action[];
  duration: number; // minutes
  variables: SimulationVariable[];
}

export interface EnvironmentState {
  timestamp: Date;
  location: string;
  weather: {
    condition: string;
    temperature: number;
    humidity: number;
  };
  devices: Record<string, DeviceState>;
  user: {
    presence: boolean;
    activity: string;
    energyLevel: number;
    mood: string;
  };
  context: Record<string, unknown>;
}

export interface DeviceState {
  id: string;
  type: string;
  status: "on" | "off" | "standby";
  settings: Record<string, number | string | boolean>;
  powerConsumption: number; // watts
}

export interface SimulationVariable {
  name: string;
  initialValue: number;
  min: number;
  max: number;
  rateOfChange: number;
}

export interface SimulationResult {
  scenario: SimulationScenario;
  timeline: SimulationStep[];
  finalState: EnvironmentState;
  outcomes: {
    energyConsumption: number;
    comfortScore: number;
    productivityImpact: number;
    userSatisfaction: number;
    risks: string[];
  };
  comparison?: {
    baseline: SimulationResult;
    improvement: number;
  };
  confidence: number;
  executionTime: number;
}

export interface SimulationStep {
  timestamp: Date;
  state: EnvironmentState;
  action?: Action;
  triggeredEvents: string[];
  metrics: {
    comfort: number;
    energy: number;
    satisfaction: number;
  };
}

export interface WhatIfScenario {
  baseScenario: string;
  changes: Array<{
    variable: string;
    newValue: unknown;
    reason: string;
  }>;
  predictions: {
    outcome: string;
    probability: number;
    impact: number;
  }[];
}

export interface OptimizationSuggestion {
  currentApproach: string;
  suggestedApproach: string;
  expectedImprovement: {
    energy: number;
    comfort: number;
    satisfaction: number;
  };
  tradeoffs: string[];
  confidence: number;
}

export class DigitalTwin {
  private causalReasoner: CausalReasoner;
  private predictiveEngine: PredictiveEngine;
  private scenarios: Map<string, SimulationScenario> = new Map();
  private simulationHistory: SimulationResult[] = [];
  private currentState: EnvironmentState | null = null;

  constructor(causalReasoner: CausalReasoner, predictiveEngine: PredictiveEngine) {
    this.causalReasoner = causalReasoner;
    this.predictiveEngine = predictiveEngine;
  }

  /**
   * Synchronise l'état actuel du jumeau numérique avec la réalité
   */
  syncState(realState: Partial<EnvironmentState>): void {
    this.currentState = {
      timestamp: new Date(),
      location: "home",
      weather: { condition: "clear", temperature: 20, humidity: 50 },
      devices: {},
      user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      context: {},
      ...realState,
    } as EnvironmentState;
  }

  /**
   * Crée un scénario de simulation
   */
  createScenario(
    name: string,
    description: string,
    actions: Action[],
    duration: number = 60
  ): SimulationScenario {
    const id = `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const scenario: SimulationScenario = {
      id,
      name,
      description,
      initialState: this.currentState || this.getDefaultState(),
      actions,
      duration,
      variables: this.inferVariables(actions),
    };

    this.scenarios.set(id, scenario);
    return scenario;
  }

  /**
   * Exécute une simulation
   */
  async runSimulation(scenarioId: string): Promise<SimulationResult> {
    const startTime = Date.now();
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const timeline: SimulationStep[] = [];
    let currentState = { ...scenario.initialState };
    const stepDuration = 5; // minutes par étape
    const totalSteps = Math.ceil(scenario.duration / stepDuration);

    // Simuler chaque étape
    for (let step = 0; step < totalSteps; step++) {
      const stepTimestamp = new Date(
        currentState.timestamp.getTime() + step * stepDuration * 60000
      );

      // Appliquer les actions programmées
      const actionsAtThisStep = scenario.actions.filter(
        (a) => Math.floor((a.metadata?.scheduledTime || 0) / stepDuration) === step
      );

      for (const action of actionsAtThisStep) {
        currentState = this.applyAction(currentState, action);
      }

      // Simuler les événements naturels
      const triggeredEvents = this.simulateNaturalEvents(currentState, stepTimestamp);

      // Mettre à jour les métriques
      const metrics = this.calculateMetrics(currentState, triggeredEvents);

      timeline.push({
        timestamp: stepTimestamp,
        state: { ...currentState },
        action: actionsAtThisStep[0],
        triggeredEvents,
        metrics,
      });

      // Mettre à jour l'état pour l'étape suivante
      currentState = this.evolveState(currentState, stepDuration);
    }

    // Calculer les résultats finaux
    const result: SimulationResult = {
      scenario,
      timeline,
      finalState: currentState,
      outcomes: this.calculateOutcomes(timeline),
      confidence: this.calculateConfidence(timeline),
      executionTime: Date.now() - startTime,
    };

    this.simulationHistory.push(result);
    return result;
  }

  /**
   * Compare plusieurs scénarios
   */
  async compareScenarios(scenarioIds: string[]): Promise<{
    best: SimulationResult;
    rankings: Array<{ scenario: string; score: number; reason: string }>;
    analysis: string;
  }> {
    const results: SimulationResult[] = [];

    for (const id of scenarioIds) {
      const result = await this.runSimulation(id);
      results.push(result);
    }

    // Calculer un score composite pour chaque scénario
    const scored = results.map((r) => ({
      result: r,
      score:
        r.outcomes.comfortScore * 0.3 +
        r.outcomes.userSatisfaction * 0.4 +
        (1 - r.outcomes.energyConsumption / 100) * 0.2 +
        (1 - r.outcomes.risks.length / 10) * 0.1,
    }));

    scored.sort((a, b) => b.score - a.score);

    const rankings = scored.map((s, i) => ({
      scenario: s.result.scenario.name,
      score: s.score,
      reason: this.generateRankingReason(s.result, i === 0),
    }));

    return {
      best: scored[0].result,
      rankings,
      analysis: this.generateComparisonAnalysis(scored),
    };
  }

  /**
   * Analyse "What If" - Scénarios contrefactuels
   */
  analyzeWhatIf(baseScenarioId: string, changes: WhatIfScenario["changes"]): WhatIfScenario {
    const baseScenario = this.scenarios.get(baseScenarioId);
    if (!baseScenario) {
      throw new Error(`Scenario ${baseScenarioId} not found`);
    }

    // Créer un nouveau scénario modifié
    const modifiedState = { ...baseScenario.initialState };

    for (const change of changes) {
      this.applyChange(modifiedState, change.variable, change.newValue);
    }

    // Prédire les résultats
    const predictions = this.predictOutcomes(modifiedState, baseScenario.actions);

    return {
      baseScenario: baseScenarioId,
      changes,
      predictions,
    };
  }

  /**
   * Suggère des optimisations
   */
  suggestOptimizations(currentApproach: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyser l'historique des simulations
    const relevantSimulations = this.simulationHistory.filter(
      (s) => s.scenario.name.includes(currentApproach) || s.outcomes.comfortScore > 0.7
    );

    if (relevantSimulations.length === 0) {
      return [
        {
          currentApproach,
          suggestedApproach: "Pas assez de données pour suggérer des optimisations",
          expectedImprovement: { energy: 0, comfort: 0, satisfaction: 0 },
          tradeoffs: [],
          confidence: 0,
        },
      ];
    }

    // Trouver les meilleures pratiques
    const bestSimulation = relevantSimulations.reduce((best, current) => {
      const bestScore =
        best.outcomes.comfortScore + best.outcomes.userSatisfaction;
      const currentScore =
        current.outcomes.comfortScore + current.outcomes.userSatisfaction;
      return currentScore > bestScore ? current : best;
    });

    // Suggérer des optimisations basées sur les meilleurs résultats
    suggestions.push({
      currentApproach,
      suggestedApproach: this.extractBestPractices(bestSimulation),
      expectedImprovement: {
        energy: -15, // -15% consommation
        comfort: 20, // +20% confort
        satisfaction: 25, // +25% satisfaction
      },
      tradeoffs: ["Nécessite plus de données utilisateur", "Peut augmenter la complexité"],
      confidence: 0.75,
    });

    return suggestions;
  }

  /**
   * Simule une journée complète
   */
  async simulateDay(scheduledActions: Action[]): Promise<SimulationResult> {
    const scenario = this.createScenario(
      "Daily Routine Simulation",
      "Simulation d'une journée complète avec les actions programmées",
      scheduledActions,
      24 * 60 // 24 heures
    );

    return this.runSimulation(scenario.id);
  }

  /**
   * Teste la robustesse d'une stratégie
   */
  async stressTest(
    baseScenarioId: string,
    perturbations: Array<{ type: string; magnitude: number }>
  ): Promise<{
    baseline: SimulationResult;
    stressed: SimulationResult[];
    robustness: number;
    vulnerabilities: string[];
  }> {
    // Scénario de base
    const baseline = await this.runSimulation(baseScenarioId);

    // Scénarios perturbés
    const stressed: SimulationResult[] = [];

    for (const perturbation of perturbations) {
      const modifiedScenario = this.applyPerturbation(baseScenarioId, perturbation);
      const result = await this.runSimulation(modifiedScenario.id);
      stressed.push(result);
    }

    // Calculer la robustesse
    const robustness = this.calculateRobustness(baseline, stressed);
    const vulnerabilities = this.identifyVulnerabilities(baseline, stressed);

    return {
      baseline,
      stressed,
      robustness,
      vulnerabilities,
    };
  }

  /**
   * Prédit les besoins futurs basés sur le jumeau numérique
   */
  predictFutureNeeds(horizon: number = 60): Array<{
    time: Date;
    need: string;
    confidence: number;
    recommendedAction: string;
  }> {
    if (!this.currentState) {
      return [];
    }

    const predictions: Array<{
      time: Date;
      need: string;
      confidence: number;
      recommendedAction: string;
    }> = [];

    const now = new Date();

    // Prédire basé sur l'état actuel et les patterns historiques
    if (this.currentState.user.energyLevel < 3) {
      predictions.push({
        time: new Date(now.getTime() + 30 * 60000),
        need: "repos",
        confidence: 0.8,
        recommendedAction: "suggest_break",
      });
    }

    if (this.currentState.weather.temperature > 25) {
      predictions.push({
        time: new Date(now.getTime() + 15 * 60000),
        need: "rafraîchissement",
        confidence: 0.75,
        recommendedAction: "adjust_temperature",
      });
    }

    return predictions;
  }

  // Méthodes privées

  private getDefaultState(): EnvironmentState {
    return {
      timestamp: new Date(),
      location: "home",
      weather: { condition: "clear", temperature: 20, humidity: 50 },
      devices: {},
      user: { presence: true, activity: "idle", energyLevel: 5, mood: "neutral" },
      context: {},
    };
  }

  private inferVariables(actions: Action[]): SimulationVariable[] {
    const variables: SimulationVariable[] = [];

    // Variables par défaut
    variables.push(
      { name: "energy_consumption", initialValue: 0, min: 0, max: 1000, rateOfChange: 10 },
      { name: "comfort", initialValue: 5, min: 0, max: 10, rateOfChange: 0.5 },
      { name: "productivity", initialValue: 5, min: 0, max: 10, rateOfChange: 0.3 }
    );

    return variables;
  }

  private applyAction(state: EnvironmentState, action: Action): EnvironmentState {
    const newState = { ...state };

    // Simuler l'effet de l'action
    switch (action.type) {
      case "ADJUST_LIGHTING":
        newState.devices["lights"] = {
          id: "lights",
          type: "lighting",
          status: "on",
          settings: action.parameters || {},
          powerConsumption: 50,
        };
        break;
      case "ADJUST_TEMPERATURE":
        newState.devices["thermostat"] = {
          id: "thermostat",
          type: "climate",
          status: "on",
          settings: { temperature: action.parameters?.temperature || 21 },
          powerConsumption: 200,
        };
        break;
      case "PLAY_MEDIA":
        newState.user.activity = "entertained";
        newState.user.mood = "happy";
        break;
    }

    return newState;
  }

  private simulateNaturalEvents(state: EnvironmentState, time: Date): string[] {
    const events: string[] = [];

    // Simuler les changements naturels
    if (time.getHours() >= 6 && time.getHours() <= 8) {
      events.push("sunrise_light_increase");
    }

    if (time.getHours() >= 18 && time.getHours() <= 20) {
      events.push("sunset_light_decrease");
    }

    if (state.weather.temperature > 25) {
      events.push("temperature_rising");
    }

    if (state.user.energyLevel < 2) {
      events.push("fatigue_detected");
    }

    return events;
  }

  private evolveState(state: EnvironmentState, duration: number): EnvironmentState {
    const newState = { ...state };
    newState.timestamp = new Date(state.timestamp.getTime() + duration * 60000);

    // Dégradation naturelle de l'énergie
    if (newState.user.activity === "working") {
      newState.user.energyLevel = Math.max(0, newState.user.energyLevel - 0.1 * duration);
    }

    // Variation de température
    if (newState.weather.temperature > 20) {
      newState.weather.temperature -= 0.05 * duration; // Refroidissement naturel
    }

    return newState;
  }

  private calculateMetrics(
    state: EnvironmentState,
    events: string[]
  ): { comfort: number; energy: number; satisfaction: number } {
    let comfort = 5;
    let energy = 0;
    let satisfaction = 5;

    // Confort basé sur la température
    const optimalTemp = 21;
    const tempDiff = Math.abs(state.weather.temperature - optimalTemp);
    comfort = Math.max(0, 10 - tempDiff);

    // Énergie consommée
    energy = Object.values(state.devices).reduce((sum, d) => sum + d.powerConsumption, 0);

    // Satisfaction basée sur l'humeur
    satisfaction = state.user.mood === "happy" ? 8 : state.user.mood === "stressed" ? 3 : 5;

    // Ajustements basés sur les événements
    if (events.includes("fatigue_detected")) {
      comfort -= 2;
      satisfaction -= 1;
    }

    return {
      comfort: Math.max(0, Math.min(10, comfort)),
      energy,
      satisfaction: Math.max(0, Math.min(10, satisfaction)),
    };
  }

  private calculateOutcomes(timeline: SimulationStep[]): SimulationResult["outcomes"] {
    const totalEnergy = timeline.reduce((sum, step) => sum + step.metrics.energy, 0);
    const avgComfort =
      timeline.reduce((sum, step) => sum + step.metrics.comfort, 0) / timeline.length;
    const avgSatisfaction =
      timeline.reduce((sum, step) => sum + step.metrics.satisfaction, 0) / timeline.length;

    return {
      energyConsumption: totalEnergy,
      comfortScore: avgComfort,
      productivityImpact: avgComfort * 0.8 + avgSatisfaction * 0.2,
      userSatisfaction: avgSatisfaction,
      risks: this.identifyRisks(timeline),
    };
  }

  private identifyRisks(timeline: SimulationStep[]): string[] {
    const risks: string[] = [];

    // Vérifier les conditions à risque
    const lowComfortSteps = timeline.filter((s) => s.metrics.comfort < 3);
    if (lowComfortSteps.length > timeline.length * 0.2) {
      risks.push("Niveau de confort bas prolongé");
    }

    const highEnergySteps = timeline.filter((s) => s.metrics.energy > 500);
    if (highEnergySteps.length > timeline.length * 0.3) {
      risks.push("Consommation énergétique élevée");
    }

    return risks;
  }

  private calculateConfidence(timeline: SimulationStep[]): number {
    // Plus il y a d'étapes, plus la confiance est élevée (jusqu'à un certain point)
    const baseConfidence = Math.min(1, timeline.length / 20);

    // Ajuster selon la variance des métriques
    const comfortVariance = this.calculateVariance(timeline.map((t) => t.metrics.comfort));
    const stabilityBonus = comfortVariance < 2 ? 0.1 : 0;

    return Math.min(1, baseConfidence + stabilityBonus);
  }

  private calculateVariance(values: number[]): number {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  }

  private generateRankingReason(result: SimulationResult, isBest: boolean): string {
    if (isBest) {
      return `Meilleur équilibre: confort ${result.outcomes.comfortScore.toFixed(1)}/10, satisfaction ${result.outcomes.userSatisfaction.toFixed(1)}/10`;
    }

    if (result.outcomes.risks.length > 0) {
      return `Risques identifiés: ${result.outcomes.risks.join(", ")}`;
    }

    return `Score général: ${(
      (result.outcomes.comfortScore + result.outcomes.userSatisfaction) /
      2
    ).toFixed(1)}/10`;
  }

  private generateComparisonAnalysis(scored: Array<{ result: SimulationResult; score: number }>): string {
    const best = scored[0];
    const worst = scored[scored.length - 1];

    return `Analyse comparative: Le scénario "${best.result.scenario.name}" offre le meilleur compromis ` +
      `avec un confort de ${best.result.outcomes.comfortScore.toFixed(1)}/10 et une satisfaction de ` +
      `${best.result.outcomes.userSatisfaction.toFixed(1)}/10. ` +
      `Différence avec le pire scénario: ${((best.score - worst.score) * 100).toFixed(0)}% d'amélioration.`;
  }

  private applyChange(state: EnvironmentState, variable: string, value: unknown): void {
    const parts = variable.split(".");
    let current: Record<string, unknown> = state;

    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  private predictOutcomes(
    state: EnvironmentState,
    actions: Action[]
  ): WhatIfScenario["predictions"] {
    return [
      {
        outcome: "comfort_optimized",
        probability: 0.75,
        impact: 0.3,
      },
      {
        outcome: "energy_saved",
        probability: 0.6,
        impact: -0.15,
      },
      {
        outcome: "user_satisfaction",
        probability: 0.8,
        impact: 0.25,
      },
    ];
  }

  private extractBestPractices(simulation: SimulationResult): string {
    const successfulActions = simulation.timeline
      .filter((step) => step.metrics.comfort > 7 && step.metrics.satisfaction > 7)
      .map((step) => step.action?.type)
      .filter(Boolean);

    if (successfulActions.length === 0) {
      return "Maintenir l'approche actuelle";
    }

    const actionCounts = new Map<string, number>();
    for (const action of successfulActions) {
      actionCounts.set(action!, (actionCounts.get(action!) || 0) + 1);
    }

    const bestAction = Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    return `Privilégier les actions de type: ${bestAction?.[0] || "standard"}`;
  }

  private applyPerturbation(
    baseScenarioId: string,
    perturbation: { type: string; magnitude: number }
  ): SimulationScenario {
    const base = this.scenarios.get(baseScenarioId)!;

    const modifiedState = { ...base.initialState };

    switch (perturbation.type) {
      case "temperature_spike":
        modifiedState.weather.temperature += perturbation.magnitude * 10;
        break;
      case "device_failure":
        delete modifiedState.devices["lights"];
        break;
      case "user_absence":
        modifiedState.user.presence = false;
        break;
    }

    const id = `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const perturbedScenario: SimulationScenario = {
      ...base,
      id,
      name: `${base.name} (perturbed: ${perturbation.type})`,
      initialState: modifiedState,
    };

    this.scenarios.set(id, perturbedScenario);
    return perturbedScenario;
  }

  private calculateRobustness(baseline: SimulationResult, stressed: SimulationResult[]): number {
    if (stressed.length === 0) return 1;

    const baselineScore =
      baseline.outcomes.comfortScore + baseline.outcomes.userSatisfaction;

    const avgDegradation =
      stressed.reduce((sum, s) => {
        const stressedScore = s.outcomes.comfortScore + s.outcomes.userSatisfaction;
        return sum + Math.max(0, baselineScore - stressedScore);
      }, 0) / stressed.length;

    return Math.max(0, 1 - avgDegradation / baselineScore);
  }

  private identifyVulnerabilities(
    baseline: SimulationResult,
    stressed: SimulationResult[]
  ): string[] {
    const vulnerabilities: string[] = [];

    for (const stress of stressed) {
      const comfortDrop = baseline.outcomes.comfortScore - stress.outcomes.comfortScore;
      if (comfortDrop > 2) {
        vulnerabilities.push(`Sensibilité aux perturbations: confort chute de ${comfortDrop.toFixed(1)} points`);
      }
    }

    return [...new Set(vulnerabilities)];
  }

  // Getters

  getCurrentState(): EnvironmentState | null {
    return this.currentState;
  }

  getScenarios(): SimulationScenario[] {
    return Array.from(this.scenarios.values());
  }

  getSimulationHistory(): SimulationResult[] {
    return [...this.simulationHistory];
  }

  getStats(): {
    totalSimulations: number;
    avgExecutionTime: number;
    avgConfidence: number;
    bestScenario: string | null;
  } {
    if (this.simulationHistory.length === 0) {
      return {
        totalSimulations: 0,
        avgExecutionTime: 0,
        avgConfidence: 0,
        bestScenario: null,
      };
    }

    const best = this.simulationHistory.reduce((best, current) => {
      const bestScore = best.outcomes.comfortScore + best.outcomes.userSatisfaction;
      const currentScore = current.outcomes.comfortScore + current.outcomes.userSatisfaction;
      return currentScore > bestScore ? current : best;
    });

    return {
      totalSimulations: this.simulationHistory.length,
      avgExecutionTime:
        this.simulationHistory.reduce((sum, s) => sum + s.executionTime, 0) /
        this.simulationHistory.length,
      avgConfidence:
        this.simulationHistory.reduce((sum, s) => sum + s.confidence, 0) /
        this.simulationHistory.length,
      bestScenario: best.scenario.name,
    };
  }
}
