/**
 * Observateur de comportement utilisateur
 * Capture et analyse les comportements pour l'apprentissage
 */

import { randomUUID } from "node:crypto";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { LearningEvent, UserBehavior, BehaviorType, EventSource } from "../types.js";

const log = createSubsystemLogger("autonomy:observer");

export type BehaviorObserverConfig = {
  captureCommands: boolean;
  captureFeedback: boolean;
  captureSchedule: boolean;
  captureEnvironment: boolean;
  anonymizeData: boolean;
  retentionDays: number;
};

const DEFAULT_CONFIG: BehaviorObserverConfig = {
  captureCommands: true,
  captureFeedback: true,
  captureSchedule: true,
  captureEnvironment: false,
  anonymizeData: true,
  retentionDays: 90,
};

export class BehaviorObserver {
  private config: BehaviorObserverConfig;
  private eventBuffer: LearningEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private eventHandlers: Array<(event: LearningEvent) => void> = [];

  constructor(config: Partial<BehaviorObserverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startFlushInterval();
    log.info("BehaviorObserver initialized");
  }

  /**
   * Capture une commande utilisateur
   */
  captureCommand(
    userId: string,
    command: string,
    parameters: Record<string, unknown>,
    source: EventSource,
    context?: {
      timeOfDay?: { hour: number; minute: number };
      dayOfWeek?: number;
      location?: string;
    }
  ): LearningEvent {
    if (!this.config.captureCommands) {
      return null as unknown as LearningEvent;
    }

    const event: LearningEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      type: "user_command",
      source,
      payload: {
        userId: this.config.anonymizeData ? this.anonymize(userId) : userId,
        command: this.config.anonymizeData ? this.anonymizeCommand(command) : command,
        parameters: this.sanitizeParameters(parameters),
        context,
      },
      metadata: {
        capturedBy: "BehaviorObserver",
        version: "1.0",
      },
    };

    this.bufferEvent(event);
    return event;
  }

  /**
   * Capture un feedback utilisateur
   */
  captureFeedback(
    userId: string,
    originalAction: string,
    feedback: "positive" | "negative" | "corrected",
    correction?: string,
    source: EventSource = "internal"
  ): LearningEvent {
    if (!this.config.captureFeedback) {
      return null as unknown as LearningEvent;
    }

    const event: LearningEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      type: "user_feedback",
      source,
      payload: {
        userId: this.config.anonymizeData ? this.anonymize(userId) : userId,
        originalAction,
        feedback,
        correction,
      },
    };

    this.bufferEvent(event);
    return event;
  }

  /**
   * Capture un événement système
   */
  captureSystemEvent(
    eventType: string,
    data: Record<string, unknown>,
    source: EventSource
  ): LearningEvent {
    const event: LearningEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      type: "system_event",
      source,
      payload: {
        eventType,
        data: this.sanitizeParameters(data),
      },
    };

    this.bufferEvent(event);
    return event;
  }

  /**
   * Capture un pattern d'interaction détecté
   */
  capturePattern(
    patternName: string,
    confidence: number,
    details: Record<string, unknown>,
    source: EventSource
  ): LearningEvent {
    const event: LearningEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      type: "interaction_pattern",
      source,
      payload: {
        patternName,
        confidence,
        details,
      },
    };

    this.bufferEvent(event);
    return event;
  }

  /**
   * Capture le résultat d'une décision
   */
  captureDecisionOutcome(
    decisionId: string,
    success: boolean,
    userSatisfaction?: number,
    lessonsLearned?: string[]
  ): LearningEvent {
    const event: LearningEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      type: "decision_outcome",
      source: "internal",
      payload: {
        decisionId,
        success,
        userSatisfaction,
        lessonsLearned,
      },
    };

    this.bufferEvent(event);
    return event;
  }

  /**
   * Capture l'accomplissement d'un objectif
   */
  captureGoalAchievement(
    goalId: string,
    success: boolean,
    methods: string[]
  ): LearningEvent {
    const event: LearningEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      type: "goal_achievement",
      source: "internal",
      payload: {
        goalId,
        success,
        methods,
      },
    };

    this.bufferEvent(event);
    return event;
  }

  /**
   * S'abonne aux événements capturés
   */
  onEvent(handler: (event: LearningEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index > -1) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Obtient les événements du buffer
   */
  getBufferedEvents(): LearningEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Vide le buffer et retourne les événements
   */
  flush(): LearningEvent[] {
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    log.debug(`Flushed ${events.length} events`);
    return events;
  }

  /**
   * Arrête l'observateur
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Dernier flush
    this.flush();
    log.info("BehaviorObserver stopped");
  }

  // ============================================================================
  // Méthodes privées
  // ============================================================================

  private bufferEvent(event: LearningEvent): void {
    this.eventBuffer.push(event);

    // Notifier les handlers
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        log.error(`Event handler error: ${error}`);
      }
    }

    // Limiter la taille du buffer
    if (this.eventBuffer.length > 1000) {
      this.eventBuffer = this.eventBuffer.slice(-500);
    }
  }

  private startFlushInterval(): void {
    // Flusher toutes les 5 minutes
    this.flushInterval = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flush();
      }
    }, 5 * 60 * 1000);
  }

  private anonymize(id: string): string {
    // Hachage simple pour l'anonymisation
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `user_${Math.abs(hash).toString(16)}`;
  }

  private anonymizeCommand(command: string): string {
    // Supprimer les données potentiellement sensibles
    return command
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]")
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CARD]")
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");
  }

  private sanitizeParameters(params: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ["password", "token", "secret", "key", "auth", "credential"];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
