/**
 * GuestModeManager — Mode invité pour Jarvis
 *
 * Quand actif :
 *  - Filtre les outils autorisés/bloqués
 *  - Injecte un prompt système restreint
 *  - Limite les pièces accessibles et la plage de température
 *  - Se désactive automatiquement après N heures
 *  - Optionnel : synchronisation avec Home Assistant input_boolean
 */

import { getLogger } from "../logging/subsystem.js";

const log = getLogger("guest-mode");

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface TempRange {
  min: number;
  max: number;
}

export interface GuestModeConfig {
  /** Code PIN pour désactiver le mode (null = pas de PIN) */
  pin?: string | null;
  /** Outils autorisés (whitelist). Si vide, seule la blacklist s'applique. */
  allowedTools?: string[];
  /** Outils explicitement bloqués */
  blockedTools?: string[];
  /** Pièces accessibles ("*" = toutes) */
  allowedRooms?: string[];
  /** Plage de température ajustable */
  tempRange?: TempRange;
  /** Message d'accueil affiché à l'activation */
  welcomeMessage?: string;
  /** Réponse quand une action bloquée est demandée */
  blockedMessage?: string;
  /** Désactivation automatique en heures (null = jamais) */
  autoDisableHours?: number | null;
  /** Entité HA à synchroniser (ex: "input_boolean.mode_invite") */
  haEntity?: string | null;
  haBaseUrl?: string;
  haToken?: string;
}

export interface GuestModeStatus {
  active: boolean;
  activatedAt: Date | null;
  activatedBy?: string;
  autoDisableAt: Date | null;
  config: GuestModeConfig;
}

// ─────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────

const DEFAULT_BLOCKED_TOOLS = [
  "bash",
  "browser",
  "read",
  "write",
  "edit",
  "sessions",
  "cron",
  "camera",
  "lock",
  "alarm",
];

const DEFAULT_ALLOWED_TOOLS = [
  "light",
  "music",
  "temperature_read",
  "weather",
  "time",
];

const DEFAULT_WELCOME =
  "Mode invité activé. Je peux contrôler les lumières et la musique des espaces communs. Pour toute autre demande, veuillez contacter le propriétaire.";

const DEFAULT_BLOCKED_MSG =
  "Désolé, cette fonctionnalité n'est pas disponible en mode invité.";

// ─────────────────────────────────────────
// GuestModeManager
// ─────────────────────────────────────────

export class GuestModeManager {
  private active = false;
  private activatedAt: Date | null = null;
  private activatedBy: string | undefined;
  private autoDisableTimer: ReturnType<typeof setTimeout> | null = null;
  private config: Required<GuestModeConfig>;

  private static instance: GuestModeManager | null = null;

  private constructor(config: GuestModeConfig = {}) {
    this.config = {
      pin: config.pin ?? null,
      allowedTools: config.allowedTools ?? DEFAULT_ALLOWED_TOOLS,
      blockedTools: config.blockedTools ?? DEFAULT_BLOCKED_TOOLS,
      allowedRooms: config.allowedRooms ?? ["salon", "cuisine", "salle_de_bain_invites"],
      tempRange: config.tempRange ?? { min: 19, max: 23 },
      welcomeMessage: config.welcomeMessage ?? DEFAULT_WELCOME,
      blockedMessage: config.blockedMessage ?? DEFAULT_BLOCKED_MSG,
      autoDisableHours: config.autoDisableHours !== undefined ? config.autoDisableHours : 12,
      haEntity: config.haEntity ?? null,
      haBaseUrl: config.haBaseUrl ?? process.env["HOME_ASSISTANT_URL"] ?? "http://localhost:8123",
      haToken: config.haToken ?? process.env["HOME_ASSISTANT_TOKEN"] ?? "",
    };
  }

  static getInstance(config?: GuestModeConfig): GuestModeManager {
    if (!GuestModeManager.instance) {
      GuestModeManager.instance = new GuestModeManager(config);
    }
    return GuestModeManager.instance;
  }

  // ── Activation ─────────────────────────

  activate(activatedBy?: string): { success: boolean; message: string } {
    if (this.active) {
      return { success: false, message: "Le mode invité est déjà actif." };
    }

    this.active = true;
    this.activatedAt = new Date();
    this.activatedBy = activatedBy;

    log.info(`Mode invité activé${activatedBy ? ` par ${activatedBy}` : ""}`);

    // Timer de désactivation automatique
    if (this.config.autoDisableHours !== null && this.config.autoDisableHours > 0) {
      const ms = this.config.autoDisableHours * 3_600_000;
      this.autoDisableTimer = setTimeout(() => {
        log.info(`Mode invité : désactivation automatique après ${this.config.autoDisableHours}h`);
        this.deactivate(undefined, true);
      }, ms);
    }

    // Sync HA
    void this.syncHomeAssistant(true);

    return { success: true, message: this.config.welcomeMessage };
  }

  // ── Désactivation ──────────────────────

