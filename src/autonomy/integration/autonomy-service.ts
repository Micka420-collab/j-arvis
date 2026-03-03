/**
 * Service d'autonomie principal
 * Intègre tous les modules d'auto-apprentissage et de décision autonome
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { OpenClawConfig } from "../../config/config.js";
import { LearningEngine } from "../learning/learning-engine.js";
import { DecisionEngine } from "../decision/decision-engine.js";
import { GoalManager } from "../decision/goal-manager.js";
import { EthicsGuard } from "../decision/ethics-guard.js";
import { ActionPlanner } from "../decision/action-planner.js";
import { BehaviorObserver } from "../observation/behavior-observer.js";
import { KnowledgeGraph } from "../learning/knowledge-graph.js";
import { ProactiveEngine } from "../proactive-engine.js";
import type {
  LearningEvent,
  LearnedPattern,
  Decision,
  DecisionContext,
  Goal,
  UserPreference,
  AutonomyConfig,
  AutonomyLevel,
} from "../types.js";

const log = createSubsystemLogger("autonomy:service");

export type AutonomyServiceConfig = {
  enabled: boolean;
  autonomyLevel: AutonomyLevel;
  learningIntervalMinutes: number;
  decisionIntervalMinutes: number;
  maxDecisionsPerDay: number;
};

const DEFAULT_SERVICE_CONFIG: AutonomyServiceConfig = {
  enabled: true,
  autonomyLevel: "suggest",
  learningIntervalMinutes: 60,
  decisionIntervalMinutes: 30,
  maxDecisionsPerDay: 20,
};

export class AutonomyService {
  private config: AutonomyServiceConfig;
  private learningEngine: LearningEngine;
  private decisionEngine: DecisionEngine;
  private goalManager: GoalManager;
  private ethicsGuard: EthicsGuard;
  private actionPlanner: ActionPlanner;
  private behaviorObserver: BehaviorObserver;
  private knowledgeGraph: KnowledgeGraph;
  private proactiveEngine: ProactiveEngine;

  private learningInterval: ReturnType<typeof setInterval> | null = null;
  private decisionInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(config: Partial<AutonomyServiceConfig> = {}) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };

    // Initialiser les composants
    this.ethicsGuard = new EthicsGuard({ strictMode: false });
    this.goalManager = new GoalManager({ autoCreateGoals: true });
    this.learningEngine = new LearningEngine();
    this.decisionEngine = new DecisionEngine(
      { autonomyLevel: this.config.autonomyLevel },
      this.ethicsGuard,
      this.goalManager
    );
    this.actionPlanner = new ActionPlanner();
    this.behaviorObserver = new BehaviorObserver({ anonymizeData: true });
    // KnowledgeGraph avec persistance disque automatique
    this.knowledgeGraph = new KnowledgeGraph();
    // Moteur de suggestions proactives style Jarvis
    this.proactiveEngine = new ProactiveEngine();

    // Connecter l'observateur au moteur d'apprentissage
    this.behaviorObserver.onEvent((event) => {
      this.handleObservedEvent(event);
    });

    log.info("AutonomyService initialisé — Jarvis est prêt, Monsieur.");
  }

  /**
   * Démarre le service d'autonomie
   */
  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    log.info("AutonomyService starting...");

    // Démarrer les intervalles
    this.learningInterval = setInterval(
      () => this.runLearningCycle(),
      this.config.learningIntervalMinutes * 60 * 1000
    );

    this.decisionInterval = setInterval(
      () => this.runDecisionCycle(),
      this.config.decisionIntervalMinutes * 60 * 1000
    );

    // Démarrer le moteur proactif
    this.proactiveEngine.start();

    // Cycle initial
    await this.runLearningCycle();
    await this.runDecisionCycle();

    log.info("AutonomyService démarré — Jarvis est en ligne, Monsieur.");
  }

  /**
   * Arrête le service d'autonomie
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    log.info("AutonomyService stopping...");

    if (this.learningInterval) {
      clearInterval(this.learningInterval);
      this.learningInterval = null;
    }

    if (this.decisionInterval) {
      clearInterval(this.decisionInterval);
      this.decisionInterval = null;
    }

    this.behaviorObserver.stop();
    this.proactiveEngine.stop();
    // Sauvegarder le graphe de connaissances avant de s'arrêter
    this.knowledgeGraph.saveToDisk();

    log.info("AutonomyService arrêté — À bientôt, Monsieur.");
  }

  /**
   * Traite une interaction utilisateur
   */
  async processInteraction(
    userId: string,
    command: string,
    parameters: Record<string, unknown>,
    source: "telegram" | "discord" | "whatsapp" | "slack" | "web"
  ): Promise<void> {
    // Capturer l'événement
    const event = this.behaviorObserver.captureCommand(
      userId,
      command,
      parameters,
      source,
      {
        timeOfDay: {
          hour: new Date().getHours(),
          minute: new Date().getMinutes(),
        },
        dayOfWeek: new Date().getDay(),
      }
    );

    // Traiter immédiatement pour feedback rapide
    await this.learningEngine.processEvent(event);
  }

  /**
   * Enregistre un feedback utilisateur
   */
  async recordFeedback(
    userId: string,
    originalAction: string,
    feedback: "positive" | "negative" | "corrected",
    correction?: string
  ): Promise<void> {
    const event = this.behaviorObserver.captureFeedback(
      userId,
      originalAction,
      feedback,
      correction
    );

    await this.learningEngine.processEvent(event);

    // Mettre à jour les décisions récentes si correction
    if (feedback === "corrected") {
      const recentDecisions = this.decisionEngine.getRecentDecisions(5);
      for (const decision of recentDecisions) {
        if (decision.selectedOption.action === originalAction) {
          await this.decisionEngine.learnFromOutcome(
            decision.id,
            false,
            feedback === "positive" ? 10 : 3
          );
        }
      }
    }
  }

  /**
   * Demande une décision autonome
   */
  async requestDecision(
    context: DecisionContext
  ): Promise<{ decision: Decision | null; message: string }> {
    const result = await this.decisionEngine.evaluateAndDecide(context);

    if (!result) {
      return { decision: null, message: "Aucune décision requise pour le moment." };
    }

    let message = "";
    if (result.executed) {
      message = `✅ Action autonome exécutée: ${result.decision.selectedOption.expectedOutcome}`;
    } else if (result.userNotified) {
      message = `💡 Suggestion: ${result.decision.selectedOption.expectedOutcome}`;
    } else {
      message = `⏳ Décision en attente: ${result.decision.selectedOption.expectedOutcome}`;
    }

    return { decision: result.decision, message };
  }

  /**
   * Obtient les statistiques d'apprentissage
   */
  getLearningStats(): {
    patternsLearned: number;
    goalsInferred: number;
    preferencesLearned: number;
    knowledgeNodes: number;
  } {
    return {
      patternsLearned: this.learningEngine.getPatterns().length,
      goalsInferred: this.goalManager.getLearnedGoals().length,
      preferencesLearned: this.learningEngine.getPreferences().length,
      knowledgeNodes: this.knowledgeGraph.getStats().nodeCount,
    };
  }

  /**
   * Obtient les objectifs actifs
   */
  getActiveGoals(): Goal[] {
    return this.goalManager.getActiveGoals();
  }

  /**
   * Obtient les patterns appris
   */
  getLearnedPatterns(): LearnedPattern[] {
    return this.learningEngine.getPatterns();
  }

  /**
   * Obtient les préférences utilisateur
   */
  getUserPreferences(): UserPreference[] {
    return this.learningEngine.getPreferences();
  }

  /**
   * Configure le niveau d'autonomie
   */
  setAutonomyLevel(level: AutonomyLevel): void {
    this.config.autonomyLevel = level;
    // Recréer le decision engine avec le nouveau niveau
    this.decisionEngine = new DecisionEngine(
      { autonomyLevel: level },
      this.ethicsGuard,
      this.goalManager
    );
    log.info(`Autonomy level changed to: ${level}`);
  }

  /**
   * Exporte toutes les données d'apprentissage
   */
  exportData(): {
    patterns: LearnedPattern[];
    goals: Goal[];
    preferences: UserPreference[];
    knowledge: { nodes: unknown[]; edges: unknown[] };
  } {
    return {
      patterns: this.learningEngine.getPatterns(),
      goals: this.goalManager.exportGoals(),
      preferences: this.learningEngine.getPreferences(),
      knowledge: this.knowledgeGraph.export(),
    };
  }

  /**
   * Importe des données d'apprentissage
   */
  importData(data: {
    patterns?: LearnedPattern[];
    goals?: Goal[];
    preferences?: UserPreference[];
    knowledge?: { nodes: unknown[]; edges: unknown[] };
  }): void {
    if (data.patterns) {
      this.decisionEngine.updatePatterns(data.patterns);
    }
    if (data.goals) {
      this.goalManager.importGoals(data.goals);
    }
    if (data.knowledge) {
      this.knowledgeGraph.import(data.knowledge);
    }
    log.info("Learning data imported");
  }

  // ============================================================================
  // Cycles périodiques
  // ============================================================================

  private async runLearningCycle(): Promise<void> {
    log.debug("Running learning cycle...");

    try {
      // Flusher les événements observés
      const events = this.behaviorObserver.flush();

      // Traiter les événements
      for (const event of events) {
        await this.learningEngine.processEvent(event);
      }

      // Analyse périodique
      const result = await this.learningEngine.runPeriodicAnalysis();

      // Mettre à jour le graphe de connaissances
      for (const pattern of result.patternsDetected) {
        this.knowledgeGraph.addNode("habit", pattern.name, pattern, pattern.confidence);
      }

      // Créer des objectifs à partir des patterns
      if (result.patternsDetected.length > 0) {
        const suggestedGoals = this.goalManager.suggestGoalsFromPatterns(
          result.patternsDetected.map((p) => ({
            category: p.name,
            frequency: p.frequency,
          }))
        );
        log.info(`Suggested ${suggestedGoals.length} new goals from patterns`);
      }

      // Créer des objectifs à partir des préférences
      for (const pref of result.preferencesUpdated) {
        const goal = this.goalManager.createGoalFromPreference(pref);
        if (goal) {
          this.knowledgeGraph.addNode("preference", pref.key, pref, pref.confidence);
        }
      }

      // Inférer de nouvelles relations
      this.knowledgeGraph.inferRelations();

      log.debug("Learning cycle completed");
    } catch (error) {
      log.error(`Learning cycle error: ${error}`);
    }
  }

  private async runDecisionCycle(): Promise<void> {
    log.debug("Running decision cycle...");

    try {
      // Mettre à jour les patterns dans le moteur de décision
      const patterns = this.learningEngine.getPatterns();
      this.decisionEngine.updatePatterns(patterns);

      // Vérifier les objectifs actifs pour des opportunités de décision
      const activeGoals = this.goalManager.getActiveGoals();

      for (const goal of activeGoals.slice(0, 3)) {
        // Limiter à 3 objectifs par cycle
        const context: DecisionContext = {
          userId: "default",
          currentState: { goalId: goal.id, goalCategory: goal.category },
          availableTools: ["domotic", "messaging", "scheduler"],
          constraints: [
            { type: "time", description: "Respect user schedule", hard: true },
            { type: "ethical", description: "Respect user autonomy", hard: true },
          ],
          urgency: this.assessUrgency(goal),
        };

        const result = await this.decisionEngine.evaluateAndDecide(context);

        if (result && result.executed) {
          log.info(`Autonomous decision executed for goal: ${goal.title}`);

          // Capturer le résultat
          this.behaviorObserver.captureDecisionOutcome(
            result.decision.id,
            true,
            undefined,
            [`Decision for goal: ${goal.title}`]
          );
        }
      }

      // Réviser les objectifs
      const review = this.goalManager.reviewGoals();
      if (review.completed.length > 0) {
        for (const goal of review.completed) {
          this.behaviorObserver.captureGoalAchievement(goal.id, true, []);
        }
      }

      log.debug("Decision cycle completed");
    } catch (error) {
      log.error(`Decision cycle error: ${error}`);
    }
  }

  private async handleObservedEvent(event: LearningEvent): Promise<void> {
    // Traitement en temps réel des événements si nécessaire
    log.debug(`Real-time event processing: ${event.type}`);
  }

  private assessUrgency(goal: Goal): DecisionContext["urgency"] {
    if (goal.deadline) {
      const daysUntilDeadline =
        (goal.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      if (daysUntilDeadline < 1) return "critical";
      if (daysUntilDeadline < 3) return "high";
    }
    return "medium";
  }
}
