/**
 * Types communs pour le module d'intelligence
 * Centralise les types partagés entre tous les modules
 */

// ============================================================================
// Types de Base
// ============================================================================

export type UserId = string;
export type Timestamp = Date;
export type Confidence = number; // 0-1
export type Embedding = number[];

// ============================================================================
// Contexte
// ============================================================================

export interface DecisionContext {
  userId: UserId;
  timestamp: Timestamp;
  location?: string;
  emotionalState?: EmotionalState;
  multimodalInput?: MultiModalInput;
}

export interface EmotionalState {
  mood: string;
  energyLevel: number; // 0-10
  stressLevel: number; // 0-10
  productivityMode?: boolean;
}

export interface MultiModalInput {
  text?: string;
  voice?: {
    transcript: string;
    emotion: string;
    confidence: number;
    speaker?: string;
  };
  sensors?: {
    motion: boolean;
    light: number;
    temperature: number;
  };
  calendar?: Array<{
    title: string;
    start: Date;
    end: Date;
  }>;
  smartHome?: {
    lights: string[];
    temperature: number;
    activeScenes: string[];
  };
}

// ============================================================================
// Actions et Décisions
// ============================================================================

export interface Action {
  id: string;
  type: string;
  description: string;
  parameters: Record<string, unknown>;
  confidence: number;
  requiresConfirmation: boolean;
  estimatedImpact: number;
  metadata?: {
    scheduledTime?: number;
    [key: string]: unknown;
  };
}

export interface ActionSuggestion {
  id: string;
  action: string;
  description: string;
  confidence: number;
  reason: string;
}

export interface ActionOutcome {
  action: Action;
  timestamp: Date;
  success: boolean;
  feedback?: "positive" | "negative" | "neutral";
  metrics?: {
    duration: number;
    userSatisfaction: number;
  };
}

export interface Decision {
  id: string;
  timestamp: Date;
  context: {
    userId: string;
    location: string;
    timeOfDay: string;
    weather?: string;
    emotionalState?: EmotionalState;
    activeTasks: string[];
    recentActivity: string[];
    availableData: string[];
  };
  suggestedActions: Action[];
  selectedAction: Action;
  reasoning: {
    contextFactors: string[];
    predictedOutcomes: Array<{
      scenario: string;
      probability: number;
      impact: "positive" | "negative" | "neutral";
    }>;
    risks: string[];
    confidence: number;
  };
  metadata: {
    processingTime: number;
    contributingModules: string[];
    dataQuality: number;
  };
}

// ============================================================================
// Résultats de Prédiction
// ============================================================================

export interface Prediction {
  event: string;
  probability: number;
  confidence: number;
  trend: "increasing" | "stable" | "decreasing";
  nextOccurrence?: Date;
  anomaly?: boolean;
}

// ============================================================================
// Mémoire
// ============================================================================

export interface MemoryQuery {
  content: string;
  category?: string;
  importance?: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface MemoryEntry {
  id: string;
  content: string;
  category: "preference" | "event" | "emotion" | "learning" | "voice_profile";
  importance: number;
  timestamp: Date;
  lastAccessed: Date;
  accessCount: number;
  embedding?: Embedding;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Événements et Historique
// ============================================================================

export interface AutonomyEvent {
  id: string;
  type: string;
  timestamp: Date;
  userId: UserId;
  data: Record<string, unknown>;
  outcome?: number;
}

// ============================================================================
// Configuration
// ============================================================================

export interface AutonomyConfig {
  enabled: boolean;
  learning: {
    enabled: boolean;
    learningRate: number;
    feedbackThreshold: number;
  };
  prediction: {
    enabled: boolean;
    horizon: number;
    minConfidence: number;
  };
  proactivity: {
    enabled: boolean;
    maxSuggestionsPerHour: number;
    suggestionDelay: number;
    requireConfirmation: boolean;
  };
  coordination?: {
    contextWeight: number;
    predictionWeight: number;
    rlWeight: number;
    memoryWeight: number;
    autonomyThreshold: number;
    maxSuggestions: number;
    explainableMode: boolean;
  };
  memory?: {
    maxSize: number;
    embeddingDim: number;
    decayRate: number;
  };
}

// ============================================================================
// Utilitaires
// ============================================================================

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface MetricSnapshot {
  timestamp: Date;
  name: string;
  value: number;
  unit: string;
}

// ============================================================================
// Résultats d'Opérations
// ============================================================================

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    duration: number;
    timestamp: Date;
  };
}

// Type helper pour les résultats
export type Result<T> = 
  | { success: true; data: T; metadata: { duration: number; timestamp: Date } }
  | { success: false; error: { code: string; message: string }; metadata: { duration: number; timestamp: Date } };

// ============================================================================
// Events pour Event Bus
// ============================================================================

export interface AutonomyEventMap {
  "decision:made": { decision: Decision };
  "voice:recognized": { profileId: string; name: string; confidence: number };
  "prediction:updated": { prediction: Prediction };
  "memory:stored": { entry: MemoryEntry };
  "learning:feedback": { action: Action; feedback: string };
  "error": { module: string; error: Error };
}

export type AutonomyEventType = keyof AutonomyEventMap;
