/**
 * Types de configuration pour le système d'autonomie
 */

import type { AutonomyLevel, ApprovalTrigger, ObservationScope } from "../autonomy/types.js";

export type AutonomyConfig = {
  /** Active/désactive le système d'autonomie */
  enabled: boolean;

  /** Niveau d'autonomie par défaut */
  level: AutonomyLevel;

  /** Intervalle d'apprentissage en minutes */
  learningIntervalMinutes: number;

  /** Intervalle de décision en minutes */
  decisionIntervalMinutes: number;

  /** Nombre maximum de décisions autonomes par jour */
  maxDecisionsPerDay: number;

  /** Déclencheurs nécessitant une approbation */
  requireApprovalFor: ApprovalTrigger[];

  /** Scope de l'observation */
  observationScope: ObservationScope;

  /** Canaux sur lesquels l'autonomie est active */
  enabledChannels: string[];

  /** Limite financière pour les décisions autonomes (en euros) */
  maxFinancialImpact: number;

  /** Mode strict pour la vérification éthique */
  strictEthicsMode: boolean;

  /** Notifier l'utilisateur des décisions */
  notifyUserOnDecisions: boolean;
};

export const DEFAULT_AUTONOMY_CONFIG: AutonomyConfig = {
  enabled: true,
  level: "suggest",
  learningIntervalMinutes: 60,
  decisionIntervalMinutes: 30,
  maxDecisionsPerDay: 20,
  requireApprovalFor: [
    "high_impact",
    "irreversible",
    "financial",
    "safety_critical",
  ],
  observationScope: {
    commands: true,
    schedules: true,
    feedback: true,
    environment: false,
    social: false,
  },
  enabledChannels: ["telegram", "discord", "whatsapp", "slack"],
  maxFinancialImpact: 50,
  strictEthicsMode: false,
  notifyUserOnDecisions: true,
};
