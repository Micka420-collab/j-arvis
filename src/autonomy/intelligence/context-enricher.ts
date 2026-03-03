/**
 * Enrichisseur de Contexte Intelligent
 * Intègre météo, calendrier, localisation, état émotionnel pour des décisions contextuelles
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("autonomy:context-enricher");

export type WeatherContext = {
  temperature: number;
  condition: "sunny" | "cloudy" | "rainy" | "snowy" | "stormy";
  humidity: number;
  isDaytime: boolean;
  uvIndex: number;
  forecast: string;
};

export type CalendarContext = {
  nextEvent?: {
    title: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    type: "work" | "personal" | "health" | "social";
  };
  freeTimeMinutes: number;
  busyUntil?: Date;
  dayOfWeek: number;
  isWeekend: boolean;
  isHoliday: boolean;
};

export type LocationContext = {
  isHome: boolean;
  isWork: boolean;
  currentLocation?: string;
  distanceFromHome?: number; // km
  geofence?: "home" | "work" | "gym" | "commute" | "unknown";
  travelMode?: "walking" | "driving" | "public-transport" | "stationary";
};

export type EmotionalContext = {
  detectedMood?: "happy" | "stressed" | "tired" | "focused" | "relaxed" | "unknown";
  stressLevel?: number; // 0-10
  energyLevel?: number; // 0-10
  lastInteractionSentiment: "positive" | "neutral" | "negative";
  conversationPace: "fast" | "normal" | "slow"; // Indicateur de stress/urgence
};

export type DeviceContext = {
  activeDevices: string[];
  screenOn: boolean;
  headphonesConnected: boolean;
  batteryLevel?: number;
  isCharging: boolean;
  lastActivityMinutes: number;
};

export type SocialContext = {
  homeAlone: boolean;
  peoplePresent: number;
  knownPeople?: string[];
  guestsExpected?: boolean;
};

export type RichContext = {
  timestamp: Date;
  weather?: WeatherContext;
  calendar: CalendarContext;
  location: LocationContext;
  emotional: EmotionalContext;
  device: DeviceContext;
  social: SocialContext;
  seasonal: {
    season: "spring" | "summer" | "autumn" | "winter";
    dayOfYear: number;
    sunHours: number;
  };
};

export class ContextEnricher {
  private lastContext?: RichContext;
  private contextHistory: RichContext[] = [];
  private maxHistorySize = 100;
  private messageHistory: Map<string, string[]> = new Map();
  private static readonly MESSAGE_HISTORY_SIZE = 20;

  /** Enregistre un message utilisateur dans le buffer circulaire */
  addMessage(userId: string, text: string): void {
    const buf = this.messageHistory.get(userId) ?? [];
    buf.push(text);
    if (buf.length > ContextEnricher.MESSAGE_HISTORY_SIZE) buf.shift();
    this.messageHistory.set(userId, buf);
  }

  /**
   * Collecte et enrichit le contexte actuel
   */
  async enrichContext(baseContext: {
    userId: string;
    timestamp: Date;
  }): Promise<RichContext> {
    log.debug("Enriching context...");

    const enriched: RichContext = {
      timestamp: baseContext.timestamp,
      calendar: await this.fetchCalendarContext(baseContext.userId),
      location: await this.fetchLocationContext(baseContext.userId),
      emotional: await this.inferEmotionalContext(baseContext.userId),
      device: await this.fetchDeviceContext(baseContext.userId),
      social: await this.inferSocialContext(baseContext.userId),
      seasonal: this.calculateSeasonalContext(baseContext.timestamp),
    };

    // Ajouter météo si disponible
    try {
      enriched.weather = await this.fetchWeatherContext(enriched.location);
    } catch {
      log.debug("Weather unavailable");
    }

    // Stocker dans l'historique
    this.contextHistory.push(enriched);
    if (this.contextHistory.length > this.maxHistorySize) {
      this.contextHistory.shift();
    }
    this.lastContext = enriched;

    return enriched;
  }

  /**
   * Prédit le contexte futur pour anticiper les besoins
   */
  predictFutureContext(minutesAhead: number = 30): Partial<RichContext> {
    if (this.contextHistory.length < 3) {
      return {};
    }

    const now = new Date();
    const futureTime = new Date(now.getTime() + minutesAhead * 60000);

    // Prédiction basée sur les patterns historiques
    const predictions: Partial<RichContext> = {
      calendar: this.predictCalendarContext(futureTime),
      location: this.predictLocationContext(futureTime),
      seasonal: this.calculateSeasonalContext(futureTime),
    };

    return predictions;
  }

  /**
   * Détecte les changements de contexte significatifs
   */
  detectContextChanges(): Array<{
    type: string;
    from: unknown;
    to: unknown;
    significance: number;
  }> {
    if (!this.lastContext || this.contextHistory.length < 2) {
      return [];
    }

    const changes: Array<{
      type: string;
      from: unknown;
      to: unknown;
      significance: number;
    }> = [];

    const previous = this.contextHistory[this.contextHistory.length - 2];
    const current = this.lastContext;

    // Changement de location
    if (previous.location.geofence !== current.location.geofence) {
      changes.push({
        type: "location_change",
        from: previous.location.geofence,
        to: current.location.geofence,
        significance: 8,
      });
    }

    // Changement d'état émotionnel
    if (previous.emotional.detectedMood !== current.emotional.detectedMood) {
      changes.push({
        type: "mood_change",
        from: previous.emotional.detectedMood,
        to: current.emotional.detectedMood,
        significance: 7,
      });
    }

    // Début/fin d'événement
    if (previous.calendar.nextEvent?.title !== current.calendar.nextEvent?.title) {
      changes.push({
        type: "calendar_change",
        from: previous.calendar.nextEvent?.title,
        to: current.calendar.nextEvent?.title,
        significance: 6,
      });
    }

    // Changement météo
    if (previous.weather?.condition !== current.weather?.condition) {
      changes.push({
        type: "weather_change",
        from: previous.weather?.condition,
        to: current.weather?.condition,
        significance: 5,
      });
    }

    return changes.sort((a, b) => b.significance - a.significance);
  }

  /**
   * Génère des suggestions basées sur le contexte enrichi
   */
  generateContextualSuggestions(context: RichContext): Array<{
    suggestion: string;
    reason: string;
    confidence: number;
    action?: string;
  }> {
    const suggestions: Array<{
      suggestion: string;
      reason: string;
      confidence: number;
      action?: string;
    }> = [];

    // Suggestion basée sur la météo
    if (context.weather) {
      if (context.weather.condition === "rainy" && context.location.isHome) {
        suggestions.push({
          suggestion: "Il pleut dehors, voulez-vous que je lance une playlist cozy ?",
          reason: "Météo pluvieuse détectée",
          confidence: 0.85,
          action: "media/play/cozy",
        });
      }

      if (context.weather.temperature > 30 && context.device.activeDevices.includes("ac")) {
        suggestions.push({
          suggestion: "Il fait chaud, je peux allumer la climatisation ?",
          reason: "Température élevée",
          confidence: 0.9,
          action: "domotic/ac/on",
        });
      }
    }

    // Suggestion basée sur le calendrier
    if (context.calendar.nextEvent) {
      const minutesUntilEvent =
        (context.calendar.nextEvent.startTime.getTime() - Date.now()) / 60000;

      if (minutesUntilEvent > 0 && minutesUntilEvent < 15) {
        suggestions.push({
          suggestion: `Votre "${context.calendar.nextEvent.title}" commence dans ${Math.round(minutesUntilEvent)} minutes`,
          reason: "Événement imminent",
          confidence: 0.95,
          action: "notification/reminder",
        });
      }
    }

    // Suggestion basée sur l'état émotionnel
    if (context.emotional.stressLevel && context.emotional.stressLevel > 7) {
      suggestions.push({
        suggestion: "Vous semblez stressé. Une pause de 5 minutes pourrait aider.",
        reason: "Niveau de stress élevé détecté",
        confidence: 0.75,
        action: "wellness/break-reminder",
      });
    }

    // Suggestion basée sur l'heure et la saison
    if (context.seasonal.sunHours < 8 && context.seasonal.season === "winter") {
      const hour = context.timestamp.getHours();
      if (hour === 16 || hour === 17) {
        suggestions.push({
          suggestion: "La nuit tombe tôt, allumer les lumières maintenant ?",
          reason: "Hiver - faible ensoleillement",
          confidence: 0.8,
          action: "domotic/lights/on",
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  // ============================================================================
  // Méthodes privées de collecte
  // ============================================================================

  private async fetchCalendarContext(_userId: string): Promise<CalendarContext> {
    const now = new Date();
    const defaults: CalendarContext = {
      freeTimeMinutes: 60,
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      isHoliday: false,
    };

    const haUrl = process.env["HOME_ASSISTANT_URL"] ?? "http://localhost:8123";
    const haToken = process.env["HOME_ASSISTANT_TOKEN"] ?? "";
    if (!haToken) return defaults;

    try {
      // Lister les entités calendrier disponibles
      const listRes = await fetch(`${haUrl}/api/calendars`, {
        headers: { Authorization: `Bearer ${haToken}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!listRes.ok) return defaults;

      const calendars = (await listRes.json()) as { entity_id: string }[];
      if (!calendars.length) return defaults;

      const calEntity = calendars[0]!.entity_id;
      const start = now.toISOString();
      const end = new Date(now.getTime() + 8 * 3_600_000).toISOString();

      const evtRes = await fetch(
        `${haUrl}/api/calendars/${calEntity}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { headers: { Authorization: `Bearer ${haToken}` }, signal: AbortSignal.timeout(4000) }
      );
      if (!evtRes.ok) return defaults;

      const events = (await evtRes.json()) as Array<{
        summary: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        location?: string;
      }>;
      if (!events.length) return defaults;

      const next = events[0]!;
      const startTime = new Date(next.start.dateTime ?? next.start.date ?? "");
      const endTime = new Date(next.end.dateTime ?? next.end.date ?? "");
      const minutesToNext = Math.max(0, (startTime.getTime() - now.getTime()) / 60_000);

      return {
        nextEvent: {
          title: next.summary,
          startTime,
          endTime,
          location: next.location,
          type: "personal",
        },
        freeTimeMinutes: Math.round(minutesToNext),
        busyUntil: endTime,
        dayOfWeek: now.getDay(),
        isWeekend: now.getDay() === 0 || now.getDay() === 6,
        isHoliday: false,
      };
    } catch {
      return defaults;
    }
  }

  private async fetchLocationContext(_userId: string): Promise<LocationContext> {
    try {
      const { getGeofencingManager } = await import("../geofencing/index.js");
      const manager = getGeofencingManager();
      const state = manager.getState(); // "home" | "away" | "unknown"
      const isHome = state === "home";
      return {
        isHome,
        isWork: false,
        geofence: isHome ? "home" : "unknown",
        travelMode: "stationary",
      };
    } catch {
      // Geofencing non disponible — valeur par défaut sûre
      return {
        isHome: true,
        isWork: false,
        geofence: "home",
        travelMode: "stationary",
      };
    }
  }

  private async inferEmotionalContext(userId: string): Promise<EmotionalContext> {
    // Analyser les patterns de messages récents
    const recentMessages = this.getRecentMessages(userId);

    let sentiment: EmotionalContext["lastInteractionSentiment"] = "neutral";
    let pace: EmotionalContext["conversationPace"] = "normal";

    // Analyse simplifiée
    const positiveWords = ["merci", "super", "génial", "parfait", "excellent"];
    const negativeWords = ["non", "erreur", "problème", "bug", "mauvais"];

    const text = recentMessages.join(" ").toLowerCase();
    const positiveCount = positiveWords.filter((w) => text.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => text.includes(w)).length;

    if (positiveCount > negativeCount) sentiment = "positive";
    else if (negativeCount > positiveCount) sentiment = "negative";

    return {
      detectedMood: "unknown",
      lastInteractionSentiment: sentiment,
      conversationPace: pace,
    };
  }

  private async fetchDeviceContext(_userId: string): Promise<DeviceContext> {
    const defaults: DeviceContext = {
      activeDevices: [],
      screenOn: true,
      headphonesConnected: false,
      isCharging: true,
      lastActivityMinutes: 5,
    };

    const haUrl = process.env["HOME_ASSISTANT_URL"] ?? "http://localhost:8123";
    const haToken = process.env["HOME_ASSISTANT_TOKEN"] ?? "";
    if (!haToken) return defaults;

    try {
      const res = await fetch(`${haUrl}/api/states`, {
        headers: { Authorization: `Bearer ${haToken}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return defaults;

      const states = (await res.json()) as Array<{
        entity_id: string;
        state: string;
        attributes?: { friendly_name?: string };
      }>;

      // Media players en cours de lecture
      const playing = states
        .filter(
          (s) =>
            s.entity_id.startsWith("media_player.") &&
            (s.state === "playing" || s.state === "on")
        )
        .map((s) => s.attributes?.friendly_name ?? s.entity_id);

      return {
        ...defaults,
        activeDevices: playing,
        screenOn: playing.length > 0,
      };
    } catch {
      return defaults;
    }
  }

  private async inferSocialContext(_userId: string): Promise<SocialContext> {
    const haUrl = process.env["HOME_ASSISTANT_URL"] ?? "http://localhost:8123";
    const haToken = process.env["HOME_ASSISTANT_TOKEN"] ?? "";

    if (!haToken) return { homeAlone: true, peoplePresent: 1 };

    try {
      const res = await fetch(`${haUrl}/api/states`, {
        headers: { Authorization: `Bearer ${haToken}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return { homeAlone: true, peoplePresent: 1 };

      const states = (await res.json()) as Array<{
        entity_id: string;
        state: string;
        attributes?: { friendly_name?: string };
      }>;

      const homePersons = states.filter(
        (s) => s.entity_id.startsWith("person.") && s.state === "home"
      );
      const count = homePersons.length;

      return {
        homeAlone: count <= 1,
        peoplePresent: Math.max(1, count),
        knownPeople: homePersons.map(
          (p) => p.attributes?.friendly_name ?? p.entity_id.split(".")[1] ?? p.entity_id
        ),
      };
    } catch {
      return { homeAlone: true, peoplePresent: 1 };
    }
  }

  private async fetchWeatherContext(_location: LocationContext): Promise<WeatherContext> {
    const haUrl = process.env["HOME_ASSISTANT_URL"] ?? "http://localhost:8123";
    const haToken = process.env["HOME_ASSISTANT_TOKEN"] ?? "";
    const hour = new Date().getHours();
    const isDaytime = hour >= 7 && hour < 21;

    // ── 1. Essayer l'entité weather Home Assistant ────────────────────────────
    if (haToken) {
      try {
        const weatherEntity =
          process.env["HA_WEATHER_ENTITY"] ?? "weather.forecast_home";
        const res = await fetch(`${haUrl}/api/states/${weatherEntity}`, {
          headers: { Authorization: `Bearer ${haToken}` },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            state: string;
            attributes: {
              temperature?: number;
              humidity?: number;
              uv_index?: number;
            };
          };
          const condMap: Record<string, WeatherContext["condition"]> = {
            sunny: "sunny",
            clear: "sunny",
            "clear-night": "sunny",
            partlycloudy: "cloudy",
            cloudy: "cloudy",
            overcast: "cloudy",
            fog: "cloudy",
            rainy: "rainy",
            pouring: "rainy",
            hail: "rainy",
            snowy: "snowy",
            "snowy-rainy": "snowy",
            lightning: "stormy",
            "lightning-rainy": "stormy",
          };
          const condition = condMap[data.state] ?? "cloudy";
          return {
            temperature: data.attributes.temperature ?? 20,
            condition,
            humidity: data.attributes.humidity ?? 60,
            isDaytime,
            uvIndex: data.attributes.uv_index ?? 2,
            forecast: data.state,
          };
        }
      } catch {
        // Fall through to Open-Meteo
      }
    }

    // ── 2. Fallback Open-Meteo (gratuit, sans clé API) ───────────────────────
    const lat = process.env["HOME_LAT"] ?? "48.8566";
    const lon = process.env["HOME_LON"] ?? "2.3522";
    const omRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weathercode,relative_humidity_2m,uv_index&forecast_days=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!omRes.ok) throw new Error("Open-Meteo unavailable");

    const om = (await omRes.json()) as {
      current: {
        temperature_2m: number;
        weathercode: number;
        relative_humidity_2m: number;
        uv_index: number;
      };
    };
    const c = om.current;
    const condition = wmoToCondition(c.weathercode);

    return {
      temperature: c.temperature_2m,
      condition,
      humidity: c.relative_humidity_2m,
      isDaytime,
      uvIndex: c.uv_index,
      forecast: condition,
    };
  }

  private calculateSeasonalContext(timestamp: Date): RichContext["seasonal"] {
    const month = timestamp.getMonth();
    const dayOfYear = this.getDayOfYear(timestamp);

    let season: RichContext["seasonal"]["season"];
    if (month >= 2 && month <= 4) season = "spring";
    else if (month >= 5 && month <= 7) season = "summer";
    else if (month >= 8 && month <= 10) season = "autumn";
    else season = "winter";

    // Calcul simplifié des heures de soleil
    const sunHours = season === "summer" ? 15 : season === "winter" ? 8 : 11;

    return { season, dayOfYear, sunHours };
  }

  private predictCalendarContext(futureTime: Date): CalendarContext {
    // Basé sur les patterns historiques
    return {
      freeTimeMinutes: 30,
      dayOfWeek: futureTime.getDay(),
      isWeekend: futureTime.getDay() === 0 || futureTime.getDay() === 6,
      isHoliday: false,
    };
  }

  private predictLocationContext(futureTime: Date): LocationContext {
    // Basé sur les habitudes
    const hour = futureTime.getHours();
    if (hour >= 9 && hour <= 17) {
      return {
        isHome: false,
        isWork: true,
        geofence: "work",
        travelMode: "stationary",
      };
    }
    return {
      isHome: true,
      isWork: false,
      geofence: "home",
      travelMode: "stationary",
    };
  }

  private getRecentMessages(userId: string): string[] {
    return this.messageHistory.get(userId) ?? [];
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  getContextHistory(): RichContext[] {
    return [...this.contextHistory];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convertit un code météo WMO (Open-Meteo) en condition simplifiée.
 * https://open-meteo.com/en/docs#weathervariables
 */
function wmoToCondition(code: number): WeatherContext["condition"] {
  if (code === 0 || code === 1) return "sunny";
  if (code === 2 || code === 3) return "cloudy";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rainy";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snowy";
  if (code >= 95) return "stormy";
  return "cloudy";
}
