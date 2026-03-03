/**
 * Moteur de décision autonome de Jarvis
 * Prend des décisions intelligentes basées sur les connaissances apprises
 */

import { randomUUID } from "node:crypto";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type {
  Decision,
  DecisionContext,
  DecisionOption,
  DecisionResult,
  AutonomyLevel,
  Constraint,
  Risk,
  Benefit,
  LearnedPattern,
  Goal,
} from "../types.js";
import { EthicsGuard } from "./ethics-guard.js";
import { GoalManager } from "./goal-manager.js";
import {
  getJarvisBridge,
  formatJarvisMessage,
  type JarvisBridge,
} from "../jarvis-bridge.js";

const log = createSubsystemLogger("autonomy:decision");

export type DecisionEngineConfig = {
  autonomyLevel: AutonomyLevel;
  maxDecisionsPerHour: number;
  confidenceThreshold: number;
  userApprovalTimeoutMs: number;
};

const DEFAULT_CONFIG: DecisionEngineConfig = {
  autonomyLevel: "suggest",
  maxDecisionsPerHour: 10,
  confidenceThreshold: 0.7,
  userApprovalTimeoutMs: 30000,
};

export class DecisionEngine {
  private config: DecisionEngineConfig;
  private ethicsGuard: EthicsGuard;
  private goalManager: GoalManager;
  private decisionHistory: Decision[] = [];
  private patterns: Map<string, LearnedPattern> = new Map();

  constructor(
    config: Partial<DecisionEngineConfig> = {},
    ethicsGuard?: EthicsGuard,
    goalManager?: GoalManager
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ethicsGuard = ethicsGuard || new EthicsGuard();
    this.goalManager = goalManager || new GoalManager();
    log.info(`DecisionEngine initialized with autonomy level: ${this.config.autonomyLevel}`);
  }

  /**
   * Évalue une situation et prend une décision
   */
  async evaluateAndDecide(
    context: DecisionContext,
    options?: DecisionOption[]
  ): Promise<DecisionResult | null> {
    // Vérifier les limites de décision
    if (this.hasExceededDecisionLimit()) {
      log.warn("Decision limit exceeded, skipping autonomous decision");
      return null;
    }

    // Générer les options si non fournies
    const decisionOptions = options || (await this.generateOptions(context));
    if (decisionOptions.length === 0) {
      log.debug("No decision options available");
      return null;
    }

    // Évaluer chaque option
    const evaluatedOptions = await this.evaluateOptions(decisionOptions, context);

    // Sélectionner la meilleure option
    const selectedOption = this.selectBestOption(evaluatedOptions);
    if (!selectedOption) {
      log.debug("No suitable option found");
      return null;
    }

    // Créer la décision
    const decision: Decision = {
      id: randomUUID(),
      timestamp: new Date(),
      context,
      options: evaluatedOptions,
      selectedOption,
      reasoning: this.generateReasoning(selectedOption, context),
      confidence: selectedOption.confidence,
      autonomyLevel: this.determineAutonomyLevel(selectedOption, context),
    };

    // Vérification éthique
    const ethicsCheck = this.ethicsGuard.checkDecision(decision);
    if (!ethicsCheck.passed) {
      log.warn(`Decision ${decision.id} failed ethics check`);
      return {
        decision,
        executed: false,
        userNotified: true,
        ethicsPassed: false,
        timestamp: new Date(),
      };
    }

    // Exécuter ou proposer selon le niveau d'autonomie
    const result = await this.executeDecision(decision);

    // Enregistrer la décision
    this.decisionHistory.push(decision);
    this.trimDecisionHistory();

    return result;
  }

