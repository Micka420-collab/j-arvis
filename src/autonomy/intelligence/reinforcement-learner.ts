/**
 * Apprentissage par Renforcement (Q-Learning simplifié)
 * Optimise les décisions basées sur le feedback utilisateur
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("autonomy:reinforcement");

export type State = string;
export type Action = string;

export type QTableEntry = {
  state: State;
  action: Action;
  qValue: number;
  visitCount: number;
  lastUpdated: Date;
};

export type Reward = {
  state: State;
  action: Action;
  value: number; // -1 à 1
  timestamp: Date;
  context?: string;
};

export type RLConfig = {
  learningRate: number; // Alpha: 0-1
  discountFactor: number; // Gamma: 0-1
  explorationRate: number; // Epsilon: 0-1
  explorationDecay: number;
  minExplorationRate: number;
};

const DEFAULT_CONFIG: RLConfig = {
  learningRate: 0.1,
  discountFactor: 0.9,
  explorationRate: 0.3,
  explorationDecay: 0.995,
  minExplorationRate: 0.05,
};

export class ReinforcementLearner {
  private qTable: Map<string, QTableEntry> = new Map();
  private rewards: Reward[] = [];
  private config: RLConfig;
  private stateHistory: State[] = [];

  constructor(config: Partial<RLConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Choisit une action basée sur la politique epsilon-greedy
   */
  chooseAction(state: State, availableActions: Action[]): Action {
    // Exploration: choisir aléatoirement
    if (Math.random() < this.config.explorationRate) {
      const randomAction =
        availableActions[Math.floor(Math.random() * availableActions.length)];
      log.debug(`Exploring: chose random action ${randomAction}`);
      return randomAction;
    }

    // Exploitation: choisir la meilleure action connue
    let bestAction = availableActions[0];
    let bestQValue = -Infinity;

    for (const action of availableActions) {
      const qValue = this.getQValue(state, action);
      if (qValue > bestQValue) {
        bestQValue = qValue;
        bestAction = action;
      }
    }

    log.debug(`Exploiting: chose best action ${bestAction} (Q=${bestQValue.toFixed(2)})`);
    return bestAction;
  }

  /**
   * Met à jour la Q-table avec un reward
   */
  learn(reward: Reward): void {
    const key = this.getKey(reward.state, reward.action);
    const entry = this.qTable.get(key);

    if (!entry) {
      // Première visite
      this.qTable.set(key, {
        state: reward.state,
        action: reward.action,
        qValue: reward.value,
        visitCount: 1,
        lastUpdated: new Date(),
      });
    } else {
      // Mise à jour Q-learning
      const oldQ = entry.qValue;
      const newQ =
        oldQ +
        this.config.learningRate *
          (reward.value + this.config.discountFactor * this.getMaxFutureQ(reward.state) - oldQ);

      entry.qValue = newQ;
      entry.visitCount++;
      entry.lastUpdated = new Date();

      log.debug(
        `Updated Q(${reward.state}, ${reward.action}): ${oldQ.toFixed(2)} -> ${newQ.toFixed(2)}`
      );
    }

    this.rewards.push(reward);
    this.stateHistory.push(reward.state);

    // Décroissance de l'exploration
    this.decayExploration();
  }

  /**
   * Convertit le feedback utilisateur en reward
   */
  feedbackToReward(
    state: State,
    action: Action,
    feedback: "positive" | "negative" | "neutral" | "corrected",
    correction?: string
  ): Reward {
    const rewardValues: Record<string, number> = {
      positive: 1.0,
      neutral: 0.0,
      negative: -1.0,
      corrected: -0.5, // Moins pénalisant que négatif car l'intention était bonne
    };

    return {
      state,
      action,
      value: rewardValues[feedback],
      timestamp: new Date(),
      context: correction,
    };
  }

  /**
   * Obtient la valeur Q pour un état-action
   */
  getQValue(state: State, action: Action): number {
    const key = this.getKey(state, action);
    return this.qTable.get(key)?.qValue ?? 0;
  }

  /**
   * Obtient les meilleures actions pour un état
   */
  getBestActions(state: State, topN: number = 3): Array<{ action: Action; qValue: number }> {
    const actions: Array<{ action: Action; qValue: number }> = [];

    for (const [key, entry] of this.qTable) {
      if (entry.state === state) {
        actions.push({ action: entry.action, qValue: entry.qValue });
      }
    }

    return actions
      .sort((a, b) => b.qValue - a.qValue)
      .slice(0, topN);
  }

  /**
   * Analyse les patterns de reward
   */
  analyzeRewardPatterns(): {
    bestState: State | null;
    worstState: State | null;
    bestAction: Action | null;
    worstAction: Action | null;
    averageReward: number;
    totalLearnings: number;
  } {
    if (this.rewards.length === 0) {
      return {
        bestState: null,
        worstState: null,
        bestAction: null,
        worstAction: null,
        averageReward: 0,
        totalLearnings: 0,
      };
    }

    // Agréger par état
    const stateRewards = new Map<State, number[]>();
    const actionRewards = new Map<Action, number[]>();

    for (const reward of this.rewards) {
      if (!stateRewards.has(reward.state)) {
        stateRewards.set(reward.state, []);
      }
      stateRewards.get(reward.state)!.push(reward.value);

      if (!actionRewards.has(reward.action)) {
        actionRewards.set(reward.action, []);
      }
      actionRewards.get(reward.action)!.push(reward.value);
    }

    // Calculer les moyennes
    const stateAvgs = Array.from(stateRewards.entries()).map(([state, values]) => ({
      state,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    }));

    const actionAvgs = Array.from(actionRewards.entries()).map(([action, values]) => ({
      action,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    }));

    stateAvgs.sort((a, b) => b.avg - a.avg);
    actionAvgs.sort((a, b) => b.avg - a.avg);

    const avgReward =
      this.rewards.reduce((sum, r) => sum + r.value, 0) / this.rewards.length;

    return {
      bestState: stateAvgs[0]?.state ?? null,
      worstState: stateAvgs[stateAvgs.length - 1]?.state ?? null,
      bestAction: actionAvgs[0]?.action ?? null,
      worstAction: actionAvgs[actionAvgs.length - 1]?.action ?? null,
      averageReward: avgReward,
      totalLearnings: this.rewards.length,
    };
  }

  /**
   * Génère une politique optimale basée sur les apprentissages
   */
  generatePolicy(): Map<State, Action> {
    const policy = new Map<State, Action>();
    const states = new Set(this.stateHistory);

    for (const state of states) {
      const bestActions = this.getBestActions(state, 1);
      if (bestActions.length > 0 && bestActions[0].qValue > 0) {
        policy.set(state, bestActions[0].action);
      }
    }

    return policy;
  }

  /**
   * Exporte la Q-table pour persistance
   */
  exportQTable(): QTableEntry[] {
    return Array.from(this.qTable.values());
  }

  /**
   * Importe une Q-table
   */
  importQTable(entries: QTableEntry[]): void {
    for (const entry of entries) {
      const key = this.getKey(entry.state, entry.action);
      this.qTable.set(key, {
        ...entry,
        lastUpdated: new Date(entry.lastUpdated),
      });
    }
  }

  /**
   * Réinitialise l'exploration (après une longue période d'apprentissage)
   */
  resetExploration(): void {
    this.config.explorationRate = DEFAULT_CONFIG.explorationRate;
    log.info("Exploration rate reset");
  }

  /**
   * Obtient des statistiques d'apprentissage
   */
  getStats(): {
    totalStates: number;
    totalActions: number;
    totalEntries: number;
    averageQValue: number;
    explorationRate: number;
  } {
    const states = new Set<string>();
    const actions = new Set<string>();
    let qSum = 0;

    for (const entry of this.qTable.values()) {
      states.add(entry.state);
      actions.add(entry.action);
      qSum += entry.qValue;
    }

    return {
      totalStates: states.size,
      totalActions: actions.size,
      totalEntries: this.qTable.size,
      averageQValue: this.qTable.size > 0 ? qSum / this.qTable.size : 0,
      explorationRate: this.config.explorationRate,
    };
  }

  // ============================================================================
  // Méthodes privées
  // ============================================================================

  private getKey(state: State, action: Action): string {
    return `${state}::${action}`;
  }

  private getMaxFutureQ(state: State): number {
    let maxQ = 0;
    for (const [key, entry] of this.qTable) {
      if (entry.state === state && entry.qValue > maxQ) {
        maxQ = entry.qValue;
      }
    }
    return maxQ;
  }

  private decayExploration(): void {
    this.config.explorationRate = Math.max(
      this.config.minExplorationRate,
      this.config.explorationRate * this.config.explorationDecay
    );
  }
}
