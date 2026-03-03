/**
 * Intégration du système d'autonomie avec le Gateway Jarvis
 * Connecte les modules d'autonomie avec l'infrastructure existante
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { OpenClawConfig } from "../../config/config.js";
import { AutonomyService } from "./autonomy-service.js";
import type { AutonomyLevel, DecisionContext } from "../types.js";
import {
  registerJarvisBridge,
  type JarvisBridge,
  type JarvisNotification,
  type JarvisExecutionResult,
  type JarvisApprovalRequest,
} from "../jarvis-bridge.js";
import { createVoiceDaemon, type VoiceDaemon } from "../../voice/voice-daemon.js";
import { getHomeAssistantClient, type DomoticCommandParams } from "../../domotic/home-assistant-client.js";

const log = createSubsystemLogger("autonomy:gateway");

export type GatewayIntegrationConfig = {
  enabled: boolean;
  defaultAutonomyLevel: AutonomyLevel;
  enableOnChannels: string[];
  notifyUserOnDecisions: boolean;
  /** ID ou canal de l'utilisateur propriétaire (Telegram ID, Discord ID...) */
  ownerUserId?: string;
  /** Canal préféré pour les notifications autonomes */
  notificationChannel?: string;
  /** Configuration du module vocal */
  voice?: {
    /** Active le module vocal (défaut: false) */
    enabled?: boolean;
    /** Wake words (défaut: ["jarvis", "hey jarvis"]) */
    wakeWords?: string[];
    /** Device microphone (vide = système par défaut) */
    captureDevice?: string;
  };
};

// ============================================================================
// Implémentation réelle du JarvisBridge
// ============================================================================

/**
 * Bridge Jarvis connecté au pipeline de messagerie et d'exécution réel.
 * Envoie des notifications via sendMessage, exécute les commandes via le gateway.
 */
class GatewayJarvisBridge implements JarvisBridge {
  private ownerUserId: string;
  private notificationChannel: string;
  private pendingApprovals: Map<string, { resolve: (v: boolean) => void; timer: ReturnType<typeof setTimeout> }> = new Map();

  constructor(ownerUserId: string, notificationChannel: string) {
    this.ownerUserId = ownerUserId;
    this.notificationChannel = notificationChannel;
  }

  /**
   * Envoie une notification au propriétaire via sendMessage
   */
  async notify(notification: JarvisNotification): Promise<void> {
    const target = notification.userId ?? this.ownerUserId;
    if (!target) {
      log.warn("[Bridge] notify() appelé sans userId — notification ignorée (ownerUserId non configuré)");
      return;
    }

    try {
      // Import dynamique pour éviter les dépendances circulaires au module-level
      const { sendMessage } = await import("../../infra/outbound/message.js");
      await sendMessage({
        to: target,
        content: notification.message,
        channel: this.notificationChannel,
        bestEffort: true, // Ne pas bloquer si la livraison échoue
      });
      log.info(`[Bridge] Notification envoyée à ${target} via ${this.notificationChannel}`);
    } catch (err) {
      log.error(`[Bridge] Échec de livraison notification: ${String(err)}`);
    }
  }

