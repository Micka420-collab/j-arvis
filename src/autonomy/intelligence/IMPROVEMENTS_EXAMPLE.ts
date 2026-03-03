/**
 * Exemple d'utilisation des améliorations dans les modules
 * 
 * Ce fichier montre comment intégrer :
 * - Le logger
 * - La validation
 * - Les types communs
 * 
 * Dans un vrai module (ex: context-enricher.ts)
 */

import { createLogger } from "./logger.js";
import { validateUserId, validateTimestamp, ValidationError } from "./validation.js";
import type { DecisionContext, RichContext } from "./types.js";

// Créer un logger pour ce module
const log = createLogger("ContextEnricher");

export class ContextEnricherImproved {
  async enrichContext(context: DecisionContext): Promise<RichContext> {
    // ✅ VALIDATION des entrées
    try {
      validateUserId(context.userId);
      validateTimestamp(context.timestamp);
    } catch (error) {
      if (error instanceof ValidationError) {
        log.error("Validation échouée", { field: error.field, value: error.value });
        throw error;
      }
    }

    log.info("Début de l'enrichissement", { userId: context.userId });

    try {
      // ... logique d'enrichissement ...
      
      const enrichedContext: RichContext = {
        userId: context.userId,
        temporal: {
          timeOfDay: "morning",
          dayOfWeek: 1,
          // ...
        },
        // ...
      };

      log.info("Enrichissement terminé", { 
        userId: context.userId,
        timeOfDay: enrichedContext.temporal.timeOfDay 
      });

      return enrichedContext;

    } catch (error) {
      log.error("Erreur lors de l'enrichissement", error);
      throw error;
    }
  }
}

/**
 * EXEMPLE : VoiceIdentifier avec validation
 */
import { validateAudioData, validateNonEmptyString } from "./validation.js";

const voiceLog = createLogger("VoiceIdentifier");

export class VoiceIdentifierImproved {
  async enrollVoice(
    name: string,
    audioSamples: Float32Array[],
    userId?: string
  ) {
    // Validation
    validateNonEmptyString(name, "name");
    
    if (audioSamples.length === 0) {
      throw new ValidationError(
        "Au moins un échantillon requis",
        "audioSamples",
        audioSamples
      );
    }

    for (let i = 0; i < audioSamples.length; i++) {
      try {
        validateAudioData(audioSamples[i]);
      } catch (error) {
        voiceLog.error(`Échantillon ${i} invalide`, error);
        throw error;
      }
    }

    voiceLog.info("Enregistrement voix", { 
      name, 
      userId, 
      sampleCount: audioSamples.length 
    });

    // ... logique d'enregistrement ...
  }
}

/**
 * EXEMPLE : IntelligenceCoordinator avec logging
 */
const coordLog = createLogger("IntelligenceCoordinator");

export class IntelligenceCoordinatorImproved {
  async coordinate(context: DecisionContext) {
    const startTime = Date.now();
    
    coordLog.info("Coordination démarrée", { userId: context.userId });

    try {
      // ... logique de coordination ...
      
      const processingTime = Date.now() - startTime;
      
      coordLog.info("Coordination terminée", { 
        userId: context.userId,
        processingTime,
        confidence: 0.85
      });

      return {
        // ... résultat ...
      };

    } catch (error) {
      coordLog.error("Erreur de coordination", { 
        userId: context.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

/**
 * EXEMPLE : Utilisation des types communs
 */
import type { 
  Action, 
  Decision, 
  Prediction, 
  MemoryEntry,
  Result 
} from "./types.js";

// Fonction avec type de retour standardisé
export async function makePrediction(data: unknown): Promise<Result<Prediction>> {
  try {
    // ... logique ...
    const prediction: Prediction = {
      event: "test",
      probability: 0.8,
      confidence: 0.9,
      trend: "stable",
    };

    return {
      success: true,
      data: prediction,
      metadata: {
        duration: 50,
        timestamp: new Date(),
      },
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: "PREDICTION_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      metadata: {
        duration: 0,
        timestamp: new Date(),
      },
    };
  }
}

/**
 * EXEMPLE : Validation avec résultat (sans exception)
 */
import { validateSafe, validateConfidence } from "./validation.js";

export function validateConfigSafe(config: unknown) {
  const result = validateSafe(config, [
    (c) => validateObject(c, "config"),
    (c) => {
      const cfg = c as Record<string, unknown>;
      if (typeof cfg.enabled !== "boolean") {
        throw new ValidationError("enabled doit être un booléen", "enabled", cfg.enabled);
      }
    },
    (c) => {
      const cfg = c as Record<string, unknown>;
      if (cfg.coordination && typeof cfg.coordination === "object") {
        const coord = cfg.coordination as Record<string, unknown>;
        if (typeof coord.autonomyThreshold === "number") {
          validateConfidence(coord.autonomyThreshold, "coordination.autonomyThreshold");
        }
      }
    },
  ]);

  if (!result.valid) {
    log.warn("Configuration invalide", { errors: result.errors });
  }

  return result;
}
