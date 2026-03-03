/**
 * HomeAssistantClient — Client REST pour Home Assistant
 *
 * Fournit une interface TypeScript complète pour l'API REST de Home Assistant.
 * Documentation API : https://developers.home-assistant.io/docs/api/rest/
 *
 * Commandes supportées via le bridge :
 *   domotic:light_on       → allume une lumière (entity_id, brightness?, color_temp?)
 *   domotic:light_off      → éteint une lumière (entity_id)
 *   domotic:light_toggle   → bascule une lumière (entity_id)
 *   domotic:set_temp       → règle la température (entity_id, temperature)
 *   domotic:cover_open     → ouvre un volet (entity_id)
 *   domotic:cover_close    → ferme un volet (entity_id)
 *   domotic:cover_set      → positionne un volet (entity_id, position 0-100)
 *   domotic:switch_on      → active un interrupteur (entity_id)
 *   domotic:switch_off     → désactive un interrupteur (entity_id)
 *   domotic:switch_toggle  → bascule un interrupteur (entity_id)
 *   domotic:scene_activate → active une scène (entity_id)
 *   domotic:get_state      → retourne l'état d'une entité (entity_id)
 *   domotic:list_entities  → liste toutes les entités (domain?)
 *   domotic:call_service   → appel générique (domain, service, data)
 *   home:*                 → alias pour domotic:*
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("domotic:ha");

// ============================================================================
// Types
// ============================================================================

export type HAEntityState = {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
};

export type HAServiceCallParams = {
  domain: string;
  service: string;
  data?: Record<string, unknown>;
};

export type HACommandResult = {
  success: boolean;
  output?: string;
  data?: unknown;
  error?: string;
};

export type DomoticCommandParams = {
  /** Identifiant Home Assistant (ex: light.salon, climate.thermostat) */
  entity_id?: string;
  /** Luminosité 0-255 */
  brightness?: number;
  /** Température couleur (mireds) */
  color_temp?: number;
  /** Couleur RGB [r, g, b] */
  rgb_color?: [number, number, number];
  /** Température de consigne (°C) */
  temperature?: number;
  /** Position volet 0-100 */
  position?: number;
  /** Mode HVAC: heat, cool, auto, off */
  hvac_mode?: string;
  /** Domaine HA (pour call_service générique) */
  domain?: string;
  /** Service HA (pour call_service générique) */
  service?: string;
  /** Données service (pour call_service générique) */
  data?: Record<string, unknown>;
  /** Filtre domaine pour list_entities */
  domain_filter?: string;
};

// ============================================================================
// Client Home Assistant
// ============================================================================