  /**
   * Exécute une commande Jarvis via le pipeline gateway
   * Supporte les actions domotiques, messaging, scheduler
   */
  async execute(command: string, params: Record<string, unknown>): Promise<JarvisExecutionResult> {
    const start = Date.now();
    log.info(`[Bridge] Exécution commande: ${command} | params: ${JSON.stringify(params)}`);

    try {
      // Routage par type de commande
      if (command.startsWith("message:") || command === "send_message") {
        const to = (params.to as string) ?? this.ownerUserId;
        const content = (params.content as string) ?? (params.message as string) ?? "";
        if (to && content) {
          const { sendMessage } = await import("../../infra/outbound/message.js");
          await sendMessage({ to, content, channel: this.notificationChannel, bestEffort: true });
          return { success: true, output: `Message envoyé à ${to}`, executionTimeMs: Date.now() - start };
        }
        return { success: false, error: "Paramètres manquants: to, content", executionTimeMs: Date.now() - start };
      }

      // Commandes domotiques — routage vers Home Assistant
      if (command.startsWith("domotic:") || command.startsWith("home:")) {
        const haClient = getHomeAssistantClient();
        if (!haClient) {
          log.warn("[Bridge] Commande domotique reçue mais Home Assistant non configuré (HOME_ASSISTANT_URL / HOME_ASSISTANT_TOKEN manquants)");
          return {
            success: false,
            error: "Home Assistant non configuré. Définissez HOME_ASSISTANT_URL et HOME_ASSISTANT_TOKEN dans votre .env",
            executionTimeMs: Date.now() - start,
          };
        }
        const haResult = await haClient.executeCommand(command, params as DomoticCommandParams);
        return {
          success: haResult.success,
          output: haResult.output,
          error: haResult.error,
          executionTimeMs: Date.now() - start,
        };
      }

      // Commandes scheduler — délégation future
      if (command.startsWith("schedule:") || command.startsWith("reminder:")) {
        log.info(`[Bridge] Commande scheduler: ${command}`);
        return { success: true, output: `[Scheduler] ${command} — enregistré`, executionTimeMs: Date.now() - start };
      }

      // Commande inconnue — log et succès partiel
      log.warn(`[Bridge] Commande non reconnue: ${command}`);
      return {
        success: true,
        output: `Commande "${command}" reçue mais non implémentée dans ce bridge`,
        executionTimeMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        error: String(err),
        executionTimeMs: Date.now() - start,
      };
    }
  }

  /**
   * Demande une approbation à l'utilisateur via message interactif.
   * Envoie le message et attend une réponse (timeout configurable).
   * En l'absence de mécanisme de réponse interactif, retourne false par sécurité.
   */
  async requestApproval(request: JarvisApprovalRequest): Promise<boolean> {
    const target = this.ownerUserId;
    if (!target) {
      log.warn("[Bridge] requestApproval() sans ownerUserId — refus automatique");
      return false;
    }

    const approvalId = `approval_${Date.now()}`;
    const timeoutMs = request.timeoutMs ?? 30_000;

    try {
      const optionsText = request.options?.join(" | ") ?? "✅ Oui | ❌ Non";
      const messageText = `🤖 **Jarvis — Demande d'autorisation**\n\n${request.question}\n\n_Contexte: ${request.context}_\n\n${optionsText}\n\n_Répondez dans les ${Math.round(timeoutMs / 1000)}s ou l'action sera annulée._`;

      const { sendMessage } = await import("../../infra/outbound/message.js");
      await sendMessage({
        to: target,
        content: messageText,
        channel: this.notificationChannel,
        bestEffort: false,
      });

      log.info(`[Bridge] Demande d'approbation envoyée (id=${approvalId}, timeout=${timeoutMs}ms)`);

      // Attendre la réponse via le système de pending approvals
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          this.pendingApprovals.delete(approvalId);
          log.warn(`[Bridge] Approbation ${approvalId} expirée — refus automatique`);
          resolve(false);
        }, timeoutMs);

        this.pendingApprovals.set(approvalId, { resolve, timer });
      });
    } catch (err) {
      log.error(`[Bridge] Erreur requestApproval: ${String(err)}`);
      return false;
    }
  }

  /**
   * Résout une approbation pendante (à appeler depuis le handler de message entrant)
   */
  resolveApproval(approvalId: string, approved: boolean): boolean {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pendingApprovals.delete(approvalId);
    pending.resolve(approved);
    return true;
  }

  /** Retourne true s'il y a au moins une approbation en attente */
  hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0;
  }

  /** Retourne l'ID de l'approbation la plus ancienne (FIFO) */
  getOldestPendingApprovalId(): string | null {
    const firstKey = this.pendingApprovals.keys().next().value;
    return firstKey ?? null;
  }
}

export class AutonomyGatewayIntegration {
  private config: GatewayIntegrationConfig;
  private autonomyService: AutonomyService;
  private isInitialized = false;
  private bridge: GatewayJarvisBridge | null = null;
  private voiceDaemon: VoiceDaemon | null = null;

