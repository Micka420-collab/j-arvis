/**
 * Module de visualisation de l'autonomie
 * Exporte tous les composants de l'interface
 */

// Composants
export { AutonomyDashboard } from "./autonomy-dashboard.js";
export { AutonomyPatternsView } from "./patterns-view.js";
export { AutonomyGoalsView } from "./goals-view.js";
export { AutonomyKnowledgeView } from "./knowledge-view.js";
export { AutonomyDecisionsView } from "./decisions-view.js";
export { AutonomyTimelineView } from "./timeline-view.js";

// Types
export type {
  AutonomyStats,
  PatternView,
  GoalView,
  KnowledgeNodeView,
  DecisionView,
  TimelineEvent,
  AutonomyConfig,
} from "./types.js";