export class HomeAssistantClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    // Retire le trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  // ─── Méthodes HTTP internes ───────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}/api${path}`;
    const res = await fetch(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HA GET ${path} → ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, data?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/api${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HA POST ${path} → ${res.status}: ${body}`);
    }
    // Certains endpoints retournent un array, d'autres un objet
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  // ─── API publique ─────────────────────────────────────────────────────────

  /** Vérifie que l'API est accessible */
  async ping(): Promise<boolean> {
    try {
      await this.get<{ message: string }>("/");
      return true;
    } catch {
      return false;
    }
  }

  /** Retourne l'état d'une entité */
  async getState(entityId: string): Promise<HAEntityState> {
    return this.get<HAEntityState>(`/states/${entityId}`);
  }

  /** Retourne la liste de toutes les entités, avec filtre domaine optionnel */
  async listStates(domainFilter?: string): Promise<HAEntityState[]> {
    const states = await this.get<HAEntityState[]>("/states");
    if (domainFilter) {
      return states.filter((s) => s.entity_id.startsWith(`${domainFilter}.`));
    }
    return states;
  }

  /** Appel générique d'un service HA */
  async callService(params: HAServiceCallParams): Promise<HAEntityState[]> {
    return this.post<HAEntityState[]>(
      `/services/${params.domain}/${params.service}`,
      params.data ?? {}
    );
  }

  // ─── Lumières ─────────────────────────────────────────────────────────────

  async lightOn(entityId: string, opts?: { brightness?: number; color_temp?: number; rgb_color?: [number, number, number] }): Promise<HAEntityState[]> {
    return this.callService({
      domain: "light",
      service: "turn_on",
      data: { entity_id: entityId, ...opts },
    });
  }

  async lightOff(entityId: string): Promise<HAEntityState[]> {
    return this.callService({ domain: "light", service: "turn_off", data: { entity_id: entityId } });
  }

  async lightToggle(entityId: string): Promise<HAEntityState[]> {
    return this.callService({ domain: "light", service: "toggle", data: { entity_id: entityId } });
  }

  // ─── Volets / Stores ──────────────────────────────────────────────────────

  async coverOpen(entityId: string): Promise<HAEntityState[]> {
    return this.callService({ domain: "cover", service: "open_cover", data: { entity_id: entityId } });
  }

  async coverClose(entityId: string): Promise<HAEntityState[]> {
    return this.callService({ domain: "cover", service: "close_cover", data: { entity_id: entityId } });
  }

  async coverSetPosition(entityId: string, position: number): Promise<HAEntityState[]> {
    return this.callService({ domain: "cover", service: "set_cover_position", data: { entity_id: entityId, position } });
  }

  // ─── Interrupteurs / Prises ───────────────────────────────────────────────

  async switchOn(entityId: string): Promise<HAEntityState[]> {
    return this.callService({ domain: "switch", service: "turn_on", data: { entity_id: entityId } });
  }

  async switchOff(entityId: string): Promise<HAEntityState[]> {
    return this.callService({ domain: "switch", service: "turn_off", data: { entity_id: entityId } });
  }

  async switchToggle(entityId: string): Promise<HAEntityState[]> {
    return this.callService({ domain: "switch", service: "toggle", data: { entity_id: entityId } });
  }

  // ─── Climatisation / Chauffage ────────────────────────────────────────────

  async climateSetTemperature(entityId: string, temperature: number): Promise<HAEntityState[]> {
    return this.callService({ domain: "climate", service: "set_temperature", data: { entity_id: entityId, temperature } });
  }

  async climateSetMode(entityId: string, hvacMode: string): Promise<HAEntityState[]> {
    return this.callService({ domain: "climate", service: "set_hvac_mode", data: { entity_id: entityId, hvac_mode: hvacMode } });
  }

  // ─── Scènes ───────────────────────────────────────────────────────────────

  async sceneActivate(entityId: string): Promise<HAEntityState[]> {
    return this.callService({ domain: "scene", service: "turn_on", data: { entity_id: entityId } });
  }

  // ─── Routeur de commandes Jarvis ─────────────────────────────────────────

  /**
   * Route une commande domotic:* ou home:* vers le bon service HA.
   * Retourne un résultat formaté pour le JarvisBridge.
   */
  async executeCommand(command: string, params: DomoticCommandParams): Promise<HACommandResult> {
    // Normalise le préfixe
    const cmd = command.replace(/^(domotic:|home:)/, "");
    const entityId = params.entity_id ?? "";

    log.info(`[HA] Exécution: ${cmd} | entity=${entityId || "(aucune)"}`);

    try {
      switch (cmd) {
        // Lumières
        case "light_on":
        case "light.turn_on": {
          if (!entityId) return { success: false, error: "entity_id requis pour light_on" };
          await this.lightOn(entityId, {
            brightness: params.brightness,
            color_temp: params.color_temp,
            rgb_color: params.rgb_color,
          });
          return { success: true, output: `💡 Lumière allumée : ${entityId}` };
        }

        case "light_off":
        case "light.turn_off": {
          if (!entityId) return { success: false, error: "entity_id requis pour light_off" };
          await this.lightOff(entityId);
          return { success: true, output: `💡 Lumière éteinte : ${entityId}` };
        }

        case "light_toggle":
        case "light.toggle": {
          if (!entityId) return { success: false, error: "entity_id requis pour light_toggle" };
          await this.lightToggle(entityId);
          return { success: true, output: `💡 Lumière basculée : ${entityId}` };
        }

        // Volets
        case "cover_open":
        case "cover.open_cover": {
          if (!entityId) return { success: false, error: "entity_id requis pour cover_open" };
          await this.coverOpen(entityId);
          return { success: true, output: `🪟 Volet ouvert : ${entityId}` };
        }

        case "cover_close":
        case "cover.close_cover": {
          if (!entityId) return { success: false, error: "entity_id requis pour cover_close" };
          await this.coverClose(entityId);
          return { success: true, output: `🪟 Volet fermé : ${entityId}` };
        }

        case "cover_set":
        case "cover.set_cover_position": {
          if (!entityId) return { success: false, error: "entity_id requis pour cover_set" };
          const pos = params.position ?? 50;
          await this.coverSetPosition(entityId, pos);
          return { success: true, output: `🪟 Volet positionné à ${pos}% : ${entityId}` };
        }

        // Interrupteurs
        case "switch_on":
        case "switch.turn_on": {
          if (!entityId) return { success: false, error: "entity_id requis pour switch_on" };
          await this.switchOn(entityId);
          return { success: true, output: `🔌 Interrupteur activé : ${entityId}` };
        }

        case "switch_off":
        case "switch.turn_off": {
          if (!entityId) return { success: false, error: "entity_id requis pour switch_off" };
          await this.switchOff(entityId);
          return { success: true, output: `🔌 Interrupteur désactivé : ${entityId}` };
        }

        case "switch_toggle":
        case "switch.toggle": {
          if (!entityId) return { success: false, error: "entity_id requis pour switch_toggle" };
          await this.switchToggle(entityId);
          return { success: true, output: `🔌 Interrupteur basculé : ${entityId}` };
        }

        // Climatisation
        case "set_temp":
        case "climate.set_temperature": {
          if (!entityId) return { success: false, error: "entity_id requis pour set_temp" };
          if (params.temperature === undefined) return { success: false, error: "temperature requis pour set_temp" };
          await this.climateSetTemperature(entityId, params.temperature);
          return { success: true, output: `🌡️ Température réglée à ${params.temperature}°C : ${entityId}` };
        }

        case "set_hvac_mode":
        case "climate.set_hvac_mode": {
          if (!entityId) return { success: false, error: "entity_id requis" };
          await this.climateSetMode(entityId, params.hvac_mode ?? "auto");
          return { success: true, output: `🌡️ Mode climatisation: ${params.hvac_mode} sur ${entityId}` };
        }

        // Scènes
        case "scene_activate":
        case "scene.turn_on": {
          if (!entityId) return { success: false, error: "entity_id requis pour scene_activate" };
          await this.sceneActivate(entityId);
          return { success: true, output: `🎬 Scène activée : ${entityId}` };
        }

        // État / Listing
        case "get_state": {
          if (!entityId) return { success: false, error: "entity_id requis pour get_state" };
          const state = await this.getState(entityId);
          return {
            success: true,
            output: `📊 ${entityId} → ${state.state}`,
            data: state,
          };
        }

        case "list_entities": {
          const entities = await this.listStates(params.domain_filter);
          const summary = entities
            .slice(0, 20)
            .map((e) => `${e.entity_id}: ${e.state}`)
            .join("\n");
          return {
            success: true,
            output: `📋 ${entities.length} entités${params.domain_filter ? ` (domaine: ${params.domain_filter})` : ""}\n${summary}`,
            data: entities,
          };
        }

        // Appel générique
        case "call_service": {
          const domain = params.domain;
          const service = params.service;
          if (!domain || !service) return { success: false, error: "domain et service requis pour call_service" };
          const result = await this.callService({ domain, service, data: params.data });
          return { success: true, output: `✅ Service ${domain}.${service} appelé`, data: result };
        }

        default:
          return {
            success: false,
            error: `Commande domotique non reconnue: "${cmd}". Commandes: light_on, light_off, light_toggle, cover_open, cover_close, switch_on, switch_off, set_temp, scene_activate, get_state, list_entities, call_service`,
          };
      }
    } catch (err) {
      const errMsg = String(err);
      log.error(`[HA] Erreur exécution ${cmd}: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }
}

// ============================================================================
// Factory & singleton léger
// ============================================================================

let _haClient: HomeAssistantClient | null = null;

/**
 * Crée ou retourne le client HA depuis les variables d'env.
 * Retourne null si HOME_ASSISTANT_URL ou HOME_ASSISTANT_TOKEN ne sont pas définis.
 */
export function getHomeAssistantClient(): HomeAssistantClient | null {
  if (_haClient) return _haClient;

  const url = process.env.HOME_ASSISTANT_URL;
  const token = process.env.HOME_ASSISTANT_TOKEN;

  if (!url || !token) {
    log.debug("[HA] HOME_ASSISTANT_URL ou HOME_ASSISTANT_TOKEN non définis — client HA désactivé");
    return null;
  }

  _haClient = new HomeAssistantClient(url, token);
  log.info(`[HA] Client Home Assistant initialisé → ${url}`);
  return _haClient;
}

/** Réinitialise le singleton (utile pour les tests) */
export function resetHomeAssistantClient(): void {
  _haClient = null;
}