  /**
   * Génère des options de décision basées sur le contexte
   */
  private async generateOptions(
    context: DecisionContext
  ): Promise<DecisionOption[]> {
    const options: DecisionOption[] = [];

    // Option 1: Ne rien faire
    options.push({
      id: randomUUID(),
      action: "noop",
      parameters: {},
      expectedOutcome: "Maintain current state",
      risks: [],
      benefits: [{ description: "Stability", value: 5, category: "comfort" }],
      confidence: 0.9,
      requiresApproval: false,
    });

    // Générer des options basées sur les patterns appris
    for (const pattern of this.patterns.values()) {
      if (this.matchesContext(pattern, context)) {
        const option: DecisionOption = {
          id: randomUUID(),
          action: pattern.action.type,
          parameters: pattern.action.parameters || {},
          expectedOutcome: pattern.action.message || `Execute: ${pattern.name}`,
          risks: this.assessRisks(pattern, context),
          benefits: this.assessBenefits(pattern, context),
          confidence: pattern.confidence,
          requiresApproval: pattern.confidence < 0.8 || this.hasHighImpact(pattern),
        };
        options.push(option);
      }
    }

    // Générer des options basées sur les objectifs actifs
    const activeGoals = this.goalManager.getActiveGoals();
    for (const goal of activeGoals) {
      const goalOptions = await this.generateGoalOptions(goal, context);
      options.push(...goalOptions);
    }

    // Filtrer selon les contraintes
    return this.filterByConstraints(options, context.constraints);
  }

  /**
   * Évalue les options selon plusieurs critères
   */
  private async evaluateOptions(
    options: DecisionOption[],
    context: DecisionContext
  ): Promise<DecisionOption[]> {
    return options.map((option) => {
      // Calculer un score composite
      const benefitScore = this.calculateBenefitScore(option);
      const riskScore = this.calculateRiskScore(option);
      const urgencyScore = this.calculateUrgencyScore(option, context);
      const alignmentScore = this.calculateGoalAlignment(option);

      // Mettre à jour la confiance
      option.confidence =
        benefitScore * 0.3 +
        (1 - riskScore) * 0.3 +
        urgencyScore * 0.2 +
        alignmentScore * 0.2;

      return option;
    });
  }

  /**
   * Sélectionne la meilleure option
   */
  private selectBestOption(options: DecisionOption[]): DecisionOption | null {
    // Filtrer les options sous le seuil de confiance
    const validOptions = options.filter(
      (o) => o.confidence >= this.config.confidenceThreshold
    );

    if (validOptions.length === 0) return null;

    // Trier par confiance décroissante
    validOptions.sort((a, b) => b.confidence - a.confidence);

    // Retourner la meilleure
    return validOptions[0];
  }

  /**
   * Exécute une décision selon son niveau d'autonomie
   */
  private async executeDecision(decision: Decision): Promise<DecisionResult> {
    const { autonomyLevel, selectedOption } = decision;

    switch (autonomyLevel) {
      case "none":
        // Juste logger, ne rien faire
        log.debug(`Decision ${decision.id}: No action taken (autonomy: none)`);
        return {
          decision,
          executed: false,
          userNotified: false,
          ethicsPassed: true,
          timestamp: new Date(),
        };

      case "suggest":
        // Notifier l'utilisateur de la suggestion
        await this.notifyUserSuggestion(decision);
        return {
          decision,
          executed: false,
          userNotified: true,
          ethicsPassed: true,
          timestamp: new Date(),
        };

      case "ask":
        // Demander la permission
        const approved = await this.requestUserApproval(decision);
        if (approved) {
          await this.executeAction(selectedOption);
        }
        return {
          decision,
          executed: approved,
          userNotified: true,
          ethicsPassed: true,
          timestamp: new Date(),
        };

      case "act_with_notice":
        // Exécuter et notifier
        await this.executeAction(selectedOption);
        await this.notifyUserAction(decision);
        return {
          decision,
          executed: true,
          userNotified: true,
          ethicsPassed: true,
          timestamp: new Date(),
        };

      case "full":
        // Exécuter sans notification
        await this.executeAction(selectedOption);
        return {
          decision,
          executed: true,
          userNotified: false,
          ethicsPassed: true,
          timestamp: new Date(),
        };

      default:
        return {
          decision,
          executed: false,
          userNotified: false,
          ethicsPassed: true,
          timestamp: new Date(),
        };
    }
  }

