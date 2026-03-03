/**
 * Jarvis Proactive Engine — Moteur de suggestions proactives
 *
 * Ce module analyse les patterns appris et envoie des suggestions proactives
 * basées sur l'heure, la localisation, les habitudes et le contexte utilisateur.
 * C'est le cœur du comportement "Iron Man Jarvis" — agir avant qu'on le demande.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import type { LearnedPattern } from "./types.js";
import { getJarvisBridge, formatJarvisMessage } from "./jarvis-bridge.js";

const log = createSubsystemLogger("autonomy:proactive");

// ============================================================================
// Types du moteur proactif
// ============================================================================

export type TimeWindow = {
  label: string;
  startHour: number;
  endHour: number;
};

export type ProactiveSuggestion = {
  id: string;
  trigger: "time" | "pattern" | "context" | "habit";
  message: string;
  action?: string;
  scheduledAt: Date;
  fired: boolean;
};

export type ProactiveEngineConfig = {
  enabled: boolean;
  /** Heure de début du silence nocturne (22h par défaut) */
  quietHourStart: number;
  /** Heure de fin du silence nocturne (7h par défaut) */
  quietHourEnd: number;
  /** Intervalle de vérification en minutes */
  checkIntervalMinutes: number;
};

const DEFAULT_CONFIG: ProactiveEngineConfig = {
  enabled: true,
  quietHourStart: 22,
  quietHourEnd: 7,
  checkIntervalMinutes: 15,
};

// ============================================================================
// Suggestions intégrées par défaut (personnalité Jarvis)
// ============================================================================

type BuiltinSuggestion = {
  id: string;
  timeWindow: TimeWindow;
  message: string;
  /** Jours de la semaine (0=dim … 6=sam). undefined = tous les jours */
  daysOfWeek?: number[];
  /** Nombre max de fois à déclencher par jour */
  maxPerDay: number;
};

const BUILTIN_SUGGESTIONS: BuiltinSuggestion[] = [
  {
    id: "morning-briefing",
    timeWindow: { label: "Matin", startHour: 7, endHour: 9 },
    message: "Si je puis me permettre, Monsieur — voici votre briefing matinal. Vos systèmes sont opérationnels et je suis prêt à vous assister.",
    daysOfWeek: [1, 2, 3, 4, 5], // Lun-Ven
    maxPerDay: 1,
  },
  {
    id: "midday-check",
    timeWindow: { label: "Midi", startHour: 12, endHour: 13 },
    message: "Monsieur, il est l'heure du déjeuner. Je surveille vos systèmes en votre absence.",
    maxPerDay: 1,
  },
  {
    id: "end-of-day",
    timeWindow: { label: "Fin de journée", startHour: 17, endHour: 19 },
    message: "Fin de journée, Monsieur. Souhaitez-vous que je prépare un résumé de vos activités et automatise votre routine du soir ?",
    daysOfWeek: [1, 2, 3, 4, 5],
    maxPerDay: 1,
  },
  {
    id: "weekend-morning",
    timeWindow: { label: "Week-end matin", startHour: 9, endHour: 11 },
    message: "Bonjour, Monsieur. Profitez de votre week-end. Je reste disponible pour tout ce dont vous aurez besoin.",
    daysOfWeek: [0, 6], // Sam-Dim
    maxPerDay: 1,
  },
];

// ============================================================================
// ProactiveEngine
// ============================================================================

export class ProactiveEngine {
  private config: ProactiveEngineConfig;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private firedToday: Map<string, number> = new Map(); // suggestionId -> count today
  private lastResetDate: string = "";

  constructor(config: Partial<ProactiveEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info("ProactiveEngine initialisé");
  }

  /**
   * Démarre le moteur proactif
   */
  start(): void {
    if (!this.config.enabled) {
      log.info("ProactiveEngine désactivé dans la config");
      return;
    }

    log.info(`ProactiveEngine démarré (vérification toutes les ${this.config.checkIntervalMinutes}min)`);

    this.checkInterval = setInterval(
      () => this.runCheck(),
      this.config.checkIntervalMinutes * 60 * 1000
    );

    if (this.checkInterval.unref) {
      this.checkInterval.unref();
    }
  }

  /**
   * Arrête le moteur
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    log.info("ProactiveEngine arrêté");
  }

  /**
   * Cycle de vérification principal
   */
  private async runCheck(): Promise<void> {
    this.resetDailyCountsIfNeeded();

    if (this.isQuietHour()) {
      log.debug("Heure de silence — pas de suggestions proactives");
      return;
    }

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    for (const suggestion of BUILTIN_SUGGESTIONS) {
      if (this.shouldFire(suggestion, hour, dayOfWeek)) {
        await this.fireSuggestion(suggestion);
      }
    }
  }

  /**
   * Déclenche une suggestion depuis un pattern appris
   */
  async firePatternSuggestion(pattern: LearnedPattern): Promise<void> {
    if (this.isQuietHour()) return;

    const bridge = getJarvisBridge();
    const message = formatJarvisMessage(
      "suggestion",
      `D'après vos habitudes, il est probable que vous souhaitiez : ${pattern.description}`,
      `Confiance : ${Math.round(pattern.confidence * 100)}% — observé ${pattern.frequency} fois`
    );

    await bridge.notify({ message, level: "suggestion" });
    log.info(`Suggestion proactive envoyée : pattern "${pattern.name}"`);
  }

  /**
   * Vérifie si une suggestion doit être déclenchée maintenant
   */
  private shouldFire(suggestion: BuiltinSuggestion, hour: number, dayOfWeek: number): boolean {
    // Vérifier les jours de la semaine
    if (suggestion.daysOfWeek && !suggestion.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    // Vérifier la fenêtre temporelle
    if (hour < suggestion.timeWindow.startHour || hour >= suggestion.timeWindow.endHour) {
      return false;
    }

    // Vérifier le quota journalier
    const firedCount = this.firedToday.get(suggestion.id) ?? 0;
    return firedCount < suggestion.maxPerDay;
  }

  /**
   * Envoie une suggestion et enregistre le déclenchement
   */
  private async fireSuggestion(suggestion: BuiltinSuggestion): Promise<void> {
    const bridge = getJarvisBridge();
    await bridge.notify({
      message: suggestion.message,
      level: "suggestion",
      metadata: { suggestionId: suggestion.id, trigger: "time" },
    });

    const current = this.firedToday.get(suggestion.id) ?? 0;
    this.firedToday.set(suggestion.id, current + 1);
    log.info(`Suggestion proactive déclenchée : ${suggestion.id}`);
  }

  /**
   * Vérifie si c'est une heure de silence (pas de notifications)
   */
  private isQuietHour(): boolean {
    const hour = new Date().getHours();
    if (this.config.quietHourStart > this.config.quietHourEnd) {
      // Traverse minuit : ex. 22h-7h
      return hour >= this.config.quietHourStart || hour < this.config.quietHourEnd;
    }
    return hour >= this.config.quietHourStart && hour < this.config.quietHourEnd;
  }

  /**
   * Remet à zéro les compteurs journaliers si le jour a changé
   */
  private resetDailyCountsIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.firedToday.clear();
      this.lastResetDate = today;
      log.debug("Compteurs journaliers de suggestions remis à zéro");
    }
  }

  /**
   * Retourne les statistiques du moteur
   */
  getStats(): { enabled: boolean; firedToday: Record<string, number>; isQuietHour: boolean } {
    return {
      enabled: this.config.enabled,
      firedToday: Object.fromEntries(this.firedToday),
      isQuietHour: this.isQuietHour(),
    };
  }
}
