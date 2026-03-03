/**
 * Planificateur d'actions
 * Planifie et ordonnance les actions autonomes
 */

import { randomUUID } from "node:crypto";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("autonomy:planner");

export type Action = {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
  priority: number; // 1-10
  estimatedDuration: number; // en minutes
  dependencies: string[]; // ids des actions dépendantes
  scheduledTime?: Date;
  deadline?: Date;
  retryCount: number;
  maxRetries: number;
};

export type ActionPlan = {
  id: string;
  goalId?: string;
  description: string;
  actions: Action[];
  createdAt: Date;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  status: "draft" | "scheduled" | "in_progress" | "completed" | "failed";
};

export type ExecutionResult = {
  actionId: string;
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number; // en ms
  timestamp: Date;
};

export class ActionPlanner {
  private plans: Map<string, ActionPlan> = new Map();
  private actionQueue: Action[] = [];
  private executionHistory: ExecutionResult[] = [];

  /**
   * Crée un plan d'actions à partir d'un objectif
   */
  createPlan(
    description: string,
    goalId?: string,
    initialActions?: Omit<Action, "id" | "retryCount">[]
  ): ActionPlan {
    const actions: Action[] = (initialActions || []).map((a) => ({
      ...a,
      id: randomUUID(),
      retryCount: 0,
    }));

    const plan: ActionPlan = {
      id: randomUUID(),
      goalId,
      description,
      actions,
      createdAt: new Date(),
      status: "draft",
    };

    this.plans.set(plan.id, plan);
    log.info(`Created plan: ${description} (${actions.length} actions)`);
    return plan;
  }

  /**
   * Ajoute une action à un plan
   */
  addAction(
    planId: string,
    action: Omit<Action, "id" | "retryCount">
  ): Action | null {
    const plan = this.plans.get(planId);
    if (!plan) {
      log.warn(`Plan ${planId} not found`);
      return null;
    }

    const newAction: Action = {
      ...action,
      id: randomUUID(),
      retryCount: 0,
    };

    plan.actions.push(newAction);
    return newAction;
  }

  /**
   * Ordonnance les actions selon les dépendances
   */
  schedulePlan(planId: string, startTime?: Date): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    // Trier topologiquement selon les dépendances
    const sorted = this.topologicalSort(plan.actions);
    if (!sorted) {
      log.error(`Circular dependencies detected in plan ${planId}`);
      return false;
    }

    plan.actions = sorted;

    // Calculer les horaires
    let currentTime = startTime || new Date();
    for (const action of plan.actions) {
      action.scheduledTime = new Date(currentTime);
      currentTime = new Date(currentTime.getTime() + action.estimatedDuration * 60000);
    }

    plan.scheduledStart = plan.actions[0]?.scheduledTime;
    plan.scheduledEnd = plan.actions[plan.actions.length - 1]?.scheduledTime;
    plan.status = "scheduled";

    // Ajouter à la file d'attente globale
    this.actionQueue.push(...plan.actions);
    this.sortQueue();