  /**
   * Détermine le niveau d'autonomie approprié pour une décision
   */
  private determineAutonomyLevel(
    option: DecisionOption,
    context: DecisionContext
  ): AutonomyLevel {
    // Commencer avec le niveau configuré
    let level = this.config.autonomyLevel;

    // Ajuster selon les risques
    const maxRisk = Math.max(...option.risks.map((r) => r.probability * this.impactToNumber(r.impact)));
    if (maxRisk > 0.7) {
      level = this.lowerAutonomy(level);
    }

    // Ajuster selon l'urgence
    if (context.urgency === "critical") {
      level = this.raiseAutonomy(level);
    }

    // Ajuster si l'option nécessite une approbation
    if (option.requiresApproval) {
      level = "ask";
    }

    return level;
  }

  /**
   * Met à jour les patterns disponibles pour la prise de décision
   */
  updatePatterns(patterns: LearnedPattern[]): void {
    for (const pattern of patterns) {
      this.patterns.set(pattern.id, pattern);
    }
    log.info(`Updated ${patterns.length} patterns for decision making`);
  }

  /**
   * Apprend du résultat d'une décision
   */
  async learnFromOutcome(
    decisionId: string,
    success: boolean,
    userSatisfaction?: number
  ): Promise<void> {
    const decision = this.decisionHistory.find((d) => d.id === decisionId);
    if (!decision) return;

    decision.outcome = {
      success,
      actualResult: success ? "Success" : "Failure",
      userSatisfaction,
      lessonsLearned: [],
    };

    // Ajuster la confiance des patterns associés
    if (success && userSatisfaction && userSatisfaction > 7) {
      // Renforcer les patterns
      for (const pattern of this.patterns.values()) {
        if (this.matchesPatternDecision(pattern, decision)) {
          pattern.confidence = Math.min(pattern.confidence + 0.05, 1.0);
        }
      }
    } else if (!success) {
      // Réduire la confiance
      for (const pattern of this.patterns.values()) {
        if (this.matchesPatternDecision(pattern, decision)) {
          pattern.confidence = Math.max(pattern.confidence - 0.1, 0);
        }
      }
    }

    log.info(`Learned from outcome of decision ${decisionId}: ${success ? "success" : "failure"}`);
  }

  // ============================================================================
  // Méthodes utilitaires
  // ============================================================================

  private hasExceededDecisionLimit(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentDecisions = this.decisionHistory.filter(
      (d) => d.timestamp > oneHourAgo
    );
    return recentDecisions.length >= this.config.maxDecisionsPerHour;
  }