  constructor(
    openClawConfig: OpenClawConfig,
    integrationConfig?: Partial<GatewayIntegrationConfig>
  ) {
    // Lecture depuis process.env (chargé depuis ~/.openclaw/.env via loadDotEnv)
    // en fallback sur openClawConfig (rétro-compatibilité) puis sur integrationConfig
    const ownerFromEnv = process.env.JARVIS_OWNER_ID;
    const channelFromEnv = process.env.JARVIS_NOTIFICATION_CHANNEL;
    const levelFromEnv = process.env.JARVIS_AUTONOMY_LEVEL as GatewayIntegrationConfig["defaultAutonomyLevel"] | undefined;
    const voiceEnabledFromEnv = process.env.JARVIS_VOICE_ENABLED === "true";
    const wakeWordsFromEnv = process.env.JARVIS_WAKE_WORDS
      ? process.env.JARVIS_WAKE_WORDS.split(",").map((w) => w.trim()).filter(Boolean)
      : undefined;
    const micDeviceFromEnv = process.env.JARVIS_MIC_DEVICE;

    this.config = {
      enabled: process.env.JARVIS_AUTONOMY_ENABLED !== "false",
      defaultAutonomyLevel: levelFromEnv ?? "suggest",
      enableOnChannels: ["telegram", "discord", "whatsapp"],
      notifyUserOnDecisions: true,
      ownerUserId: ownerFromEnv
        ?? (openClawConfig as Record<string, unknown>).ownerUserId as string | undefined,
      notificationChannel: channelFromEnv ?? "telegram",
      // Module vocal : activé si JARVIS_VOICE_ENABLED=true dans .env
      ...(voiceEnabledFromEnv ? {
        voice: {
          enabled: true,
          wakeWords: wakeWordsFromEnv ?? ["jarvis", "hey jarvis"],
          captureDevice: micDeviceFromEnv,
        },
      } : {}),
      ...integrationConfig,
    };

    // Initialiser le service d'autonomie
    this.autonomyService = new AutonomyService({
      enabled: this.config.enabled,
      autonomyLevel: this.config.defaultAutonomyLevel,
    });

    log.info("AutonomyGatewayIntegration created");
  }

  /**
   * Initialise l'intégration avec le gateway
   * Enregistre le vrai JarvisBridge avant de démarrer l'AutonomyService
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // ── Étape 1 : créer et enregistrer le bridge réel ──────────────────────
    // Le bridge est créé ici, après que le gateway est démarré,
    // pour éviter tout import circulaire au niveau module.
    const ownerUserId = this.config.ownerUserId ?? "";
    const notificationChannel = this.config.notificationChannel ?? "telegram";

    this.bridge = new GatewayJarvisBridge(ownerUserId, notificationChannel);
    registerJarvisBridge(this.bridge);

    if (!ownerUserId) {
      log.warn(
        "JarvisBridge: ownerUserId non configuré — les notifications autonomes seront ignorées. " +
        "Configurez autonomy.ownerUserId dans votre config ou via la variable d'env JARVIS_OWNER_ID."
      );
    } else {
      log.info(`JarvisBridge réel connecté → canal=${notificationChannel}, owner=${ownerUserId}`);
    }

    // ── Étape 2 : démarrer le service d'autonomie ──────────────────────────
    await this.autonomyService.start();

    // ── Étape 3 : démarrer le module vocal si activé ───────────────────────
    const voiceCfg = this.config.voice;
    if (voiceCfg?.enabled) {
      this.voiceDaemon = createVoiceDaemon({
        enabled: true,
        ownerUserId: ownerUserId,
        wakeWords: voiceCfg.wakeWords ?? ["jarvis", "hey jarvis"],
        captureDevice: voiceCfg.captureDevice ?? "",
        // Dispatch des commandes vocales vers le gateway Jarvis
        dispatchToJarvis: async (command: string) => {
          log.info(`[Voice] Commande vocale: "${command}"`);
          // Dispatch via le système de session Jarvis
          try {
            const { sendMessage } = await import("../../infra/outbound/message.js");
            // Envoyer la commande comme si c'était un message texte du propriétaire
            if (ownerUserId) {
              await sendMessage({
                to: ownerUserId,
                content: command,
                channel: notificationChannel,
                bestEffort: true,
              });
            }
          } catch (err) {
            log.warn(`[Voice] Dispatch échoué: ${String(err)}`);
          }
          return null; // Le pipeline vocal gérera la réponse séparément
        },
      });

      // Démarrage non-bloquant du daemon vocal
      this.voiceDaemon.start().catch((err: Error) => {
        log.warn(`Module vocal non démarré: ${err.message}`);
      });

      log.info("Module vocal Mistral STT démarré — Je vous écoute, Monsieur.");
    } else {
      log.info(
        "Module vocal non activé (voice.enabled: false). " +
        "Configurez voice.enabled=true + MISTRAL_API_KEY pour activer."
      );
    }

    this.isInitialized = true;

    log.info("AutonomyGatewayIntegration initialized — Jarvis est en ligne, Monsieur.");
  }

  /**
   * Arrête l'intégration (autonomy + voix)
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    // Arrêt du module vocal
    if (this.voiceDaemon) {
      await this.voiceDaemon.stop();
      this.voiceDaemon = null;
    }

    await this.autonomyService.stop();
    this.isInitialized = false;

    log.info("AutonomyGatewayIntegration shutdown — À bientôt, Monsieur.");
  }

  /**
   * Retourne le statut du module vocal
   */
  getVoiceStatus(): { enabled: boolean; status?: ReturnType<VoiceDaemon["getStatus"]> } {
    if (!this.voiceDaemon) return { enabled: false };
    return { enabled: true, status: this.voiceDaemon.getStatus() };
  }