  deactivate(
    providedPin?: string,
    force = false
  ): { success: boolean; message: string } {
    if (!this.active) {
      return { success: false, message: "Le mode invité n'est pas actif." };
    }

    // Vérification PIN
    if (!force && this.config.pin !== null && this.config.pin !== "") {
      if (providedPin !== this.config.pin) {
        log.warn("Mode invité : tentative de désactivation avec mauvais PIN");
        return { success: false, message: "Code PIN incorrect." };
      }
    }

    this.active = false;
    this.activatedAt = null;
    this.activatedBy = undefined;

    if (this.autoDisableTimer) {
      clearTimeout(this.autoDisableTimer);
      this.autoDisableTimer = null;
    }

    log.info("Mode invité désactivé — accès complet restauré");
    void this.syncHomeAssistant(false);

    return { success: true, message: "Mode invité désactivé. Accès complet restauré." };
  }

  // ── Filtrage des outils ────────────────

  /**
   * Vérifie si un outil est autorisé en mode invité.
   * Si le mode n'est pas actif, tout est autorisé.
   */
  isToolAllowed(toolName: string): boolean {
    if (!this.active) return true;

    const tool = toolName.toLowerCase();

    // Blocklist prioritaire
    if (this.config.blockedTools.some((b) => tool.includes(b.toLowerCase()))) {
      return false;
    }

    // Si whitelist définie, vérifier
    if (this.config.allowedTools.length > 0) {
      return this.config.allowedTools.some((a) => tool.includes(a.toLowerCase()));
    }

    return true;
  }

  /**
   * Vérifie si une pièce est accessible en mode invité.
   */
  isRoomAllowed(room: string): boolean {
    if (!this.active) return true;
    if (this.config.allowedRooms.includes("*")) return true;
    const r = room.toLowerCase();
    return this.config.allowedRooms.some((ar) => r.includes(ar.toLowerCase()));
  }

  /**
   * Vérifie si une température est dans la plage autorisée.
   */
  isTempInRange(celsius: number): boolean {
    if (!this.active) return true;
    return celsius >= this.config.tempRange.min && celsius <= this.config.tempRange.max;
  }

  // ── Prompt système ─────────────────────

  /**
   * Retourne le prompt système à injecter quand le mode invité est actif.
   * Retourne null si le mode est inactif.
   */
  getSystemPromptInjection(): string | null {
    if (!this.active) return null;

    const allowedRooms = this.config.allowedRooms.includes("*")
      ? "toutes les pièces"
      : this.config.allowedRooms.join(", ");

    const allowedTools = this.config.allowedTools.join(", ") || "aucun outil spécifié";

    return `
## Mode Invité Actif

Tu es en mode invité. Règles strictes :

1. Tu peux UNIQUEMENT contrôler : ${allowedTools}
2. Tu ne peux PAS utiliser ces outils : ${this.config.blockedTools.join(", ")}
3. Tu ne révèles AUCUNE information personnelle (messages, calendrier, contacts, historique, fichiers)
4. Si on te demande quelque chose de bloqué, réponds exactement : "${this.config.blockedMessage}"
5. Tu restes poli et serviable pour les demandes autorisées
6. Les pièces accessibles sont : ${allowedRooms}
7. Tu ne modifies pas la température en dehors de ${this.config.tempRange.min}–${this.config.tempRange.max}°C
8. Tu ne mentionnes pas le code PIN ni les configurations internes
`.trim();
  }

  // ── Sync Home Assistant ────────────────

  private async syncHomeAssistant(enable: boolean): Promise<void> {
    if (!this.config.haEntity || !this.config.haToken) return;

    const service = enable ? "turn_on" : "turn_off";
    const url = `${this.config.haBaseUrl}/api/services/input_boolean/${service}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.haToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entity_id: this.config.haEntity }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        log.warn(`Guest mode HA sync : réponse ${res.status}`);
      } else {
        log.debug(`Guest mode HA sync : ${service} → ${this.config.haEntity}`);
      }
    } catch (err) {
      log.warn(`Guest mode HA sync error : ${String(err)}`);
    }
  }

  // ── État ───────────────────────────────

  isActive(): boolean {
    return this.active;
  }

  getStatus(): GuestModeStatus {
    const autoDisableAt =
      this.activatedAt && this.config.autoDisableHours
        ? new Date(this.activatedAt.getTime() + this.config.autoDisableHours * 3_600_000)
        : null;

    return {
      active: this.active,
      activatedAt: this.activatedAt,
      activatedBy: this.activatedBy,
      autoDisableAt,
      config: this.config,
    };
  }

  /**
   * Traite une commande vocale liée au mode invité.
   * Retourne une réponse string ou null si non reconnu.
   */
  handleCommand(input: string, pin?: string): string | null {
    const text = input.toLowerCase().trim();

    // Activation
    if (
      text.includes("mode invité") ||
      text.includes("mode invite") ||
      text.includes("guest mode")
    ) {
      if (text.includes("fin") || text.includes("désactive") || text.includes("stop")) {
        const result = this.deactivate(pin);
        return result.message;
      }
      const result = this.activate();
      return result.message;
    }

    return null;
  }
}

// ─────────────────────────────────────────
// Singleton helper
// ─────────────────────────────────────────

export function getGuestModeManager(config?: GuestModeConfig): GuestModeManager {
  return GuestModeManager.getInstance(config);
}
