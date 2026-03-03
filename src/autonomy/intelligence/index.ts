/**
 * Module d'Intelligence Avancée
 * Améliorations pour rendre Jarvis plus intelligent
 */

// Types communs (toujours exporter en premier)
export * from "./types.js";

// Enrichisseur de contexte
export {
  ContextEnricher,
  type RichContext,
  type WeatherContext,
  type CalendarContext,
  type LocationContext,
  type EmotionalContext,
  type DeviceContext,
  type SocialContext,
} from "./context-enricher.js";

// Moteur prédictif
export {
  PredictiveEngine,
  type TimeSeriesPoint,
  type PredictionResult,
  type SeasonalPattern,
} from "./predictive-engine.js";

// Apprentissage par renforcement
export {
  ReinforcementLearner,
  type QTableEntry,
  type Reward,
  type RLConfig,
  type State,
  type Action,
} from "./reinforcement-learner.js";

// Mémoire sémantique
export {
  SemanticMemory,
  type MemoryEntry,
  type SearchResult,
} from "./semantic-memory.js";

// Multi-modal processor
export {
  MultiModalProcessor,
  type UnifiedContext,
  type MultiModalInput,
  type ModalitySource,
} from "./multi-modal-processor.js";

// ==================== NOUVEAUX MODULES ====================

// Orchestrateur central
export {
  IntelligenceCoordinator,
  type CoordinationConfig,
  type CoordinatedDecision,
  type DecisionExplanation,
  type IntelligenceModules,
} from "./intelligence-coordinator.js";

// Raisonnement causal
export {
  CausalReasoner,
  type CausalEvent,
  type CausalRelation,
  type CausalGraph,
  type CounterfactualScenario,
  type RootCauseAnalysis,
  type InterventionSuggestion,
} from "./causal-reasoner.js";

// Digital Twin - Simulateur
export {
  DigitalTwin,
  type SimulationScenario,
  type EnvironmentState,
  type DeviceState,
  type SimulationVariable,
  type SimulationResult,
  type SimulationStep,
  type WhatIfScenario,
  type OptimizationSuggestion,
} from "./digital-twin.js";

// Voice Identification
export {
  VoiceIdentifier,
  type VoiceProfile,
  type VoiceSample,
  type VoiceFeatures,
  type VoiceIdentificationResult,
  type VoiceConfig,
} from "./voice-identifier.js";

// Logging
export {
  AutonomyLogger,
  createLogger,
  logger,
  type LogEntry,
  type LoggerConfig,
} from "./logger.js";

// Validation
export {
  ValidationError,
  validateConfidence,
  validatePositiveNumber,
  validateRange,
  validateNonEmptyString,
  validateUUID,
  validateObject,
  validateArray,
  validateUserId,
  validateTimestamp,
  validateEmbedding,
  validateAudioData,
  validateAutonomyConfig,
  sanitizeString,
  sanitizeObject,
  validateSafe,
  type ValidationResult,
} from "./validation.js";

// Module Audio (Micros distants Arduino)
export {
  AudioServer,
  type AudioNode,
  type AudioServerConfig,
  type AudioFrame,
} from "../audio/audio-server.js";

// Utilitaires et Exemples
export { runAllExamples } from "./example-usage.js";
export { runCompleteWorkflow } from "./example-complete-workflow.js";
export { runVoiceRecognitionDemo } from "./example-voice-recognition.js";
