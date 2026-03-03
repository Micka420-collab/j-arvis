/**
 * Gestionnaire d'objectifs
 * Crée, suit et optimise les objectifs utilisateur (détectés ou explicites)
 */

import { randomUUID } from "node:crypto";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { Goal, GoalCategory, GoalStatus, UserPreference } from "../types.js";

const log = createSubsystemLogger("autonomy:goals");

export type GoalManagerConfig = {
  maxActiveGoals: number;
  autoCreateGoals: boolean;
  goalReviewIntervalDays: number;
};

const DEFAULT_CONFIG: GoalManagerConfig = {
  maxActiveGoals: 5,
  autoCreateGoals: true,
  goalReviewIntervalDays: 7,
};

export class GoalManager {
  private config: GoalManagerConfig;
  private goals: Map<string, Goal> = new Map();
  private goalHierarchy: Map<string, Set<string>> = new Map(); // goalId -> subGoalIds

  constructor(config: Partial<GoalManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info("GoalManager initialized");
  }

  /**
   * Crée un nouvel objectif
   */
  createGoal(
    title: string,
    description: string,
    category: GoalCategory,
    options: {
      priority?: number;
      deadline?: Date;
      parentGoalId?: string;
      successCriteria?: string[];
      learnedBehavior?: boolean;
    } = {}
  ): Goal {
    const goal: Goal = {
      id: randomUUID(),
      title,
      description,
      category,
      priority: options.priority || 5,
      status: "active",
      createdAt: new Date(),
      deadline: options.deadline,
      progress: 0,
      subGoals: [],
      dependencies: [],
      successCriteria: options.successCriteria || [],
      learnedBehavior: options.learnedBehavior || false,
    };

    this.goals.set(goal.id, goal);
    this.goalHierarchy.set(goal.id, new Set());

    // Ajouter comme sous-objectif si parent spécifié
    if (options.parentGoalId) {
      this.addSubGoal(options.parentGoalId, goal.id);
    }

    log.info(`Created goal: ${title} (${category})`);
    return goal;
  }

  /**
   * Crée un objectif à partir d'une préférence détectée
   */
  createGoalFromPreference(preference: UserPreference): Goal | null {
    const goalMap: Record<string, { title: string; category: GoalCategory }> = {
      preferred_temperature: {
        title: "Confort thermique optimal",
        description: "Maintenir une température agréable",
        category: "home",
      },
      preferred_response_time: {
        title: "Communication efficace",
        description: "Répondre dans les délais préférés",
        category: "personal_growth",
      },
      work_focus_time: {
        title: "Productivité optimale",
        description: "Optimiser les sessions de travail",
        category: "productivity",
      },
      sleep_schedule: {
        title: "Hygiène de sommeil",
        description: "Maintenir un cycle de sommeil régulier",
        category: "health",
      },
    };

    const template = goalMap[preference.key];
    if (!template) return null;

    return this.createGoal(template.title, template.description, template.category, {
      learnedBehavior: true,
      priority: Math.round(preference.confidence * 10),
    });
  }

  /**
   * Met à jour la progression d'un objectif
   */
  updateProgress(goalId: string, progress: number): void {
    const goal = this.goals.get(goalId);
    if (!goal) {
      log.warn(`Goal ${goalId} not found`);
      return;
    }

    goal.progress = Math.max(0, Math.min(100, progress));

    // Mettre à jour le statut si nécessaire
    if (goal.progress === 100 && goal.status !== "completed") {
      goal.status = "completed";
      log.info(`Goal completed: ${goal.title}`);
      this.onGoalCompleted(goal);
    }

    // Mettre à jour la progression du parent
    this.updateParentProgress(goalId);
  }

  /**
   * Marque un objectif comme complété
   */
  completeGoal(goalId: string, notes?: string): void {
    this.updateProgress(goalId, 100);
    
    const goal = this.goals.get(goalId);
    if (goal && notes) {
      log.info(`Goal ${goal.title} completed with notes: ${notes}`);
    }
  }

