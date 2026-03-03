/**
 * SmartNotifier — Alertes domotiques intelligentes
 *
 * Surveille les capteurs Home Assistant et envoie des alertes via JarvisBridge
 * quand des seuils sont dépassés :
 *  - Mouvement (mode absent uniquement)
 *  - Température hors plage
 *  - Portes/fenêtres ouvertes trop longtemps
 *  - Consommation électrique anormale
 *  - Fuite d'eau
 *  - Fumée / CO2 (priorité maximale)
 */

import { getLogger } from "../logging/subsystem.js";

const log = getLogger("smart-notifier");

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type AlertType =
  | "motion"
  | "temperature"
  | "opening"
  | "energy"
  | "water"
  | "smoke";

export interface AlertConfig {
  enabled?: boolean;
  /** Ne notifier que si le mode absent est actif (motion) */
  onlyWhenAway?: boolean;
  /** Cooldown entre deux alertes du même type (minutes) */
  cooldownMinutes?: number;
  /** Entités HA à surveiller */
  entities?: string[];
  /** Température minimale (°C) */
  minTemp?: number;
  /** Température maximale (°C) */
  maxTemp?: number;
  /** Durée max d'ouverture (minutes) avant alerte */
  maxOpenMinutes?: number;
  /** Puissance max (W) avant alerte */
  maxWatts?: number;
  /** Notifier même si mode présent (pour fumée) */
  alwaysNotify?: boolean;
}

export interface NotificationsConfig {
  enabled?: boolean;
  /** Canal par défaut */
  defaultChannel?: string;
  /** Destinataire par défaut */
  defaultRecipient?: string;
  /** Entité HA du mode absent : "input_boolean.mode_absent" */
  awayEntity?: string;
  alerts?: {
    motion?: AlertConfig;
    temperature?: AlertConfig;
    openings?: AlertConfig;
    energy?: AlertConfig;
    water?: AlertConfig;
    smoke?: AlertConfig;
  };
  haBaseUrl?: string;
  haToken?: string;
  /** Fréquence de polling (secondes) */
  pollIntervalSeconds?: number;
}

export interface SentAlert {
  type: AlertType;
  entity: string;
  message: string;
  sentAt: Date;
}

interface OpeningTimer {
  entity: string;
  openedAt: Date;
  alertSent: boolean;
}

// ─────────────────────────────────────────
// SmartNotifier
// ─────────────────────────────────────────

export class SmartNotifier {
  private config: NotificationsConfig;
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private alertHistory: Map<string, Date> = new Map(); // key → dernière alerte
  private openingTimers: Map<string, OpeningTimer> = new Map();
  private awayMode = false;
  private sentAlerts: SentAlert[] = [];

  private static instance: SmartNotifier | null = null;

