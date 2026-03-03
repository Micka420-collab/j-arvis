/**
 * Types pour l'interface de visualisation de l'autonomie
 */

export type AutonomyStats = {
  patternsLearned: number;
  goalsInferred: number;
  preferencesLearned: number;
  knowledgeNodes: number;
  decisionsMade: number;
  learningProgress: number;
};

export type PatternView = {
  id: string;
  name: string;
  description: string;
  confidence: number;
  frequency: number;
  lastTriggered: string;
  action: string;
  trend: "up" | "down" | "stable";
};

export type GoalView = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: number;
  progress: number;
  status: "active" | "paused" | "completed" | "failed";
  learned: boolean;
  deadline?: string;
  subGoals: number;
};

export type KnowledgeNodeView = {
  id: string;
  type: "preference" | "habit" | "fact" | "relationship" | "goal" | "constraint";
  label: string;
  confidence: number;
  connections: number;
  createdAt: string;
};

export type DecisionView = {
  id: string;
  timestamp: string;
  action: string;
  reasoning: string;
  confidence: number;
  autonomyLevel: string;
  executed: boolean;
  userFeedback?: "positive" | "negative" | "corrected";
};

export type TimelineEvent = {
  id: string;
  timestamp: string;
  type: "pattern_learned" | "decision_made" | "goal_inferred" | "feedback_given";
  title: string;
  description: string;
  data?: unknown;
};

export type AutonomyConfig = {
  enabled: boolean;
  level: "none" | "suggest" | "ask" | "act_with_notice" | "full";
  learningIntervalMinutes: number;
  decisionIntervalMinutes: number;
  maxDecisionsPerDay: number;
};