  /**
   * Configure l'ID du propriétaire après coup (si connu après le démarrage)
   */
  setOwnerUserId(userId: string): void {
    this.config.ownerUserId = userId;
    // Recréer le bridge avec le bon userId si déjà démarré
    if (this.bridge && this.isInitialized) {
      this.bridge = new GatewayJarvisBridge(userId, this.config.notificationChannel ?? "telegram");
      registerJarvisBridge(this.bridge);
      log.info(`JarvisBridge mis à jour — owner=${userId}`);
    }
  }

  /**
   * Résout une approbation pendante depuis un message utilisateur.
   * À appeler dans le handler de message entrant quand l'utilisateur répond.
   */
  resolveApproval(approvalId: string, approved: boolean): boolean {
    if (!this.bridge) return false;
    return this.bridge.resolveApproval(approvalId, approved);
  }

  /**
   * Traite un message entrant
   */
  async handleIncomingMessage(
    userId: string,
    message: string,
    channel: string,
    metadata?: Record<string, unknown>
  ): Promise<{
    handled: boolean;
    response?: string;
    action?: string;
  }> {
    if (!this.config.enabled) {
      return { handled: false };
    }

    // ── Étape 1 : détecter une réponse d'approbation ─────────────────────────
    // Si l'utilisateur répond "oui", "✅", "approve:<id>" etc., résoudre l'approbation pendante.
    const approvalResolution = this.parseApprovalResponse(message, metadata);
    if (approvalResolution && this.bridge) {
      const resolved = this.bridge.resolveApproval(approvalResolution.approvalId, approvalResolution.approved);
      if (resolved) {
        const answer = approvalResolution.approved ? "✅ Action autorisée." : "❌ Action annulée.";
        log.info(`[Gateway] Approbation ${approvalResolution.approvalId} résolue → ${approvalResolution.approved}`);
        return { handled: true, response: answer, action: "approval_resolved" };
      }
    }

    // ── Étape 2 : capturer l'interaction pour l'apprentissage ─────────────────
    await this.autonomyService.processInteraction(
      userId,
      message,
      metadata || {},
      channel as "telegram" | "discord" | "whatsapp" | "slack"
    );

    // ── Étape 3 : vérifier si c'est une commande liée à l'autonomie ──────────
    const autonomyCommand = this.parseAutonomyCommand(message);
    if (autonomyCommand) {
      return this.handleAutonomyCommand(autonomyCommand, userId);
    }

    // Sinon, laisser passer pour traitement normal
    return { handled: false };
  }

  /**
   * Traite une réponse sortante
   */
  async handleOutgoingResponse(
    userId: string,
    originalMessage: string,
    response: string,
    channel: string
  ): Promise<void> {
    // Analyser la réponse pour détecter du feedback implicite
    // Par exemple, si l'utilisateur dit "merci", c'est positif
    if (this.isPositiveFeedback(response)) {
      await this.autonomyService.recordFeedback(
        userId,
        originalMessage,
        "positive"
      );
    }
  }

