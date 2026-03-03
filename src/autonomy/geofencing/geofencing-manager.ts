/**
 * GeofencingManager — Détection arrivée/départ du domicile
 *
 * Deux modes :
 *  - "home-assistant" : surveille un device_tracker HA + zone.home
 *  - "gps" : calcule la distance entre la position reçue et le domicile
 *
 * Émet les événements `arrive` et `depart` vers JarvisBridge.
 */

import { EventEmitter } from "node:events";
import { getLogger } from "../logging/subsystem.js";

const log = getLogger("geofencing");

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type GeofencingProvider = "home-assistant" | "gps";
export type PresenceState = "home" | "away" | "unknown";

export interface GpsCoords {
  latitude: number;
  longitude: number;
}

export interface GeofencingConfig {
  enabled?: boolean;
  provider?: GeofencingProvider;

  // Mode GPS
  home?: GpsCoords & { radius?: number }; // radius en mètres, défaut 200

  // Mode Home Assistant
  trackerEntity?: string; // ex: "device_tracker.iphone_de_mick"
  zoneEntity?: string;    // ex: "zone.home" (non utilisé directement, HA le gère)

  // Messages envoyés à Jarvis à l'arrivée/départ
  onArrive?: { message?: string; delaySeconds?: number };
  onDepart?: { message?: string; delaySeconds?: number };

  // URL & token HA (utilise les env vars si absent)
  haBaseUrl?: string;
  haToken?: string;

  // Fréquence de polling (secondes), défaut 60
  pollIntervalSeconds?: number;
}

export interface GeofencingEvent {
  type: "arrive" | "depart";
  previousState: PresenceState;
  newState: PresenceState;
  timestamp: Date;
  coords?: GpsCoords;
}

// ─────────────────────────────────────────
// GeofencingManager
// ─────────────────────────────────────────

export class GeofencingManager extends EventEmitter {
  private config: Required<GeofencingConfig>;
  private currentState: PresenceState = "unknown";
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  // Singleton
  private static instance: GeofencingManager | null = null;

  private constructor(config: GeofencingConfig = {}) {
    super();
    this.config = {
      enabled: config.enabled ?? true,
      provider: config.provider ?? "home-assistant",
      home: config.home ?? { latitude: 0, longitude: 0, radius: 200 },
      trackerEntity: config.trackerEntity ?? "device_tracker.jarvis_owner",
      zoneEntity: config.zoneEntity ?? "zone.home",
      onArrive: config.onArrive ?? {
        message:
          "Je suis arrivé à la maison. Active la routine d'arrivée : allume les lumières du couloir, règle le chauffage à 21°C.",
        delaySeconds: 30,
      },
      onDepart: config.onDepart ?? {
        message:
          "Je quitte la maison. Active la routine départ : éteins toutes les lumières, baisse le chauffage à 17°C, active le mode absent.",
        delaySeconds: 60,
      },
      haBaseUrl:
        config.haBaseUrl ??
        process.env["HOME_ASSISTANT_URL"] ??
        "http://localhost:8123",
      haToken:
        config.haToken ?? process.env["HOME_ASSISTANT_TOKEN"] ?? "",
      pollIntervalSeconds: config.pollIntervalSeconds ?? 60,
    };
  }

  static getInstance(config?: GeofencingConfig): GeofencingManager {
    if (!GeofencingManager.instance) {
      GeofencingManager.instance = new GeofencingManager(config);
    }
    return GeofencingManager.instance;
  }

  // ── Démarrage / Arrêt ─────────────────