  private trimDecisionHistory(): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
    const cutoff = new Date(Date.now() - maxAge);
    this.decisionHistory = this.decisionHistory.filter(
      (d) => d.timestamp > cutoff
    );
  }

  private matchesContext(pattern: LearnedPattern, context: DecisionContext): boolean {
    // Vérifier si le pattern correspond au contexte actuel
    const now = new Date();
    const currentHour = now.getHours();

    if (pattern.context.timeOfDay) {
      const patternHour = pattern.context.timeOfDay.hour;
      if (Math.abs(currentHour - patternHour) > 1) {
        return false;
      }
    }

    return true;
  }

  private hasHighImpact(pattern: LearnedPattern): boolean {
    // Déterminer si un pattern a un impact élevé
    const highImpactCommands = ["reboot", "delete", "reset", "update", "restart"];
    const command = pattern.action.command?.toLowerCase() || "";
    return highImpactCommands.some((cmd) => command.includes(cmd));
  }

  private assessRisks(pattern: LearnedPattern, context: DecisionContext): Risk[] {
    const risks: Risk[] = [];

    if (this.hasHighImpact(pattern)) {
      risks.push({
        description: "High impact action that may affect system stability",
        probability: 0.3,
        impact: "medium",
        mitigation: "Create backup before execution",
      });
    }

    if (pattern.confidence < 0.8) {
      risks.push({
        description: "Low confidence in pattern accuracy",
        probability: 0.5,
        impact: "low",
        mitigation: "Verify with user before execution",
      });
    }

    return risks;
  }

  private assessBenefits(pattern: LearnedPattern, context: DecisionContext): Benefit[] {
    const benefits: Benefit[] = [];

    benefits.push({
      description: "Automates a recurring task",
      value: 7,
      category: "convenience",
    });

    if (pattern.frequency > 5) {
      benefits.push({
        description: "Frequently used pattern",
        value: 8,
        category: "productivity",
      });
    }

    return benefits;
  }

  private filterByConstraints(
    options: DecisionOption[],
    constraints: Constraint[]
  ): DecisionOption[] {
    return options.filter((option) => {
      for (const constraint of constraints) {
        if (constraint.hard && this.violatesConstraint(option, constraint)) {
          return false;
        }
      }
      return true;
    });
  }

  private violatesConstraint(option: DecisionOption, constraint: Constraint): boolean {
    // Logique de vérification des contraintes
    if (constraint.type === "time") {
      // Vérifier les contraintes horaires
    }
    return false;
  }

  private calculateBenefitScore(option: DecisionOption): number {
    if (option.benefits.length === 0) return 0.5;
    const totalValue = option.benefits.reduce((sum, b) => sum + b.value, 0);
    return Math.min(totalValue / (option.benefits.length * 10), 1);
  }

  private calculateRiskScore(option: DecisionOption): number {
    if (option.risks.length === 0) return 0;
    const totalRisk = option.risks.reduce(
      (sum, r) => sum + r.probability * this.impactToNumber(r.impact),
      0
    );
    return Math.min(totalRisk / option.risks.length, 1);
  }

  private calculateUrgencyScore(option: DecisionOption, context: DecisionContext): number {
    const urgencyMap = { low: 0.3, medium: 0.5, high: 0.8, critical: 1.0 };
    return urgencyMap[context.urgency];
  }

  private calculateGoalAlignment(option: DecisionOption): number {
    // Vérifier l'alignement avec les objectifs actifs
    const activeGoals = this.goalManager.getActiveGoals();
    if (activeGoals.length === 0) return 0.5;

    // Logique d'alignement simplifiée
    return 0.6;
  }

  private impactToNumber(impact: "low" | "medium" | "high" | "severe"): number {
    const map = { low: 0.25, medium: 0.5, high: 0.75, severe: 1.0 };
    return map[impact];
  }

  private generateReasoning(option: DecisionOption, context: DecisionContext): string {
    const parts: string[] = [];

    parts.push(`Selected action: ${option.action}`);
    parts.push(`Expected outcome: ${option.expectedOutcome}`);
    parts.push(`Confidence: ${(option.confidence * 100).toFixed(1)}%`);

    if (option.benefits.length > 0) {
      parts.push(`Benefits: ${option.benefits.map((b) => b.description).join(", ")}`);
    }

    return parts.join("; ");
  }

  private async generateGoalOptions(
    goal: Goal,
    context: DecisionContext
  ): Promise<DecisionOption[]> {
    const options: DecisionOption[] = [];

    // Générer des options spécifiques à l'objectif
    switch (goal.category) {
      case "health":
        options.push({
          id: randomUUID(),
          action: "suggest_wellness_reminder",
          parameters: { goalId: goal.id },
          expectedOutcome: "Improve user health outcomes",
          risks: [],
          benefits: [{ description: "Health improvement", value: 9, category: "health" }],
          confidence: 0.7,
          requiresApproval: true,
        });
        break;

      case "productivity":
        options.push({
          id: randomUUID(),
          action: "optimize_environment",
          parameters: { goalId: goal.id },
          expectedOutcome: "Create optimal work environment",
          risks: [],
          benefits: [{ description: "Productivity boost", value: 8, category: "productivity" }],
          confidence: 0.75,
          requiresApproval: false,
        });
        break;

      case "home":
        options.push({
          id: randomUUID(),
          action: "automate_home_routine",
          parameters: { goalId: goal.id },
          expectedOutcome: "Automate recurring home tasks",
          risks: [{ description: "May conflict with manual settings", probability: 0.2, impact: "low" }],
          benefits: [{ description: "Convenience", value: 7, category: "convenience" }],
          confidence: 0.8,
          requiresApproval: false,
        });
        break;
    }

    return options;
  }

  private lowerAutonomy(level: AutonomyLevel): AutonomyLevel {
    const levels: AutonomyLevel[] = ["none", "suggest", "ask", "act_with_notice", "full"];
    const index = levels.indexOf(level);
    return index > 0 ? levels[index - 1] : "none";
  }

  private raiseAutonomy(level: AutonomyLevel): AutonomyLevel {
    const levels: AutonomyLevel[] = ["none", "suggest", "ask", "act_with_notice", "full"];
    const index = levels.indexOf(level);
    return index < levels.length - 1 ? levels[index + 1] : "full";
  }

  private async notifyUserSuggestion(decision: Decision): Promise<void> {
    log.info(`Suggestion: ${decision.selectedOption.expectedOutcome}`);
    const bridge: JarvisBridge = getJarvisBridge();
    const message = formatJarvisMessage(
      "suggestion",
      decision.selectedOption.expectedOutcome,
      `Confiance : ${Math.round(decision.selectedOption.confidence * 100)}%`
    );
    await bridge.notify({ message, level: "suggestion", metadata: { decisionId: decision.id } });
  }

  private async notifyUserAction(decision: Decision): Promise<void> {
    log.info(`Action executed: ${decision.selectedOption.expectedOutcome}`);
    const bridge: JarvisBridge = getJarvisBridge();
    const message = formatJarvisMessage(
      "action",
      `Action effectuée : ${decision.selectedOption.expectedOutcome}`
    );
    await bridge.notify({ message, level: "action", metadata: { decisionId: decision.id } });
  }

  private async requestUserApproval(decision: Decision): Promise<boolean> {
    log.info(`Requesting approval for: ${decision.selectedOption.expectedOutcome}`);
    const bridge: JarvisBridge = getJarvisBridge();
    const approved = await bridge.requestApproval({
      question: `Jarvis souhaite effectuer une action autonome :\n\n*${decision.selectedOption.expectedOutcome}*\n\nConfirmez-vous ?`,
      context: `Action : ${decision.selectedOption.action} | Confiance : ${Math.round(decision.selectedOption.confidence * 100)}%`,
      options: ["✅ Oui, procède", "❌ Non, annule"],
      timeoutMs: this.config.userApprovalTimeoutMs,
    });
    log.info(`User approval for decision ${decision.id}: ${approved}`);
    return approved;
  }

  private async executeAction(option: DecisionOption): Promise<void> {
    log.info(`Executing action: ${option.action}`);
    const bridge: JarvisBridge = getJarvisBridge();
    const result = await bridge.execute(option.action, option.parameters ?? {});
    if (!result.success) {
      log.warn(`Action execution failed: ${result.error}`);
    } else {
      log.debug(`Action executed in ${result.executionTimeMs}ms: ${result.output}`);
    }
  }

  private matchesPatternDecision(pattern: LearnedPattern, decision: Decision): boolean {
    return (
      pattern.action.command === decision.selectedOption.action ||
      pattern.action.type === decision.selectedOption.action
    );
  }

  // ============================================================================
  // Getters publics
  // ============================================================================

  getDecisionHistory(): Decision[] {
    return [...this.decisionHistory];
  }

  getRecentDecisions(limit = 10): Decision[] {
    return this.decisionHistory
      .slice(-limit)
      .reverse();
  }
}
