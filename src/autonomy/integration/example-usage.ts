/**
 * Exemple d'utilisation du système d'autonomie dans Jarvis
 * Montre comment intégrer le module avec le gateway existant
 */

import { AutonomyGatewayIntegration } from "./gateway-integration.js";
import type { OpenClawConfig } from "../../config/config.js";

// ============================================================================
// Exemple 1: Initialisation dans le Gateway
// ============================================================================

export function initializeAutonomyInGateway(config: OpenClawConfig): AutonomyGatewayIntegration {
  // Créer l'intégration
  const autonomyIntegration = new AutonomyGatewayIntegration(config, {
    enabled: true,
    defaultAutonomyLevel: "suggest",
    enableOnChannels: ["telegram", "discord", "whatsapp"],
    notifyUserOnDecisions: true,
  });

  // Initialiser
  autonomyIntegration.initialize().catch((err) => {
    console.error("Failed to initialize autonomy:", err);
  });

  return autonomyIntegration;
}

// ============================================================================
// Exemple 2: Intégration avec le handler de messages
// ============================================================================

export async function handleMessageWithAutonomy(
  autonomy: AutonomyGatewayIntegration,
  message: string,
  userId: string,
  channel: string
): Promise<string | null> {
  // Traiter le message avec le système d'autonomie
  const result = await autonomy.handleIncomingMessage(userId, message, channel);

  if (result.handled) {
    // Le système d'autonomie a traité la commande
    return result.response || null;
  }

  // Laisser le traitement normal continuer
  return null;
}

// ============================================================================
// Exemple 3: Déclenchement d'une décision autonome
// ============================================================================

export async function triggerSmartHomeAutomation(
  autonomy: AutonomyGatewayIntegration,
  userId: string
): Promise<void> {
  // Contexte pour la décision
  const context = {
    userId,
    currentState: {
      time: new Date().toISOString(),
      location: "home",
      temperature: 22,
      lights: "off",
    },
    availableTools: ["domotic", "scheduler"],
    constraints: [
      { type: "time" as const, description: "Evening hours", hard: true },
    ],
    urgency: "low" as const,
  };

  // Demander une décision autonome
  const response = await autonomy.triggerAutonomousDecision(context);

  if (response) {
    console.log("Autonomous decision:", response);
  }
}

// ============================================================================
// Exemple 4: Configuration utilisateur
// ============================================================================

export const autonomyConfigExample = {
  autonomy: {
    enabled: true,
    level: "suggest",
    learningIntervalMinutes: 60,
    decisionIntervalMinutes: 30,
    maxDecisionsPerDay: 20,
    requireApprovalFor: [
      "high_impact",
      "irreversible",
      "financial",
      "safety_critical",
    ],
    observationScope: {
      commands: true,
      schedules: true,
      feedback: true,
      environment: false,
      social: false,
    },
    enabledChannels: ["telegram", "discord"],
    maxFinancialImpact: 50,
    strictEthicsMode: false,
    notifyUserOnDecisions: true,
  },
};

// ============================================================================
// Exemple 5: Scénarios d'utilisation
// ============================================================================

/**
 * Scénario 1: Allumage automatique des lumières
 * 
 * Après avoir appris que l'utilisateur allume les lumières à 19h tous les jours,
 * Jarvis suggère automatiquement cette action.
 */
export const scenarioLightAutomation = `
Utilisateur: (rien, 19h00)
Jarvis: 💡 Je remarque que vous allumez généralement les lumières à cette heure-ci. 
        Souhaitez-vous que je les allume ?
Utilisateur: oui
[Jarvis apprend et renforce ce pattern]
`;

/**
 * Scénario 2: Optimisation de la température
 * 
 * Jarvis détecte que l'utilisateur ajuste souvent la température et apprend
 * ses préférences.
 */
export const scenarioTemperatureLearning = `
Utilisateur: mets la température à 21 degrés
[Plusieurs fois sur une semaine]
Jarvis: 🌡️ J'ai remarqué votre préférence pour 21°C. Je peux maintenant 
        ajuster automatiquement selon l'heure de la journée.
`;

/**
 * Scénario 3: Détection d'objectif de productivité
 * 
 * Jarvis détecte un pattern de travail et propose de l'aide.
 */
export const scenarioProductivityGoal = `
[Pattern détecté: sessions de travail de 9h à 12h tous les jours]
Jarvis: 🎯 J'ai détecté vos habitudes de travail. Souhaitez-vous que je :
        • Mette le mode "Ne pas déranger" automatiquement ?
        • Ajuste l'éclairage pour la concentration ?
        • Rappelle les pauses ?
`;

/**
 * Scénario 4: Correction d'une décision
 * 
 * L'utilisateur corrige une décision autonome pour améliorer l'apprentissage.
 */
export const scenarioFeedbackLoop = `
Jarvis: [Allume la musique à 18h automatiquement]
Utilisateur: non, pas aujourd'hui
Jarvis: 📝 D'accord, je note. La prochaine fois je demanderai avant.
[Le pattern est ajusté avec une confiance réduite]
`;

// ============================================================================
// Exemple 6: Intégration avec les hooks existants
// ============================================================================

/**
 * Hook pour capturer les événements de message
 */
export const autonomyMessageHook = {
  name: "autonomy-message-capture",
  events: ["message:received", "message:sent"],
  handler: async (event: { type: string; data: unknown }, context: { autonomy: AutonomyGatewayIntegration }) => {
    if (event.type === "message:received") {
      const { userId, message, channel } = event.data as {
        userId: string;
        message: string;
        channel: string;
      };
      await context.autonomy.handleIncomingMessage(userId, message, channel);
    }
  },
};

/**
 * Hook pour les décisions autonomes périodiques
 */
export const autonomyCronHook = {
  name: "autonomy-cron-decisions",
  events: ["cron:hourly"],
  handler: async (_event: unknown, context: { autonomy: AutonomyGatewayIntegration }) => {
    // Vérifier si une décision autonome est pertinente
    await context.autonomy.triggerAutonomousDecision({
      urgency: "low",
    });
  },
};

// ============================================================================
// Exemple 7: Commandes CLI
// ============================================================================

/**
 * Commandes pour interagir avec le système d'autonomie via CLI
 */
export const autonomyCliCommands = `
# Configuration de l'autonomie
jarvis autonomy level suggest
jarvis autonomy level ask
jarvis autonomy level full

# Statut
jarvis autonomy status

# Voir les patterns appris
jarvis autonomy patterns

# Voir les objectifs
jarvis autonomy goals

# Donner un feedback
jarvis autonomy feedback positive
jarvis autonomy feedback negative "Préfère plutôt X"

# Exporter les données d'apprentissage
jarvis autonomy export > learning-data.json

# Importer des données
jarvis autonomy import learning-data.json
`;