  start(): void {
    if (this.running || !this.config.enabled) return;
    this.running = true;
    log.info(
      `GeofencingManager démarré (provider: ${this.config.provider}, interval: ${this.config.pollIntervalSeconds}s)`
    );

    // Poll immédiat puis périodique
    void this.poll();
    this.pollTimer = setInterval(
      () => void this.poll(),
      this.config.pollIntervalSeconds * 1000
    );
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.pendingTimer) { clearTimeout(this.pendingTimer); this.pendingTimer = null; }
    log.info("GeofencingManager arrêté");
  }

  // ── Polling ───────────────────────────

  private async poll(): Promise<void> {
    try {
      const newState = await this.fetchPresenceState();
      if (newState !== "unknown" && newState !== this.currentState) {
        await this.handleStateChange(this.currentState, newState);
      }
    } catch (err) {
      log.warn(`Erreur de polling géofencing : ${String(err)}`);
    }
  }

  private async fetchPresenceState(): Promise<PresenceState> {
    if (this.config.provider === "home-assistant") {
      return this.fetchFromHomeAssistant();
    }
    // Mode GPS : la position doit être poussée via updateGpsPosition()
    return this.currentState;
  }

  private async fetchFromHomeAssistant(): Promise<PresenceState> {
    if (!this.config.haToken) {
      log.warn("HOME_ASSISTANT_TOKEN manquant — géofencing HA désactivé");
      return "unknown";
    }

    const url = `${this.config.haBaseUrl}/api/states/${this.config.trackerEntity}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.haToken}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      log.warn(`HA géofencing : réponse ${res.status} pour ${this.config.trackerEntity}`);
      return "unknown";
    }

    const data = (await res.json()) as { state: string };
    const state = data.state?.toLowerCase();

    // HA renvoie "home" ou le nom de la zone, sinon "not_home" / "away"
    if (state === "home") return "home";
    if (state === "not_home" || state === "away") return "away";

    // Peut aussi être le nom d'une autre zone : on considère "away"
    return "away";
  }

  // ── Mise à jour GPS manuelle ──────────

  /**
   * Appeler cette méthode quand le node mobile envoie une position GPS.
   * La distance est calculée par la formule de Haversine.
   */
  updateGpsPosition(coords: GpsCoords): void {
    const { latitude, longitude, radius = 200 } = this.config.home;
    const dist = haversineMeters(coords, { latitude, longitude });
    const newState: PresenceState = dist <= radius ? "home" : "away";

    log.debug(
      `GPS reçu (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}) — dist: ${dist.toFixed(0)}m — état: ${newState}`
    );

    if (newState !== this.currentState) {
      void this.handleStateChange(this.currentState, newState, coords);
    }
  }

  // ── Transition d'état ─────────────────

  private async handleStateChange(
    prev: PresenceState,
    next: PresenceState,
    coords?: GpsCoords
  ): Promise<void> {
    const type: "arrive" | "depart" = next === "home" ? "arrive" : "depart";
    const delayMs =
      (type === "arrive"
        ? this.config.onArrive.delaySeconds
        : this.config.onDepart.delaySeconds) * 1000;

    log.info(
      `Transition géofencing : ${prev} → ${next} (délai ${delayMs / 1000}s avant action)`
    );

    // Annule un timer de transition déjà en attente (évite les allers-retours rapides)
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    this.pendingTimer = setTimeout(async () => {
      this.pendingTimer = null;
      // Vérification : l'état est-il toujours le même après le délai ?
      const confirmed = await this.fetchPresenceState();
      if (confirmed !== next) {
        log.info(`Géofencing : transition annulée (faux positif détecté)`);
        return;
      }

      this.currentState = next;

      const event: GeofencingEvent = {
        type,
        previousState: prev,
        newState: next,
        timestamp: new Date(),
        coords,
      };

      this.emit(type, event);
      this.emit("change", event);

      // Déclenche le message Jarvis
      const message =
        type === "arrive"
          ? this.config.onArrive.message
          : this.config.onDepart.message;

      if (message) {
        await this.dispatchToJarvis(message, event);
      }
    }, delayMs);
  }

  // ── Dispatch vers Jarvis ──────────────

  private async dispatchToJarvis(
    message: string,
    event: GeofencingEvent
  ): Promise<void> {
    try {
      // Import dynamique pour éviter une dépendance circulaire
      const { getJarvisBridge } = await import("../jarvis-bridge.js");
      const bridge = getJarvisBridge();
      if (!bridge) {
        log.warn("JarvisBridge non disponible — message géofencing ignoré");
        return;
      }

      const enriched = `[Géofencing — ${event.type === "arrive" ? "Arrivée" : "Départ"}]\n${message}`;
      await bridge.execute(enriched, process.env["JARVIS_OWNER_ID"] ?? "owner");
      log.info(`Géofencing : message dispatché (${event.type})`);
    } catch (err) {
      log.warn(`Géofencing dispatch error : ${String(err)}`);
    }
  }

  // ── Accesseurs publics ─────────────────

  getState(): PresenceState {
    return this.currentState;
  }

  isHome(): boolean {
    return this.currentState === "home";
  }

  isAway(): boolean {
    return this.currentState === "away";
  }

  /**
   * Forcer manuellement un état (tests / override)
   */
  forceState(state: PresenceState): void {
    log.info(`Géofencing : état forcé manuellement → ${state}`);
    this.currentState = state;
    this.emit("change", {
      type: state === "home" ? "arrive" : "depart",
      previousState: "unknown",
      newState: state,
      timestamp: new Date(),
    });
  }
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/**
 * Distance entre deux points GPS en mètres (formule Haversine).
 */
export function haversineMeters(a: GpsCoords, b: GpsCoords): number {
  const R = 6_371_000; // rayon terrestre en mètres
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(c));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Singleton helper
export function getGeofencingManager(config?: GeofencingConfig): GeofencingManager {
  return GeofencingManager.getInstance(config);
}