    log.info(`Scheduled plan ${planId}: ${plan.actions.length} actions`);
    return true;
  }

  /**
   * Exécute le prochain lot d'actions
   */
  async executeNextBatch(batchSize = 1): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    // Filtrer les actions prêtes (dépendances satisfaites)
    const readyActions = this.actionQueue
      .filter((a) => this.areDependenciesMet(a))
      .slice(0, batchSize);

    for (const action of readyActions) {
      const result = await this.executeAction(action);
      results.push(result);

      // Retirer de la file
      const index = this.actionQueue.indexOf(action);
      if (index > -1) {
        this.actionQueue.splice(index, 1);
      }

      // Mettre à jour le statut du plan
      this.updatePlanStatus(action);
    }

    return results;
  }

  /**
   * Exécute une action spécifique
   */
  private async executeAction(action: Action): Promise<ExecutionResult> {
    const startTime = Date.now();
    log.info(`Executing action: ${action.type}`);

    try {
      // Simuler l'exécution (à remplacer par l'intégration réelle)
      const result = await this.simulateExecution(action);

      const executionResult: ExecutionResult = {
        actionId: action.id,
        success: result.success,
        output: result.output,
        error: result.error,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };

      this.executionHistory.push(executionResult);

      // Retry si échec
      if (!result.success && action.retryCount < action.maxRetries) {
        action.retryCount++;
        this.actionQueue.push(action);
        this.sortQueue();
        log.warn(`Action ${action.id} failed, retry ${action.retryCount}/${action.maxRetries}`);
      }

      return executionResult;
    } catch (error) {
      return {
        actionId: action.id,
        success: false,
        error: String(error),
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Exécute une action via le bridge Jarvis réel
   */
  private async simulateExecution(
    action: Action
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const { getJarvisBridge } = await import("../jarvis-bridge.js");
    const bridge = getJarvisBridge();
    const result = await bridge.execute(action.type, action.parameters ?? {});
    return {
      success: result.success,
      output: result.output,
      error: result.error,
    };
  }

  /**
   * Annule un plan
   */
  cancelPlan(planId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    // Retirer les actions de la file
    for (const action of plan.actions) {
      const index = this.actionQueue.indexOf(action);
      if (index > -1) {
        this.actionQueue.splice(index, 1);
      }
    }

    plan.status = "failed";
    log.info(`Cancelled plan ${planId}`);
    return true;
  }

  /**
   * Obtient les plans actifs
   */
  getActivePlans(): ActionPlan[] {
    return Array.from(this.plans.values()).filter(
      (p) => p.status === "draft" || p.status === "scheduled" || p.status === "in_progress"
    );
  }

  /**
   * Obtient l'historique d'exécution
   */
  getExecutionHistory(actionId?: string): ExecutionResult[] {
    if (actionId) {
      return this.executionHistory.filter((r) => r.actionId === actionId);
    }
    return [...this.executionHistory];
  }

  /**
   * Optimise un plan existant
   */
  optimizePlan(planId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    // Fusionner les actions similaires consécutives
    const optimized: Action[] = [];
    for (const action of plan.actions) {
      const last = optimized[optimized.length - 1];
      if (last && last.type === action.type && this.canMerge(last, action)) {
        // Fusionner
        last.parameters = { ...last.parameters, ...action.parameters };
        last.estimatedDuration += action.estimatedDuration;
        last.priority = Math.max(last.priority, action.priority);
      } else {
        optimized.push({ ...action });
      }
    }

    plan.actions = optimized;
    log.info(`Optimized plan ${planId}: ${plan.actions.length} actions remaining`);
    return true;
  }

  // ============================================================================
  // Méthodes privées
  // ============================================================================

  private topologicalSort(actions: Action[]): Action[] | null {
    const sorted: Action[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (action: Action): boolean => {
      if (temp.has(action.id)) return false; // Cycle détecté
      if (visited.has(action.id)) return true;

      temp.add(action.id);

      for (const depId of action.dependencies) {
        const dep = actions.find((a) => a.id === depId);
        if (dep && !visit(dep)) return false;
      }

      temp.delete(action.id);
      visited.add(action.id);
      sorted.push(action);
      return true;
    };

    for (const action of actions) {
      if (!visit(action)) return null;
    }

    return sorted.reverse();
  }

  private areDependenciesMet(action: Action): boolean {
    for (const depId of action.dependencies) {
      const depResults = this.executionHistory.filter(
        (r) => r.actionId === depId && r.success
      );
      if (depResults.length === 0) return false;
    }
    return true;
  }

  private sortQueue(): void {
    this.actionQueue.sort((a, b) => {
      // Priorité d'abord
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Puis l'heure programmée
      if (a.scheduledTime && b.scheduledTime) {
        return a.scheduledTime.getTime() - b.scheduledTime.getTime();
      }
      return 0;
    });
  }

  private updatePlanStatus(action: Action): void {
    for (const plan of this.plans.values()) {
      if (plan.actions.some((a) => a.id === action.id)) {
        const allCompleted = plan.actions.every(
          (a) =>
            this.executionHistory.some((r) => r.actionId === a.id && r.success) ||
            a.id !== action.id
        );

        if (allCompleted) {
          plan.status = "completed";
        } else if (plan.status === "scheduled") {
          plan.status = "in_progress";
        }
      }
    }
  }

  private canMerge(a: Action, b: Action): boolean {
    // Vérifier si deux actions peuvent être fusionnées
    return (
      Object.keys(a.parameters).length + Object.keys(b.parameters).length <= 5
    );
  }
}