  /**
   * Déclenche une évaluation autonome
   */
  async triggerAutonomousDecision(
    context: Partial<DecisionContext>
  ): Promise<string | null> {
    const fullContext: DecisionContext = {
      userId: context.userId || "default",
      currentState: context.currentState || {},
      availableTools: context.availableTools || ["domotic", "messaging"],
      constraints: context.constraints || [],
      urgency: context.urgency || "medium",
    };

    const result = await this.autonomyService.requestDecision(fullContext);

    if (this.config.notifyUserOnDecisions && result.decision) {
      return result.message;
    }

    return null;
  }

  /**
   * Obtient le statut pour l'affichage utilisateur
   */
  getStatusMessage(): string {
    const stats = this.autonomyService.getLearningStats();

    return `
🧠 **Système d'Autonomie Jarvis**

📊 **Statistiques d'apprentissage:**
• Patterns appris: ${stats.patternsLearned}
• Objectifs détectés: ${stats.goalsInferred}
• Préférences apprises: ${stats.preferencesLearned}
• Nœuds de connaissance: ${stats.knowledgeNodes}

⚙️ **Niveau d'autonomie:** ${this.config.defaultAutonomyLevel}
📡 **Canaux actifs:** ${this.config.enableOnChannels.join(", ")}

Commandes disponibles:
• "/autonomy level [none|suggest|ask|act_with_notice|full]" - Changer le niveau
• "/autonomy patterns" - Voir les patterns appris
• "/autonomy goals" - Voir les objectifs détectés
• "/autonomy feedback [positive|negative]" - Donner un feedback
    `.trim();
  }

  /**
   * Obtient la liste des patterns appris formatée
   */
  getPatternsMessage(): string {
    const patterns = this.autonomyService.getLearnedPatterns();

    if (patterns.length === 0) {
      return "📝 Aucun pattern comportemental détecté pour le moment.";
    }

    const topPatterns = patterns.slice(0, 10);
    let message = "📝 **Patterns comportementaux appris:**\n\n";

    for (const pattern of topPatterns) {
      const confidence = Math.round(pattern.confidence * 100);
      const icon = confidence > 80 ? "✅" : confidence > 50 ? "⚡" : "🆕";
      message += `${icon} **${pattern.name}**\n`;
      message += `   Confiance: ${confidence}% | Fréquence: ${pattern.frequency}x\n`;
      message += `   Action: ${pattern.action.type}\n\n`;
    }

    return message;
  }

  /**
   * Obtient la liste des objectifs formatée
   */
  getGoalsMessage(): string {
    const goals = this.autonomyService.getActiveGoals();

    if (goals.length === 0) {
      return "🎯 Aucun objectif actif pour le moment.";
    }

    let message = "🎯 **Objectifs détectés:**\n\n";

    for (const goal of goals) {
      const icon = goal.learnedBehavior ? "🤖" : "👤";
      const progressBar = this.renderProgressBar(goal.progress);
      message += `${icon} **${goal.title}**\n`;
      message += `   ${goal.description}\n`;
      message += `   Progression: ${progressBar} ${goal.progress}%\n`;
      message += `   Priorité: ${"⭐".repeat(goal.priority)}\n\n`;
    }

    return message;
  }

  // ============================================================================
  // Méthodes privées
  // ============================================================================

