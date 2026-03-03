/**
 * Jarvis Bridge — Interface d'intégration entre l'autonomie et le système réel
 *
 * Ce module fournit les contrats d'interface pour connecter le moteur d'autonomie
 * au pipeline de messagerie, d'exécution et d'approbation de Jarvis.
 * Architecture : injection de dépendances pour éviter les imports circulaires.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("autonomy:bridge");

// ============================================================================
// Interfaces du bridge
// ============================================================================

/**
 * Contexte d'une notification sortante
 */
export type JarvisNotification = {
  /** Texte du message à envoyer */
  message: string;
  /** Niveau d'urgence */
  level: "info" | "suggestion" | "action" | "alert";
  /** ID utilisateur cible (canal de livraison) */
  userId?: string;
  /** Métadonnées optionnelles */
  metadata?: Record<string, unknown>;
};

/**
 * Résultat d'une exécution de commande
 */
export type JarvisExecutionResult = {
  success: boolean;
  output?: string;
  error?: string;
  executionTimeMs: number;
};

/**
 * Requête d'approbation utilisateur
 */
export type JarvisApprovalRequest = {
  question: string;
  context: string;
  options?: string[];
  /** Timeout en ms avant refus automatique */
  timeoutMs?: number;
};

/**
 * Interface du bridge Jarvis — à implémenter par le système hôte
 */
export type JarvisBridge = {
  /**
   * Envoie une notification/suggestion à l'utilisateur
   */
  notify(notification: JarvisNotification): Promise<void>;

  /**
   * Exécute une commande dans le pipeline Jarvis
   */
  execute(command: string, params: Record<string, unknown>): Promise<JarvisExecutionResult>;

  /**
   * Demande une approbation utilisateur avant une action
   * Retourne true si approuvé, false si refusé ou timeout
   */
  requestApproval(request: JarvisApprovalRequest): Promise<boolean>;
};

// ============================================================================
// Implémentation par défaut (mode dégradé — log only)
// ============================================================================

/**
 * Bridge par défaut utilisé quand aucun bridge réel n'est configuré.
 * Log les actions sans les exécuter — mode sécurisé au démarrage.
 */
export class DefaultJarvisBridge implements JarvisBridge {
  async notify(notification: JarvisNotification): Promise<void> {
    log.info(`[NOTIFY:${notification.level.toUpperCase()}] ${notification.message}`);
  }

  async execute(command: string, params: Record<string, unknown>): Promise<JarvisExecutionResult> {
    log.info(`[EXECUTE] Command: ${command} | Params: ${JSON.stringify(params)}`);
    log.warn("DefaultJarvisBridge: pas de bridge réel configuré — exécution simulée");
    return {
      success: true,
      output: `[Simulated] ${command}`,
      executionTimeMs: 10,
    };
  }

  async requestApproval(request: JarvisApprovalRequest): Promise<boolean> {
    log.info(`[APPROVAL REQUEST] ${request.question}`);
    log.warn("DefaultJarvisBridge: approbation auto-refusée (bridge non configuré)");
    return false;
  }
}

// ============================================================================
// Registre global du bridge
// ============================================================================

let _activeBridge: JarvisBridge = new DefaultJarvisBridge();
let _isRealBridge = false;

/**
 * Enregistre le bridge Jarvis réel.
 * À appeler au démarrage du gateway, avant que l'AutonomyService soit lancé.
 */
export function registerJarvisBridge(bridge: JarvisBridge): void {
  _activeBridge = bridge;
  _isRealBridge = true;
  log.info("JarvisBridge réel enregistré — autonomie connectée au système de messagerie");
}

/**
 * Récupère le bridge actif (réel ou défaut)
 */
export function getJarvisBridge(): JarvisBridge {
  return _activeBridge;
}

/**
 * Vérifie si un vrai bridge est configuré
 */
export function isRealBridgeConfigured(): boolean {
  return _isRealBridge;
}

// ============================================================================
// Formateur de messages style Jarvis (Iron Man)
// ============================================================================

const JARVIS_SALUTATIONS = [
  "À votre service, Monsieur.",
  "Bien entendu, Monsieur.",
  "Comme vous le souhaitez, Monsieur.",
  "Affaire réglée, Monsieur.",
  "Permettez-moi de m'en occuper, Monsieur.",
];

const JARVIS_SUGGESTIONS_PREFIX = [
  "Si je puis me permettre,",
  "Une observation, Monsieur —",
  "Vous noterez peut-être que",
  "J'ai détecté un schéma intéressant —",
  "Pour optimiser votre emploi du temps, Monsieur —",
];

/**
 * Formate un message avec la personnalité de Jarvis
 */
export function formatJarvisMessage(
  type: "suggestion" | "action" | "alert" | "info",
  content: string,
  context?: string
): string {
  switch (type) {
    case "suggestion": {
      const prefix = JARVIS_SUGGESTIONS_PREFIX[Math.floor(Math.random() * JARVIS_SUGGESTIONS_PREFIX.length)];
      return `🤖 ${prefix} ${content}${context ? `\n\n_Contexte : ${context}_` : ""}`;
    }
    case "action": {
      const salut = JARVIS_SALUTATIONS[Math.floor(Math.random() * JARVIS_SALUTATIONS.length)];
      return `✅ ${salut}\n${content}`;
    }
    case "alert":
      return `⚠️ Jarvis — Alerte\n${content}${context ? `\n\n_${context}_` : ""}`;
    case "info":
    default:
      return `ℹ️ ${content}`;
  }
}
