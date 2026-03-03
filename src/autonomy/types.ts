/**
 * Types pour le système d'autonomie de Jarvis
 * Auto-apprentissage et prise de décision autonome
 */

// ============================================================================
// Types d'apprentissage
// ============================================================================

export type LearningEvent = {
  id: string;
  timestamp: Date;
  type: LearningEventType;
  source: EventSource;
  payload: unknown;
  metadata?: Record<string, unknown>;
};

export type LearningEventType =
  | "user_command"
  | "user_feedback"
  | "system_event"
  | "interaction_pattern"
  | "decision_outcome"
  | "goal_achievement";

export type EventSource =
  | "telegram"
  | "discord"
  | "whatsapp"
  | "slack"
  | "cron"
  | "hook"
  | "internal";

export type LearnedPattern = {
  id: string;
  name: string;
  description: string;
  confidence: number; // 0-1
  frequency: number;
  firstObserved: Date;
  lastObserved: Date;
  context: PatternContext;
  action: PatternAction;
};

export type PatternContext = {
  timeOfDay?: { hour: number; minute: number };
  dayOfWeek?: number;
  location?: string;
  precedingEvents?: string[];
  userState?: string;
  environmentalFactors?: Record<string, unknown>;
};

export type PatternAction = {
  type: "suggest" | "execute" | "notify";
  command?: string;
  message?: string;
  parameters?: Record<string, unknown>;
};

// ============================================================================
// Types de graphe de connaissances
// ============================================================================

export type KnowledgeNode = {
  id: string;
  type: KnowledgeNodeType;
  label: string;
  data: unknown;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
};

export type KnowledgeNodeType =
  | "preference"
  | "habit"
  | "fact"
  | "relationship"
  | "goal"
  | "constraint"
  | "emotion";

export type KnowledgeEdge = {
  id: string;
  source: string; // node id
  target: string; // node id
  type: EdgeType;
  weight: number; // 0-1
  metadata?: Record<string, unknown>;
};

export type EdgeType =
  | "causes"
  | "enables"
  | "contradicts"
  | "similar_to"
  | "precedes"
  | "depends_on"
  | "belongs_to";

// ============================================================================
// Types de décision
// ============================================================================

export type Decision = {
  id: string;
  timestamp: Date;
  context: DecisionContext;
  options: DecisionOption[];
  selectedOption: DecisionOption;
  reasoning: string;
  confidence: number;
  autonomyLevel: AutonomyLevel;
  userOverride?: boolean;
  outcome?: DecisionOutcome;
};

export type DecisionContext = {
  userId: string;
  sessionId?: string;
  currentState: Record<string, unknown>;
  availableTools: string[];
  constraints: Constraint[];
  urgency: "low" | "medium" | "high" | "critical";
};

export type DecisionOption = {
  id: string;
  action: string;
  parameters: Record<string, unknown>;
  expectedOutcome: string;
  risks: Risk[];
  benefits: Benefit[];
  confidence: number;
  requiresApproval: boolean;
};

export type Risk = {
  description: string;
  probability: number; // 0-1
  impact: "low" | "medium" | "high" | "severe";
  mitigation?: string;
};

export type Benefit = {
  description: string;
  value: number; // score 0-10
  category: "convenience" | "health" | "productivity" | "security" | "comfort";
};

export type Constraint = {
  type: "time" | "resource" | "permission" | "ethical" | "safety";
  description: string;
  hard: boolean; // true = ne peut pas être violée
};

export type DecisionOutcome = {
  success: boolean;
  actualResult: string;
  userSatisfaction?: number; // 0-10
  lessonsLearned: string[];
};

export type AutonomyLevel = "none" | "suggest" | "ask" | "act_with_notice" | "full";

// ============================================================================
// Types d'objectifs
// ============================================================================

export type Goal = {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: number; // 1-10
  status: GoalStatus;
  createdAt: Date;
  deadline?: Date;
  progress: number; // 0-100
  subGoals: string[]; // ids
  dependencies: string[]; // ids
  successCriteria: string[];
  learnedBehavior: boolean; // true si auto-détecté
};

export type GoalCategory =
  | "health"
  | "productivity"
  | "learning"
  | "social"
  | "home"
  | "finance"
  | "personal_growth"
  | "inferred";

export type GoalStatus = "active" | "paused" | "completed" | "failed" | "abandoned";

// ============================================================================
// Types d'observation
// ============================================================================

export type UserBehavior = {
  userId: string;
  timestamp: Date;
  behaviorType: BehaviorType;
  details: Record<string, unknown>;
  patterns: string[]; // ids de patterns associés
};

export type BehaviorType =
  | "command_usage"
  | "response_feedback"
  | "schedule_adherence"
  | "preference_change"
  | "emotional_state"
  | "social_interaction";

export type UserPreference = {
  id: string;
  category: PreferenceCategory;
  key: string;
  value: unknown;
  confidence: number;
  learnedFrom: string[]; // event ids
  lastConfirmed?: Date;
};

export type PreferenceCategory =
  | "communication"
  | "scheduling"
  | "domotics"
  | "notifications"
  | "privacy"
  | "content"
  | "style";

// ============================================================================
// Types éthiques
// ============================================================================

export type EthicsCheck = {
  decisionId: string;
  checks: EthicsRule[];
  passed: boolean;
  violations: EthicsViolation[];
  requiresHumanReview: boolean;
};

export type EthicsRule = {
  id: string;
  name: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  check: (decision: Decision) => boolean;
};

export type EthicsViolation = {
  ruleId: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  recommendation: string;
};

// ============================================================================
// Configuration
// ============================================================================

export type AutonomyConfig = {
  enabled: boolean;
  autonomyLevel: AutonomyLevel;
  learningEnabled: boolean;
  maxDecisionsPerHour: number;
  requireApprovalFor: ApprovalTrigger[];
  ethicsRules: EthicsRule[];
  observationScope: ObservationScope;
  userWhitelist: string[]; // canaux utilisateurs autorisés
};

export type ApprovalTrigger =
  | "high_impact"
  | "irreversible"
  | "financial"
  | "privacy_related"
  | "safety_critical"
  | "new_pattern";

export type ObservationScope = {
  commands: boolean;
  schedules: boolean;
  feedback: boolean;
  environment: boolean;
  social: boolean;
};

// ============================================================================
// Résultats et événements
// ============================================================================

export type LearningResult = {
  patternsDetected: LearnedPattern[];
  knowledgeAdded: KnowledgeNode[];
  preferencesUpdated: UserPreference[];
  goalsInferred: Goal[];
};

export type DecisionResult = {
  decision: Decision;
  executed: boolean;
  userNotified: boolean;
  ethicsPassed: boolean;
  timestamp: Date;
};

export type AutonomyEvent =
  | { type: "pattern_learned"; data: LearnedPattern }
  | { type: "decision_made"; data: Decision }
  | { type: "goal_inferred"; data: Goal }
  | { type: "preference_learned"; data: UserPreference }
  | { type: "ethics_violation"; data: EthicsViolation }
  | { type: "autonomy_action"; data: { action: string; result: string } };