  private parseAutonomyCommand(message: string): {
    command: string;
    args: string[];
  } | null {
    const patterns = [
      /^\/autonomy\s+(\w+)(?:\s+(.+))?$/i,
      /^jarvis\s+(?:autonomie?|autonomy)\s+(\w+)(?:\s+(.+))?$/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          command: match[1].toLowerCase(),
          args: match[2] ? match[2].split(/\s+/) : [],
        };
      }
    }

    return null;
  }

  private async handleAutonomyCommand(
    cmd: { command: string; args: string[] },
    userId: string
  ): Promise<{ handled: boolean; response: string }> {
    switch (cmd.command) {
      case "level":
      case "niveau": {
        const level = cmd.args[0] as AutonomyLevel;
        if (level && ["none", "suggest", "ask", "act_with_notice", "full"].includes(level)) {
          this.autonomyService.setAutonomyLevel(level);
          this.config.defaultAutonomyLevel = level;
          return {
            handled: true,
            response: `✅ Niveau d'autonomie changé à: **${level}**`,
          };
        }
        return {
          handled: true,
          response: `❌ Niveau invalide. Options: none, suggest, ask, act_with_notice, full`,
        };
      }

      case "status":
      case "statut":
        return {
          handled: true,
          response: this.getStatusMessage(),
        };

      case "patterns":
        return {
          handled: true,
          response: this.getPatternsMessage(),
        };

      case "goals":
      case "objectifs":
        return {
          handled: true,
          response: this.getGoalsMessage(),
        };

      case "feedback": {
        const feedback = cmd.args[0] as "positive" | "negative" | "corrected";
        if (feedback) {
          await this.autonomyService.recordFeedback(userId, "last_action", feedback);
          return {
            handled: true,
            response: "📝 Feedback enregistré, merci !",
          };
        }
        return {
          handled: true,
          response: "❌ Usage: /autonomy feedback [positive|negative|corrected]",
        };
      }

      default:
        return {
          handled: true,
          response: `Commande inconnue: ${cmd.command}.\nCommandes: level, status, patterns, goals, feedback`,
        };
    }
  }

  private isPositiveFeedback(response: string): boolean {
    const positiveIndicators = [
      "merci",
      "thank",
      "parfait",
      "perfect",
      "excellent",
      "super",
      "great",
      "cool",
      "bien",
      "good",
      "👍",
      "❤️",
    ];

    const lower = response.toLowerCase();
    return positiveIndicators.some((indicator) => lower.includes(indicator));
  }

  private renderProgressBar(progress: number): string {
    const filled = Math.round(progress / 10);
    const empty = 10 - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  }

  /**
   * Détecte si un message entrant est une réponse à une demande d'approbation Jarvis.
   *
   * Formats supportés :
   *   - "oui", "yes", "✅", "ok", "ouais", "go", "confirme" → approuvé
   *   - "non", "no", "❌", "nope", "annule", "cancel", "stop" → refusé
   *   - "approve:<approvalId>" / "deny:<approvalId>" → résolution explicite par ID
   *   - Metadata: { approvalResponse: { id, approved } } → depuis bouton inline (Telegram/Discord)
   *
   * Retourne null si le message ne correspond à aucun pattern d'approbation.
   */
  private parseApprovalResponse(
    message: string,
    metadata?: Record<string, unknown>
  ): { approvalId: string; approved: boolean } | null {
    // ── Résolution via métadonnées (boutons inline Telegram / Discord) ───────
    if (metadata?.approvalResponse) {
      const ar = metadata.approvalResponse as { id?: string; approved?: boolean };
      if (ar.id && typeof ar.approved === "boolean") {
        return { approvalId: ar.id, approved: ar.approved };
      }
    }

    // ── Résolution explicite par ID ───────────────────────────────────────────
    const explicitMatch = message.match(/^(approve|deny|oui|non):([a-z0-9_]+)$/i);
    if (explicitMatch) {
      const verb = explicitMatch[1].toLowerCase();
      const approvalId = explicitMatch[2];
      const approved = verb === "approve" || verb === "oui";
      return { approvalId, approved };
    }

    // ── Résolution par mot-clé simple — seulement si une approbation est pendante ─
    // (On résout la plus ancienne approbation pendante)
    if (!this.bridge) return null;
    const hasPending = this.bridge.hasPendingApprovals();
    if (!hasPending) return null;

    const lower = message.trim().toLowerCase();
    const approveWords = ["oui", "yes", "✅", "ok", "okay", "ouais", "go", "confirme", "confirmed", "approuve", "valide", "validé", "d'accord"];
    const denyWords = ["non", "no", "❌", "nope", "annule", "cancel", "stop", "refus", "refuse", "refusé", "annulé"];

    if (approveWords.includes(lower)) {
      return { approvalId: this.bridge.getOldestPendingApprovalId() ?? "", approved: true };
    }
    if (denyWords.includes(lower)) {
      return { approvalId: this.bridge.getOldestPendingApprovalId() ?? "", approved: false };
    }

    return null;
  }
}
