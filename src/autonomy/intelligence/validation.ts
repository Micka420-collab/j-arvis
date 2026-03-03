/**
 * Validation des entrées pour le système d'autonomie
 * Garantit la qualité des données et évite les erreurs runtime
 */

import { createLogger } from "./logger.js";

const log = createLogger("Validation");

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// ============================================================================
// Validations Numériques
// ============================================================================

export function validateConfidence(value: number, field = "confidence"): void {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError(`Le champ ${field} doit être un nombre`, field, value);
  }
  if (value < 0 || value > 1) {
    throw new ValidationError(`Le champ ${field} doit être entre 0 et 1`, field, value);
  }
}

export function validatePositiveNumber(value: number, field = "value"): void {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError(`Le champ ${field} doit être un nombre`, field, value);
  }
  if (value < 0) {
    throw new ValidationError(`Le champ ${field} doit être positif`, field, value);
  }
}

export function validateRange(value: number, min: number, max: number, field = "value"): void {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError(`Le champ ${field} doit être un nombre`, field, value);
  }
  if (value < min || value > max) {
    throw new ValidationError(
      `Le champ ${field} doit être entre ${min} et ${max}`,
      field,
      value
    );
  }
}

// ============================================================================
// Validations Chaînes
// ============================================================================

export function validateNonEmptyString(value: string, field = "string"): void {
  if (typeof value !== "string") {
    throw new ValidationError(`Le champ ${field} doit être une chaîne`, field, value);
  }
  if (value.trim().length === 0) {
    throw new ValidationError(`Le champ ${field} ne peut pas être vide`, field, value);
  }
}

export function validateUUID(value: string, field = "id"): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`Le champ ${field} doit être un UUID valide`, field, value);
  }
}

// ============================================================================
// Validations Objets
// ============================================================================

export function validateObject(value: unknown, field = "object"): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new ValidationError(`Le champ ${field} doit être un objet`, field, value);
  }
}

export function validateArray<T>(value: T[], field = "array", minLength = 0): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(`Le champ ${field} doit être un tableau`, field, value);
  }
  if (value.length < minLength) {
    throw new ValidationError(
      `Le champ ${field} doit avoir au moins ${minLength} éléments`,
      field,
      value
    );
  }
}

// ============================================================================
// Validations Spécifiques Autonomie
// ============================================================================

export function validateUserId(userId: string): void {
  validateNonEmptyString(userId, "userId");
}

export function validateTimestamp(timestamp: Date, field = "timestamp"): void {
  if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
    throw new ValidationError(`Le champ ${field} doit être une date valide`, field, timestamp);
  }
}

export function validateEmbedding(embedding: number[], expectedSize?: number): void {
  validateArray(embedding, "embedding");
  
  if (expectedSize && embedding.length !== expectedSize) {
    throw new ValidationError(
      `L'embedding doit avoir ${expectedSize} dimensions`,
      "embedding",
      embedding
    );
  }

  // Vérifier que tous les éléments sont des nombres
  if (!embedding.every((v) => typeof v === "number" && !isNaN(v))) {
    throw new ValidationError(
      "L'embedding doit contenir uniquement des nombres valides",
      "embedding",
      embedding
    );
  }
}

export function validateAudioData(data: Float32Array, minLength = 1600): void {
  if (!(data instanceof Float32Array)) {
    throw new ValidationError("Les données audio doivent être un Float32Array", "audioData", data);
  }
  if (data.length < minLength) {
    throw new ValidationError(
      `Les données audio doivent avoir au moins ${minLength} échantillons`,
      "audioData",
      data
    );
  }
}

// ============================================================================
// Validations Configuration
// ============================================================================

export function validateAutonomyConfig(config: unknown): void {
  validateObject(config, "config");

  const cfg = config as Record<string, unknown>;

  // Vérifier les champs requis
  if (typeof cfg.enabled !== "boolean") {
    throw new ValidationError("config.enabled doit être un booléen", "enabled", cfg.enabled);
  }

  if (cfg.learning && typeof cfg.learning === "object") {
    const learning = cfg.learning as Record<string, unknown>;
    if (typeof learning.enabled !== "boolean") {
      throw new ValidationError("config.learning.enabled doit être un booléen", "learning.enabled", learning.enabled);
    }
    if (typeof learning.learningRate === "number") {
      validateRange(learning.learningRate, 0, 1, "learning.learningRate");
    }
  }

  if (cfg.prediction && typeof cfg.prediction === "object") {
    const prediction = cfg.prediction as Record<string, unknown>;
    if (typeof prediction.minConfidence === "number") {
      validateConfidence(prediction.minConfidence, "prediction.minConfidence");
    }
  }
}

// ============================================================================
// Fonctions de Sanitization
// ============================================================================

export function sanitizeString(value: string, maxLength = 1000): string {
  return value.trim().slice(0, maxLength);
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T, allowedKeys: (keyof T)[]): Partial<T> {
  const sanitized: Partial<T> = {};
  for (const key of allowedKeys) {
    if (key in obj) {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
}

// ============================================================================
// Decorator pour validation automatique (si besoin)
// ============================================================================

export function validate<T>(
  validator: (value: T) => void
): (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      // Valider le premier argument (souvent l'input principal)
      if (args.length > 0) {
        try {
          validator(args[0] as T);
        } catch (error) {
          log.error(`Validation échouée pour ${propertyKey}`, error);
          throw error;
        }
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// ============================================================================
// Helper de validation avec résultat (ne lance pas d'erreur)
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string; value: unknown }>;
}

export function validateSafe<T>(value: T, validators: Array<(v: T) => void>): ValidationResult {
  const errors: Array<{ field: string; message: string; value: unknown }> = [];

  for (const validator of validators) {
    try {
      validator(value);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push({
          field: error.field,
          message: error.message,
          value: error.value,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
