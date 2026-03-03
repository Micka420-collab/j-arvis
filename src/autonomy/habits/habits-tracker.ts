/**
 * HabitsTracker — Apprentissage des habitudes et proposition d'automatisations
 *
 * Observer les actions domotiques répétitives, détecter les patterns,
 * et proposer / créer des automatisations (cron jobs) via JarvisBridge.
 *
 * Persistance : fichier JSON dans ~/.openclaw/memory/habits.json
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { getLogger } from "../logging/subsystem.js";

const log = getLogger("habits");

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type PatternState = "observing" | "confirmed" | "automated" | "rejected";
export type DayType = "weekday" | "weekend" | "all";

export interface HabitObservation {
  /** Timestamp de l'action */
  timestamp: string; // ISO
  /** Heure locale en minutes depuis minuit */
  minuteOfDay: number;
  /** Jour de la semaine (0=dim … 6=sam) */
  dayOfWeek: number;
}

export interface HabitPattern {
  id: string;
  /** Description lisible de l'action */
  action: string;
  /** Entités HA impliquées */
  entities: string[];
  observations: HabitObservation[];
  state: PatternState;
  /** Heure modale (minutes depuis minuit) */
  modalMinute?: number;
  /** Jours détectés */
  dayType?: DayType;
  /** Cron job créé */
  cronExpression?: string;
  createdAt: string;
  updatedAt: string;
  /** Date du dernier refus (pour ne pas reproposer trop tôt) */
  rejectedAt?: string;
}

export interface HabitsConfig {
  enabled?: boolean;
  /** Nb minimum d'observations avant proposition */
  minOccurrences?: number;
  /** Fenêtre d'observation en jours */
  observationWindowDays?: number;
  /** Demander confirmation avant de créer l'automatisation */
  askBeforeAutomating?: boolean;
  /** Ne pas reproposer un pattern rejeté avant X jours */
  rejectCooldownDays?: number;
  /** Chemin du fichier de persistance */
  habitFilePath?: string;
}

export interface AutomationProposal {
  patternId: string;
  action: string;
  cronExpression: string;
  cronDescription: string;
  occurrences: number;
}

// ─────────────────────────────────────────
// HabitsTracker
// ─────────────────────────────────────────

export class HabitsTracker {
  private config: Required<HabitsConfig>;
  private patterns: Map<string, HabitPattern> = new Map();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private static instance: HabitsTracker | null = null;