  private constructor(config: NotificationsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      defaultChannel: config.defaultChannel ?? "telegram",
      defaultRecipient: config.defaultRecipient ?? "",
      awayEntity: config.awayEntity ?? "input_boolean.mode_absent",
      pollIntervalSeconds: config.pollIntervalSeconds ?? 60,
      haBaseUrl: config.haBaseUrl ?? process.env["HOME_ASSISTANT_URL"] ?? "http://localhost:8123",
      haToken: config.haToken ?? process.env["HOME_ASSISTANT_TOKEN"] ?? "",
      alerts: {
        motion: {
          enabled: true,
          onlyWhenAway: true,
          cooldownMinutes: 5,
          entities: [],
          ...config.alerts?.motion,
        },
        temperature: {
          enabled: true,
          minTemp: 15,
          maxTemp: 30,
          cooldownMinutes: 60,
          entities: [],
          ...config.alerts?.temperature,
        },
        openings: {
          enabled: true,
          maxOpenMinutes: 30,
          cooldownMinutes: 60,
          entities: [],
          ...config.alerts?.openings,
        },
        energy: {
          enabled: true,
          maxWatts: 3000,
          cooldownMinutes: 30,
          entities: [],
          ...config.alerts?.energy,
        },
        water: {
          enabled: true,
          cooldownMinutes: 0, // toujours notifier
          alwaysNotify: true,
          entities: [],
          ...config.alerts?.water,
        },
        smoke: {
          enabled: true,
          cooldownMinutes: 0,
          alwaysNotify: true,
          entities: [],
          ...config.alerts?.smoke,
        },
      },
    };
  }

  static getInstance(config?: NotificationsConfig): SmartNotifier {
    if (!SmartNotifier.instance) {
      SmartNotifier.instance = new SmartNotifier(config);
    }
    return SmartNotifier.instance;
  }

  // ── Démarrage / Arrêt ─────────────────

  start(): void {
    if (this.running || !this.config.enabled) return;
    this.running = true;

    void this.poll();
    this.pollTimer = setInterval(
      () => void this.poll(),
      (this.config.pollIntervalSeconds ?? 60) * 1000
    );
    log.info(`SmartNotifier démarré (interval: ${this.config.pollIntervalSeconds}s)`);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    log.info("SmartNotifier arrêté");
  }

  // ── Poll principal ────────────────────

  private async poll(): Promise<void> {
    if (!this.config.haToken) return;

    // Mode absent
    this.awayMode = await this.fetchBooleanState(
      this.config.awayEntity ?? "input_boolean.mode_absent"
    );

    await Promise.all([
      this.checkMotion(),
      this.checkTemperatures(),
      this.checkOpenings(),
      this.checkEnergy(),
      this.checkWater(),
      this.checkSmoke(),
    ]);
  }

  // ── Vérifications par type ─────────────

  private async checkMotion(): Promise<void> {
    const cfg = this.config.alerts?.motion;
    if (!cfg?.enabled || !cfg.entities?.length) return;
    if (cfg.onlyWhenAway && !this.awayMode) return;

    for (const entity of cfg.entities) {
      const state = await this.fetchEntityState(entity);
      if (state === "on") {
        await this.maybeAlert(
          "motion",
          entity,
          cfg.cooldownMinutes ?? 5,
          `🚨 Mouvement détecté : ${entityLabel(entity)} (${timestamp()})`
        );
      }
    }
  }

  private async checkTemperatures(): Promise<void> {
    const cfg = this.config.alerts?.temperature;
    if (!cfg?.enabled || !cfg.entities?.length) return;

    for (const entity of cfg.entities) {
      const raw = await this.fetchEntityState(entity);
      const temp = parseFloat(raw);
      if (isNaN(temp)) continue;

      const minTemp = cfg.minTemp ?? 15;
      const maxTemp = cfg.maxTemp ?? 30;

      if (temp < minTemp) {
        await this.maybeAlert(
          "temperature",
          entity,
          cfg.cooldownMinutes ?? 60,
          `🌡️ Température trop basse : ${entityLabel(entity)} → ${temp}°C (seuil : ${minTemp}°C)`
        );
      } else if (temp > maxTemp) {
        await this.maybeAlert(
          "temperature",
          entity,
          cfg.cooldownMinutes ?? 60,
          `🌡️ Température trop élevée : ${entityLabel(entity)} → ${temp}°C (seuil : ${maxTemp}°C)`
        );
      }
    }
  }

  private async checkOpenings(): Promise<void> {
    const cfg = this.config.alerts?.openings;
    if (!cfg?.enabled || !cfg.entities?.length) return;

    const maxMinutes = cfg.maxOpenMinutes ?? 30;
    const now = new Date();

    for (const entity of cfg.entities) {
      const state = await this.fetchEntityState(entity);

      if (state === "on") {
        // Porte/fenêtre ouverte
        if (!this.openingTimers.has(entity)) {
          this.openingTimers.set(entity, {
            entity,
            openedAt: now,
            alertSent: false,
          });
        } else {
          const timer = this.openingTimers.get(entity)!;
          const openMinutes = (now.getTime() - timer.openedAt.getTime()) / 60_000;
          if (openMinutes >= maxMinutes && !timer.alertSent) {
            timer.alertSent = true;
            await this.maybeAlert(
              "opening",
              entity,
              cfg.cooldownMinutes ?? 60,
              `🔓 ${entityLabel(entity)} ouverte depuis ${Math.round(openMinutes)} minutes !`
            );
          }
        }
      } else {
        // Fermée — réinitialiser le timer
        this.openingTimers.delete(entity);
      }
    }
  }

  private async checkEnergy(): Promise<void> {
    const cfg = this.config.alerts?.energy;
    if (!cfg?.enabled || !cfg.entities?.length) return;

    for (const entity of cfg.entities) {
      const raw = await this.fetchEntityState(entity);
      const watts = parseFloat(raw);
      if (isNaN(watts)) continue;

      const maxWatts = cfg.maxWatts ?? 3000;
      if (watts > maxWatts) {
        await this.maybeAlert(
          "energy",
          entity,
          cfg.cooldownMinutes ?? 30,
          `⚡ Consommation anormale : ${watts}W (seuil : ${maxWatts}W)`
        );
      }
    }
  }

  private async checkWater(): Promise<void> {
    const cfg = this.config.alerts?.water;
    if (!cfg?.enabled || !cfg.entities?.length) return;

    for (const entity of cfg.entities) {
      const state = await this.fetchEntityState(entity);
      if (state === "on") {
        await this.maybeAlert(
          "water",
          entity,
          0, // toujours notifier
          `💧 ALERTE FUITE : ${entityLabel(entity)} ! Vérifiez immédiatement.`
        );
      }
    }
  }

  private async checkSmoke(): Promise<void> {
    const cfg = this.config.alerts?.smoke;
    if (!cfg?.enabled || !cfg.entities?.length) return;

    for (const entity of cfg.entities) {
      const state = await this.fetchEntityState(entity);
      if (state === "on") {
        await this.maybeAlert(
          "smoke",
          entity,
          0, // toujours notifier
          `🔥 ALERTE FUMÉE / CO2 : ${entityLabel(entity)} ! Évacuez et appelez les secours.`
        );
      }
    }
  }

  // ── Envoi d'alerte avec cooldown ───────

  private async maybeAlert(
    type: AlertType,
    entity: string,
    cooldownMinutes: number,
    message: string
  ): Promise<void> {
    const key = `${type}:${entity}`;
    const lastSent = this.alertHistory.get(key);

    if (lastSent && cooldownMinutes > 0) {
      const elapsed = (Date.now() - lastSent.getTime()) / 60_000;
      if (elapsed < cooldownMinutes) return;
    }

    this.alertHistory.set(key, new Date());
    this.sentAlerts.push({ type, entity, message, sentAt: new Date() });
    // Ne garder que les 200 dernières alertes en mémoire
    if (this.sentAlerts.length > 200) this.sentAlerts.shift();

    log.info(`Alerte ${type} : ${message}`);
    await this.sendNotification(message);
  }

  private async sendNotification(message: string): Promise<void> {
    try {
      const { getJarvisBridge } = await import("../jarvis-bridge.js");
      const bridge = getJarvisBridge();
      if (!bridge) {
        log.warn("JarvisBridge non disponible — notification ignorée");
        return;
      }
      await bridge.notify(message, process.env["JARVIS_OWNER_ID"] ?? "owner");
    } catch (err) {
      log.warn(`Erreur envoi notification : ${String(err)}`);
    }
  }

  // ── Appels HA ─────────────────────────

  private async fetchEntityState(entity: string): Promise<string> {
    if (!this.config.haToken) return "unknown";

    try {
      const url = `${this.config.haBaseUrl}/api/states/${entity}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.config.haToken}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return "unknown";
      const data = (await res.json()) as { state: string };
      return data.state ?? "unknown";
    } catch {
      return "unknown";
    }
  }

  private async fetchBooleanState(entity: string): Promise<boolean> {
    const state = await this.fetchEntityState(entity);
    return state === "on" || state === "true";
  }

  // ── Commandes manuelles ────────────────

  /** Rapport instantané de l'état des capteurs */
  async getSecurityReport(): Promise<string> {
    if (!this.config.haToken) {
      return "Home Assistant non configuré — impossible de générer un rapport.";
    }

    const lines: string[] = ["🔒 Rapport de sécurité :\n"];

    const motion = this.config.alerts?.motion?.entities ?? [];
    for (const e of motion) {
      const s = await this.fetchEntityState(e);
      lines.push(`  ${s === "on" ? "⚠️" : "✅"} ${entityLabel(e)} : ${s === "on" ? "mouvement détecté" : "calme"}`);
    }

    const openings = this.config.alerts?.openings?.entities ?? [];
    for (const e of openings) {
      const s = await this.fetchEntityState(e);
      lines.push(`  ${s === "on" ? "🔓" : "🔒"} ${entityLabel(e)} : ${s === "on" ? "ouverte" : "fermée"}`);
    }

    const temps = this.config.alerts?.temperature?.entities ?? [];
    for (const e of temps) {
      const s = await this.fetchEntityState(e);
      lines.push(`  🌡️ ${entityLabel(e)} : ${s}°C`);
    }

    lines.push(`\nMode absent : ${this.awayMode ? "✅ actif" : "❌ inactif"}`);
    return lines.join("\n");
  }

  setAwayMode(away: boolean): void {
    this.awayMode = away;
    log.info(`Mode absent : ${away ? "activé" : "désactivé"}`);
  }

  isAwayMode(): boolean { return this.awayMode; }

  getRecentAlerts(limit = 20): SentAlert[] {
    return this.sentAlerts.slice(-limit);
  }
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function entityLabel(entity: string): string {
  return entity
    .split(".")[1]
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) ?? entity;
}

function timestamp(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Singleton helper
export function getSmartNotifier(config?: NotificationsConfig): SmartNotifier {
  return SmartNotifier.getInstance(config);
}
