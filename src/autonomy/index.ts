/**
 * Module d'autonomie de Jarvis
 * Exporte tous les composants pour l'auto-apprentissage et la prise de décision autonome
 */

// Types
export type {
  LearningEvent,
  LearnedPattern,
  PatternContext,
  PatternAction,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  EdgeType,
  Decision,
  DecisionContext,
  DecisionOption,
  DecisionResult,
  Risk,
  Benefit,
  Constraint,
  Goal,
  GoalCategory,
  GoalStatus,
  UserBehavior,
  BehaviorType,
  UserPreference,
  PreferenceCategory,
  EthicsCheck,
  EthicsRule,
  EthicsViolation,
  AutonomyConfig,
  AutonomyLevel,
  ApprovalTrigger,
  ObservationScope,
  LearningResult,
  AutonomyEvent,
  EventSource,
} from "./types.js";

// Learning
export { LearningEngine, type LearningEngineConfig } from "./learning/learning-engine.js";
export { PatternDetector, type PatternDetectorConfig } from "./learning/pattern-detector.js";
export { KnowledgeGraph } from "./learning/knowledge-graph.js";

// Decision
export { DecisionEngine, type DecisionEngineConfig } from "./decision/decision-engine.js";
export { GoalManager, type GoalManagerConfig } from "./decision/goal-manager.js";
export { EthicsGuard, type EthicsGuardConfig } from "./decision/ethics-guard.js";
export { ActionPlanner, type ActionPlan, type Action, type ExecutionResult } from "./decision/action-planner.js";

// Observation
export { BehaviorObserver, type BehaviorObserverConfig } from "./observation/behavior-observer.js";

// Intelligence (Améliorations)
export * from "./intelligence/index.js";

// Integration
export { AutonomyService, type AutonomyServiceConfig } from "./integration/autonomy-service.js";

// Jarvis Bridge — interface de connexion au système réel
export {
  registerJarvisBridge,
  getJarvisBridge,
  isRealBridgeConfigured,
  formatJarvisMessage,
  DefaultJarvisBridge,
  type JarvisBridge,
  type JarvisNotification,
  type JarvisExecutionResult,
  type JarvisApprovalRequest,
} from "./jarvis-bridge.js";

// Moteur proactif — suggestions style Iron Man Jarvis
export { ProactiveEngine, type ProactiveEngineConfig } from "./proactive-engine.js";

// Géofencing — détection arrivée/départ domicile
export { GeofencingManager, getGeofencingManager, haversineMeters } from "./geofencing/index.js";
export type { GeofencingConfig, GeofencingEvent, GeofencingProvider, GpsCoords, PresenceState } from "./geofencing/index.js";

// Mode invité — profil restreint pour visiteurs
export { GuestModeManager, getGuestModeManager } from "./guest-mode/index.js";
export type { GuestModeConfig, GuestModeStatus, TempRange } from "./guest-mode/index.js";

// Suivi des habitudes — patterns + propositions d'automatisations
export { HabitsTracker, getHabitsTracker } from "./habits/index.js";
export type { HabitsConfig, HabitPattern, AutomationProposal, PatternState, DayType } from "./habits/index.js";

// Notifications intelligentes — alertes domotiques
export { SmartNotifier, getSmartNotifier } from "./notifications/index.js";
export type { NotificationsConfig, AlertConfig, AlertType, SentAlert } from "./notifications/index.js";

// Dashboard Jarvis — visualisation de l'autonomie
export { JarvisDashboard } from "./dashboard/index.js";
export type { DashboardConfig, DashboardData, RoomData } from "./dashboard/index.js";

// Philips Hue — contrôle natif via openhue CLI
export { OpenhueIntegration, getOpenhue, HUE_PRESETS } from "./hue/index.js";
export type { HueLightState, HueLight, HueRoom, HueScene } from "./hue/index.js";