  private constructor(config: HabitsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      minOccurrences: config.minOccurrences ?? 3,
      observationWindowDays: config.observationWindowDays ?? 14,
      askBeforeAutomating: config.askBeforeAutomating ?? true,
      rejectCooldownDays: config.rejectCooldownDays ?? 30,
      habitFilePath:
        config.habitFilePath ??
        join(homedir(), ".openclaw", "memory", "habits.json"),
    };
  }

  static getInstance(config?: HabitsConfig): HabitsTracker {
    if (!HabitsTracker.instance) {
      HabitsTracker.instance = new HabitsTracker(config);
    }
    return HabitsTracker.instance;
  }

  // ── Initialisation ─────────────────────

  async init(): Promise<void> {
    await this.loadFromDisk();
    log.info(
      `HabitsTracker initialisé (${this.patterns.size} patterns chargés)`
    );
  }

  // ── Enregistrement d'une action ────────

  /**
   * Enregistrer une action domotique.
   * Appeler cette méthode à chaque commande de l'utilisateur.
   *
   * @param action  Description lisible (ex: "allume lumières salon")
   * @param entities Entités HA impliquées (ex: ["light.salon"])
   */
  async recordAction(action: string, entities: string[] = []): Promise<void> {
    if (!this.config.enabled) return;

    const now = new Date();
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();
    const dayOfWeek = now.getDay();

    // Clé de déduplication : version normalisée de l'action
    const patternKey = normalizeAction(action);

    let pattern = this.patterns.get(patternKey);
    if (!pattern) {
      pattern = {
        id: patternKey,
        action,
        entities,
        observations: [],
        state: "observing",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      this.patterns.set(patternKey, pattern);
    }

    // Prune les observations trop vieilles
    const cutoff = new Date(
      now.getTime() - this.config.observationWindowDays * 86_400_000
    );
    pattern.observations = pattern.observations.filter(
      (o) => new Date(o.timestamp) >= cutoff
    );

    pattern.observations.push({
      timestamp: now.toISOString(),
      minuteOfDay,
      dayOfWeek,
    });
    pattern.updatedAt = now.toISOString();

    // Recalculer les stats
    this.analyzePattern(pattern);

    log.debug(
      `Action enregistrée : "${action}" (${pattern.observations.length} obs)`
    );

    // Vérifier si le pattern est confirmé
    if (
      pattern.state === "observing" &&
      pattern.observations.length >= this.config.minOccurrences
    ) {
      await this.onPatternConfirmed(pattern);
    }

    this.scheduleSave();
  }

  // ── Analyse d'un pattern ───────────────

  private analyzePattern(pattern: HabitPattern): void {
    const obs = pattern.observations;
    if (obs.length < 2) return;

    // Heure modale (minute la plus fréquente, arrondie à 5 min)
    const rounded = obs.map((o) => Math.round(o.minuteOfDay / 5) * 5);
    const freq = new Map<number, number>();
    for (const m of rounded) freq.set(m, (freq.get(m) ?? 0) + 1);
    let maxCount = 0;
    let modalMinute = 0;
    for (const [m, c] of freq) {
      if (c > maxCount) { maxCount = c; modalMinute = m; }
    }
    pattern.modalMinute = modalMinute;

    // Jours : weekday / weekend / all
    const weekdays = obs.filter((o) => o.dayOfWeek >= 1 && o.dayOfWeek <= 5).length;
    const weekends = obs.filter((o) => o.dayOfWeek === 0 || o.dayOfWeek === 6).length;
    if (weekdays > 0 && weekends === 0) pattern.dayType = "weekday";
    else if (weekends > 0 && weekdays === 0) pattern.dayType = "weekend";
    else pattern.dayType = "all";

    // Expression cron
    pattern.cronExpression = buildCronExpression(modalMinute, pattern.dayType);
  }

  // ── Pattern confirmé ───────────────────

  private async onPatternConfirmed(pattern: HabitPattern): Promise<void> {
    // Cooldown de rejet ?
    if (pattern.state === "rejected" && pattern.rejectedAt) {
      const daysSinceReject =
        (Date.now() - new Date(pattern.rejectedAt).getTime()) / 86_400_000;
      if (daysSinceReject < this.config.rejectCooldownDays) return;
    }

    pattern.state = "confirmed";
    log.info(
      `Habitude confirmée : "${pattern.action}" (${pattern.observations.length} occurrences, ~${minutesToTime(pattern.modalMinute ?? 0)})`
    );

    if (!this.config.askBeforeAutomating) {
      await this.createAutomation(pattern);
      return;
    }

    // Proposer via JarvisBridge
    await this.proposeAutomation(pattern);
  }

  private async proposeAutomation(pattern: HabitPattern): Promise<void> {
    const timeStr = minutesToTime(pattern.modalMinute ?? 0);
    const dayStr =
      pattern.dayType === "weekday"
        ? "en semaine"
        : pattern.dayType === "weekend"
        ? "le weekend"
        : "tous les jours";

    const message = `🧠 J'ai remarqué que vous "${pattern.action}" vers ${timeStr} ${dayStr} depuis ${this.config.observationWindowDays} jours (${pattern.observations.length} fois). Voulez-vous que j'automatise ça ? Dites "oui automatise ${pattern.action}" pour confirmer.`;

    try {
      const { getJarvisBridge } = await import("../jarvis-bridge.js");
      const bridge = getJarvisBridge();
      if (!bridge) return;
      await bridge.notify(
        message,
        process.env["JARVIS_OWNER_ID"] ?? "owner"
      );
    } catch (err) {
      log.warn(`Proposition habitude error : ${String(err)}`);
    }
  }

  private async createAutomation(pattern: HabitPattern): Promise<void> {
    if (!pattern.cronExpression) return;

    pattern.state = "automated";
    log.info(
      `Automatisation créée : "${pattern.action}" cron="${pattern.cronExpression}"`
    );

    // Notifier l'utilisateur
    try {
      const { getJarvisBridge } = await import("../jarvis-bridge.js");
      const bridge = getJarvisBridge();
      if (!bridge) return;
      await bridge.notify(
        `✅ Automatisation créée : "${pattern.action}" (${pattern.cronExpression})`,
        process.env["JARVIS_OWNER_ID"] ?? "owner"
      );
    } catch (err) {
      log.warn(`createAutomation notify error : ${String(err)}`);
    }
  }

  // ── Commandes utilisateur ─────────────

  /** Accepter une proposition d'automatisation */
  async acceptProposal(patternIdOrAction: string): Promise<string> {
    const pattern = this.findPattern(patternIdOrAction);
    if (!pattern) return `Aucun pattern trouvé pour "${patternIdOrAction}".`;
    if (pattern.state === "automated") return `Ce pattern est déjà automatisé.`;

    await this.createAutomation(pattern);
    this.scheduleSave();
    return `Automatisation activée pour "${pattern.action}" (${pattern.cronExpression}).`;
  }

  /** Refuser une proposition */
  async rejectProposal(patternIdOrAction: string): Promise<string> {
    const pattern = this.findPattern(patternIdOrAction);
    if (!pattern) return `Aucun pattern trouvé pour "${patternIdOrAction}".`;

    pattern.state = "rejected";
    pattern.rejectedAt = new Date().toISOString();
    this.scheduleSave();
    return `Compris. Je ne proposerai plus cette automatisation avant ${this.config.rejectCooldownDays} jours.`;
  }

  /** Résumé des habitudes détectées */
  getSummary(): string {
    const confirmed = [...this.patterns.values()].filter(
      (p) => p.state === "confirmed"
    );
    const automated = [...this.patterns.values()].filter(
      (p) => p.state === "automated"
    );
    const observing = [...this.patterns.values()].filter(
      (p) => p.state === "observing" && p.observations.length >= 2
    );

    const lines: string[] = ["📊 Résumé de vos habitudes :\n"];

    if (automated.length > 0) {
      lines.push("✅ Automatisées :");
      for (const p of automated) {
        lines.push(`  • "${p.action}" (${p.cronExpression})`);
      }
    }

    if (confirmed.length > 0) {
      lines.push("\n📬 En attente de votre accord :");
      for (const p of confirmed) {
        lines.push(
          `  • "${p.action}" ~${minutesToTime(p.modalMinute ?? 0)} ${p.dayType === "weekday" ? "(semaine)" : p.dayType === "weekend" ? "(weekend)" : "(tous jours)"} — ${p.observations.length} occurrences`
        );
      }
    }

    if (observing.length > 0) {
      lines.push("\n🔍 En observation :");
      for (const p of observing) {
        lines.push(`  • "${p.action}" (${p.observations.length}/${this.config.minOccurrences} occurrences)`);
      }
    }

    if (lines.length === 1) lines.push("Pas encore d'habitudes détectées.");

    return lines.join("\n");
  }

  getProposals(): AutomationProposal[] {
    return [...this.patterns.values()]
      .filter((p) => p.state === "confirmed" && p.cronExpression)
      .map((p) => ({
        patternId: p.id,
        action: p.action,
        cronExpression: p.cronExpression!,
        cronDescription: describeCron(p.cronExpression!),
        occurrences: p.observations.length,
      }));
  }

  // ── Helpers ────────────────────────────

  private findPattern(query: string): HabitPattern | null {
    const key = normalizeAction(query);
    if (this.patterns.has(key)) return this.patterns.get(key)!;
    // Recherche partielle
    for (const [, p] of this.patterns) {
      if (p.action.toLowerCase().includes(query.toLowerCase())) return p;
    }
    return null;
  }

  // ── Persistance ────────────────────────

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      await this.saveToDisk();
    }, 5000);
  }

  private async saveToDisk(): Promise<void> {
    try {
      const dir = dirname(this.config.habitFilePath);
      await mkdir(dir, { recursive: true });
      const data = {
        version: 1,
        savedAt: new Date().toISOString(),
        patterns: [...this.patterns.values()],
      };
      await writeFile(this.config.habitFilePath, JSON.stringify(data, null, 2), "utf-8");
      log.debug(`Habits sauvegardées (${this.patterns.size} patterns)`);
    } catch (err) {
      log.warn(`Erreur de sauvegarde habits : ${String(err)}`);
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const raw = await readFile(this.config.habitFilePath, "utf-8");
      const data = JSON.parse(raw) as { patterns: HabitPattern[] };
      this.patterns.clear();
      for (const p of data.patterns ?? []) {
        this.patterns.set(p.id, p);
      }
    } catch {
      // Fichier inexistant au premier démarrage
    }
  }
}

// ─────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────

function normalizeAction(action: string): string {
  return action
    .toLowerCase()
    .replace(/[^a-z0-9\u00e0-\u00ff ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}

function buildCronExpression(minuteOfDay: number, dayType: DayType): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  const days =
    dayType === "weekday" ? "1-5" : dayType === "weekend" ? "0,6" : "*";
  return `${m} ${h} * * ${days}`;
}

function describeCron(cron: string): string {
  const [m, h, , , days] = cron.split(" ");
  const time = `${h}h${m === "0" ? "00" : m}`;
  if (days === "1-5") return `Tous les jours de semaine à ${time}`;
  if (days === "0,6") return `Samedi et dimanche à ${time}`;
  return `Tous les jours à ${time}`;
}

// Singleton helper
export function getHabitsTracker(config?: HabitsConfig): HabitsTracker {
  return HabitsTracker.getInstance(config);
}