  /**
   * Met un objectif en pause
   */
  pauseGoal(goalId: string, reason?: string): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.status = "paused";
      log.info(`Goal paused: ${goal.title}${reason ? ` (${reason})` : ""}`);
    }
  }

  /**
   * Reprend un objectif mis en pause
   */
  resumeGoal(goalId: string): void {
    const goal = this.goals.get(goalId);
    if (goal && goal.status === "paused") {
      goal.status = "active";
      log.info(`Goal resumed: ${goal.title}`);
    }
  }

  /**
   * Abandonne un objectif
   */
  abandonGoal(goalId: string, reason?: string): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.status = "abandoned";
      log.info(`Goal abandoned: ${goal.title}${reason ? ` (${reason})` : ""}`);
    }
  }

  /**
   * Ajoute un sous-objectif
   */
  addSubGoal(parentId: string, subGoalId: string): boolean {
    const parent = this.goals.get(parentId);
    const subGoal = this.goals.get(subGoalId);

    if (!parent || !subGoal) {
      log.warn("Cannot add subgoal: parent or subgoal not found");
      return false;
    }

    // Vérifier les cycles
    if (this.wouldCreateCycle(parentId, subGoalId)) {
      log.warn("Cannot add subgoal: would create cycle");
      return false;
    }

    parent.subGoals.push(subGoalId);
    subGoal.dependencies.push(parentId);
    this.goalHierarchy.get(parentId)?.add(subGoalId);

    log.info(`Added subgoal ${subGoal.title} to ${parent.title}`);
    return true;
  }

  /**
   * Ajoute une dépendance entre objectifs
   */
  addDependency(goalId: string, dependsOnId: string): boolean {
    const goal = this.goals.get(goalId);
    const dependency = this.goals.get(dependsOnId);

    if (!goal || !dependency) {
      log.warn("Cannot add dependency: goal or dependency not found");
      return false;
    }

    if (this.wouldCreateCycle(goalId, dependsOnId)) {
      log.warn("Cannot add dependency: would create cycle");
      return false;
    }

    if (!goal.dependencies.includes(dependsOnId)) {
      goal.dependencies.push(dependsOnId);
    }

    return true;
  }

  /**
   * Vérifie si un objectif est débloqué (toutes ses dépendances sont complétées)
   */
  isUnlocked(goalId: string): boolean {
    const goal = this.goals.get(goalId);
    if (!goal) return false;

    for (const depId of goal.dependencies) {
      const dep = this.goals.get(depId);
      if (dep && dep.status !== "completed") {
        return false;
      }
    }

    return true;
  }

  /**
   * Obtient les objectifs actifs
   */
  getActiveGoals(): Goal[] {
    return Array.from(this.goals.values())
      .filter((g) => g.status === "active" && this.isUnlocked(g.id))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Obtient les objectifs par catégorie
   */
  getGoalsByCategory(category: GoalCategory): Goal[] {
    return Array.from(this.goals.values())
      .filter((g) => g.category === category)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Obtient les objectifs déduits automatiquement
   */
  getLearnedGoals(): Goal[] {
    return Array.from(this.goals.values()).filter((g) => g.learnedBehavior);
  }

  /**
   * Obtient l'arbre des objectifs
   */
  getGoalTree(rootId?: string): Array<Goal & { children: Goal[] }> {
    if (rootId) {
      const root = this.goals.get(rootId);
      if (!root) return [];
      return [this.buildGoalTree(root)];
    }

    // Retourner tous les objectifs racine (sans parent)
    const rootGoals = Array.from(this.goals.values()).filter(
      (g) => !g.dependencies.length || g.dependencies.length === 0
    );

    return rootGoals.map((g) => this.buildGoalTree(g));
  }

  /**
   * Suggère de nouveaux objectifs basés sur les patterns
   */
  suggestGoalsFromPatterns(patterns: Array<{ category: string; frequency: number }>): Goal[] {
    const suggestions: Goal[] = [];

    for (const pattern of patterns) {
      if (pattern.frequency >= 5) {
        const category = this.inferCategory(pattern.category);
        const title = this.generateGoalTitle(pattern.category, category);
        
        const existing = Array.from(this.goals.values()).find(
          (g) => g.title === title && g.status !== "abandoned"
        );

        if (!existing) {
          const suggestion = this.createGoal(
            title,
            `Auto-generated goal based on recurring pattern: ${pattern.category}`,
            category,
            { learnedBehavior: true, priority: Math.min(pattern.frequency, 10) }
          );
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions;
  }

  /**
   * Évalue l'accomplissement d'un objectif
   */
  evaluateGoalAchievement(goalId: string): {
    achieved: boolean;
    score: number;
    missingCriteria: string[];
  } {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return { achieved: false, score: 0, missingCriteria: [] };
    }

    if (goal.progress === 100) {
      return { achieved: true, score: 1, missingCriteria: [] };
    }

    // Évaluer les critères de succès en détail
    const missingCriteria: string[] = [];

    // Critère 1 — Progression minimale atteinte
    if (goal.progress < 50) {
      missingCriteria.push(`Progression insuffisante (${goal.progress}% / 50% requis pour démarrage)`);
    }

    // Critère 2 — Objectif non en pause ou abandonné
    if (goal.status === "paused") {
      missingCriteria.push("Objectif en pause — reprendre pour progresser");
    }

    // Critère 3 — Deadline non dépassée
    if (goal.deadline && new Date() > goal.deadline) {
      missingCriteria.push(`Deadline dépassée (${goal.deadline.toLocaleDateString("fr-FR")})`);
    }

    // Critère 4 — Priorité haute avec progression faible
    if (goal.priority === "critical" && goal.progress < 80) {
      missingCriteria.push(`Objectif critique avec progression faible (${goal.progress}% / 80% requis)`);
    }

    // Critère 5 — Absence d'activité récente (> 7 jours)
    const daysSinceUpdate = (Date.now() - goal.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 7) {
      missingCriteria.push(`Aucune activité depuis ${Math.floor(daysSinceUpdate)} jours`);
    }

    const score = goal.progress / 100;
    return { achieved: score >= 0.9 && missingCriteria.length === 0, score, missingCriteria };
  }

  /**
   * Planifie les prochaines étapes pour un objectif
   */
  planNextSteps(goalId: string): Array<{
    description: string;
    estimatedEffort: "low" | "medium" | "high";
    dependencies: string[];
  }> {
    const goal = this.goals.get(goalId);
    if (!goal || goal.status !== "active") {
      return [];
    }

    const steps: Array<{
      description: string;
      estimatedEffort: "low" | "medium" | "high";
      dependencies: string[];
    }> = [];

    // Générer des étapes selon la catégorie
    switch (goal.category) {
      case "health":
        steps.push(
          { description: "Monitor current habits", estimatedEffort: "low", dependencies: [] },
          { description: "Set up reminders", estimatedEffort: "low", dependencies: [] },
          { description: "Track progress", estimatedEffort: "medium", dependencies: ["Set up reminders"] }
        );
        break;

      case "productivity":
        steps.push(
          { description: "Analyze current workflow", estimatedEffort: "low", dependencies: [] },
          { description: "Identify bottlenecks", estimatedEffort: "medium", dependencies: ["Analyze current workflow"] },
          { description: "Implement optimizations", estimatedEffort: "high", dependencies: ["Identify bottlenecks"] }
        );
        break;

      case "home":
        steps.push(
          { description: "Audit current automation", estimatedEffort: "low", dependencies: [] },
          { description: "Identify improvement areas", estimatedEffort: "low", dependencies: [] },
          { description: "Deploy new automations", estimatedEffort: "medium", dependencies: ["Identify improvement areas"] }
        );
        break;
    }

    return steps;
  }

  /**
   * Révise les objectifs (à appeler périodiquement)
   */
  reviewGoals(): {
    completed: Goal[];
    stalled: Goal[];
    abandoned: Goal[];
  } {
    const result = {
      completed: [] as Goal[],
      stalled: [] as Goal[],
      abandoned: [] as Goal[],
    };

    const now = new Date();

    for (const goal of this.goals.values()) {
      // Vérifier les objectifs complétés mais pas marqués
      if (this.evaluateGoalAchievement(goal.id).achieved && goal.status !== "completed") {
        this.completeGoal(goal.id);
        result.completed.push(goal);
      }

      // Détecter les objectifs bloqués (pas de progrès depuis longtemps)
      const daysSinceUpdate =
        (now.getTime() - goal.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      if (goal.status === "active" && daysSinceUpdate > 30 && goal.progress < 10) {
        result.stalled.push(goal);
      }

      // Objectifs abandonnés
      if (goal.status === "abandoned") {
        result.abandoned.push(goal);
      }
    }

    log.info(
      `Goal review: ${result.completed.length} completed, ${result.stalled.length} stalled, ${result.abandoned.length} abandoned`
    );

    return result;
  }

  /**
   * Exporte les objectifs
   */
  exportGoals(): Goal[] {
    return Array.from(this.goals.values());
  }

  /**
   * Importe des objectifs
   */
  importGoals(goals: Goal[]): void {
    for (const goal of goals) {
      this.goals.set(goal.id, goal);
      this.goalHierarchy.set(goal.id, new Set(goal.subGoals));
    }
    log.info(`Imported ${goals.length} goals`);
  }

  // ============================================================================
  // Méthodes privées
  // ============================================================================

  private onGoalCompleted(goal: Goal): void {
    // Notifier les objectifs dépendants
    for (const [id, otherGoal] of this.goals) {
      if (otherGoal.dependencies.includes(goal.id)) {
        log.info(`Goal ${otherGoal.title} dependency satisfied: ${goal.title}`);
      }
    }

    // Si objectif appris, proposer d'en créer un nouveau
    if (goal.learnedBehavior) {
      log.info(`Learned goal ${goal.title} completed. Consider creating a new goal.`);
    }
  }

  private updateParentProgress(subGoalId: string): void {
    for (const [parentId, subGoals] of this.goalHierarchy) {
      if (subGoals.has(subGoalId)) {
        const parent = this.goals.get(parentId);
        if (parent) {
          // Calculer la progression moyenne des sous-objectifs
          let totalProgress = 0;
          for (const sgId of parent.subGoals) {
            const sg = this.goals.get(sgId);
            if (sg) {
              totalProgress += sg.progress;
            }
          }
          parent.progress = Math.round(totalProgress / parent.subGoals.length);
        }
      }
    }
  }

  private buildGoalTree(goal: Goal): Goal & { children: Goal[] } {
    const children: Goal[] = [];
    for (const subGoalId of goal.subGoals) {
      const subGoal = this.goals.get(subGoalId);
      if (subGoal) {
        children.push(this.buildGoalTree(subGoal));
      }
    }
    return { ...goal, children };
  }

  private wouldCreateCycle(fromId: string, toId: string): boolean {
    // Vérifier si toId est un ancêtre de fromId
    const visited = new Set<string>();
    const stack = [toId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === fromId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const goal = this.goals.get(current);
      if (goal) {
        stack.push(...goal.dependencies);
      }
    }

    return false;
  }

  private inferCategory(patternCategory: string): GoalCategory {
    const categoryMap: Record<string, GoalCategory> = {
      health: "health",
      fitness: "health",
      work: "productivity",
      study: "learning",
      social: "social",
      home: "home",
      money: "finance",
      personal: "personal_growth",
    };

    return categoryMap[patternCategory.toLowerCase()] || "inferred";
  }

  private generateGoalTitle(pattern: string, category: GoalCategory): string {
    const templates: Record<GoalCategory, string> = {
      health: `Améliorer ${pattern}`,
      productivity: `Optimiser ${pattern}`,
      learning: `Maîtriser ${pattern}`,
      social: `Développer ${pattern}`,
      home: `Automatiser ${pattern}`,
      finance: `Optimiser ${pattern}`,
      personal_growth: `Progresser en ${pattern}`,
      inferred: `Objectif: ${pattern}`,
    };

    return templates[category] || `Objectif: ${pattern}`;
  }
}
