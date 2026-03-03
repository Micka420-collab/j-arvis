/**
 * Jarvis Dashboard — Interface visuelle temps réel via Canvas OpenClaw
 *
 * Pousse le dashboard domotique HTML dans le Canvas OpenClaw.
 * Les données proviennent de Home Assistant via l'API REST.
 *
 * Utilisation :
 *   const dash = new JarvisDashboard({ haBaseUrl, haToken });
 *   await dash.push();               // Affiche le dashboard
 *   await dash.pushWithLiveData();   // Récupère les données HA et les injecte
 *   await dash.hide();               // Cache le canvas
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("autonomy:dashboard");

// ============================================================================
// Types
// ============================================================================

export type DashboardConfig = {
  /**
   * URL de base de Home Assistant (ex: http://homeassistant.local:8123)
   * Si non fourni, affiche le template avec données statiques.
   */
  haBaseUrl?: string;
  /** Token Long-Lived Access Token Home Assistant */
  haToken?: string;
  /** URL de la gateway OpenClaw (défaut: http://localhost:9753) */
  gatewayUrl?: string;
  /** Token d'authentification gateway */
  gatewayToken?: string;
  /** Node ID cible (null = node courant) */
  nodeId?: string;
  /** Timeout requêtes HA en ms (défaut: 5 000) */
  haTimeoutMs?: number;
};

export type RoomData = {
  name: string;
  emoji: string;
  temperature?: number;
  humidity?: number;
  lightsOn?: boolean;
  lightsBrightness?: number;
  coverPosition?: string;
};

export type DashboardData = {
  rooms: RoomData[];
  energyCurrent?: number;    // W
  energyToday?: number;      // kWh
  energyMonth?: number;      // kWh
  securityOk?: boolean;
  alarmActive?: boolean;
  doorLocked?: boolean;
  musicTrack?: string;
  musicRoom?: string;
  musicVolume?: number;
  updatedAt: Date;
};

// ============================================================================
// Dashboard
// ============================================================================

export class JarvisDashboard {
  private config: DashboardConfig;

  constructor(config: DashboardConfig = {}) {
    this.config = {
      haTimeoutMs: 5_000,
      gatewayUrl: "http://localhost:9753",
      ...config,
    };
  }

  // ── Données Home Assistant ─────────────────────────────────────────────

  /**
   * Récupère les états des entités Home Assistant.
   */
  async fetchHAStates(): Promise<Map<string, { state: string; attributes: Record<string, unknown> }>> {
    const { haBaseUrl, haToken, haTimeoutMs } = this.config;
    if (!haBaseUrl || !haToken) return new Map();

    try {
      const response = await fetch(`${haBaseUrl}/api/states`, {
        headers: {
          Authorization: `Bearer ${haToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(haTimeoutMs!),
      });

      if (!response.ok) {
        log.warn(`HA API error: ${response.status}`);
        return new Map();
      }

      const states = await response.json() as Array<{
        entity_id: string;
        state: string;
        attributes: Record<string, unknown>;
      }>;

      const map = new Map<string, { state: string; attributes: Record<string, unknown> }>();
      for (const s of states) {
        map.set(s.entity_id, { state: s.state, attributes: s.attributes });
      }
      return map;
    } catch (err) {
      log.warn(`Failed to fetch HA states: ${String(err)}`);
      return new Map();
    }
  }

  /**
   * Construit les données du dashboard depuis les états HA.
   */
  async buildDashboardData(): Promise<DashboardData> {
    const states = await this.fetchHAStates();

    // Pièces principales — peut être adapté selon votre installation HA
    const rooms: RoomData[] = [
      this.extractRoom("Salon", "🛋️", "sensor.salon", "light.salon", "cover.volet_salon", states),
      this.extractRoom("Chambre", "🛏️", "sensor.chambre", "light.chambre", "cover.volet_chambre", states),
      this.extractRoom("Cuisine", "🍳", "sensor.cuisine", "light.cuisine", undefined, states),
      this.extractRoom("Bureau", "💻", "sensor.bureau", "light.bureau", "cover.volet_bureau", states),
    ].filter((r) => r !== null) as RoomData[];

    // Énergie
    const energySensor = states.get("sensor.energy_consumption") ?? states.get("sensor.power");
    const energyTodaySensor = states.get("sensor.energy_today");
    const energyMonthSensor = states.get("sensor.energy_month");

    // Sécurité
    const alarmPanel = states.get("alarm_control_panel.alarme");
    const frontDoor = states.get("lock.porte_entree") ?? states.get("binary_sensor.porte_entree");

    // Musique (Sonos / media_player)
    const mediaPlayer = this.findActiveMediaPlayer(states);

    return {
      rooms,
      energyCurrent: energySensor ? parseFloat(energySensor.state) : undefined,
      energyToday: energyTodaySensor ? parseFloat(energyTodaySensor.state) : undefined,
      energyMonth: energyMonthSensor ? parseFloat(energyMonthSensor.state) : undefined,
      securityOk: alarmPanel ? alarmPanel.state === "disarmed" : true,
      alarmActive: alarmPanel ? alarmPanel.state === "armed_away" || alarmPanel.state === "triggered" : false,
      doorLocked: frontDoor ? frontDoor.state === "locked" : undefined,
      musicTrack: mediaPlayer?.attributes.media_title as string | undefined,
      musicRoom: mediaPlayer?.attributes.friendly_name as string | undefined,
      musicVolume: mediaPlayer?.attributes.volume_level
        ? Math.round((mediaPlayer.attributes.volume_level as number) * 100)
        : undefined,
      updatedAt: new Date(),
    };
  }

  private extractRoom(
    name: string,
    emoji: string,
    tempEntityPrefix: string,
    lightEntity: string | undefined,
    coverEntity: string | undefined,
    states: Map<string, { state: string; attributes: Record<string, unknown> }>
  ): RoomData | null {
    // Chercher un capteur de température pour cette pièce
    const tempEntity =
      states.get(`${tempEntityPrefix}_temperature`) ??
      states.get(`${tempEntityPrefix}.temperature`) ??
      states.get(`sensor.temperature_${name.toLowerCase()}`);

    const humEntity =
      states.get(`${tempEntityPrefix}_humidity`) ??
      states.get(`sensor.humidity_${name.toLowerCase()}`);

    const lightState = lightEntity ? states.get(lightEntity) : undefined;
    const coverState = coverEntity ? states.get(coverEntity) : undefined;

    // Si aucun capteur détecté et pas de lumière → pièce non configurée
    if (!tempEntity && !lightState) return null;

    return {
      name,
      emoji,
      temperature: tempEntity ? parseFloat(tempEntity.state) : undefined,
      humidity: humEntity ? parseFloat(humEntity.state) : undefined,
      lightsOn: lightState ? lightState.state === "on" : undefined,
      lightsBrightness: lightState?.attributes.brightness
        ? Math.round((lightState.attributes.brightness as number) / 2.55)
        : undefined,
      coverPosition:
        coverState?.state === "open" ? "Ouverts"
        : coverState?.state === "closed" ? "Fermés"
        : coverState ? `${coverState.attributes.current_position ?? "?"}%`
        : undefined,
    };
  }

  private findActiveMediaPlayer(
    states: Map<string, { state: string; attributes: Record<string, unknown> }>
  ): { state: string; attributes: Record<string, unknown> } | undefined {
    for (const [entityId, entity] of states) {
      if (entityId.startsWith("media_player.") && entity.state === "playing") {
        return entity;
      }
    }
    return undefined;
  }

  // ── Génération HTML ───────────────────────────────────────────────────────

  /**
   * Génère le HTML du dashboard avec les données fournies.
   */
  generateHTML(data: DashboardData): string {
    const roomCards = data.rooms.map((room) => this.generateRoomCard(room)).join("\n");
    const timeStr = data.updatedAt.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const energyPercent = data.energyCurrent
      ? Math.min(Math.round((data.energyCurrent / 3000) * 100), 100)
      : 28;

    const energyColor =
      energyPercent < 40 ? "var(--success)"
      : energyPercent < 70 ? "var(--warning)"
      : "var(--danger)";

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Jarvis — Dashboard</title>
<style>
:root {
  --bg: #0a0a1a; --card: #12122a; --accent: #00d4ff; --success: #00ff88;
  --warning: #ffaa00; --danger: #ff4444; --text: #e0e0ff; --text-dim: #6060a0;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, "SF Pro Display", sans-serif;
  background: var(--bg); color: var(--text); min-height: 100vh; padding: 20px;
}
.header { text-align: center; margin-bottom: 24px; padding: 16px; }
.header h1 {
  font-size: 1.8em;
  background: linear-gradient(135deg, var(--accent), #7c3aed);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.header .sub { color: var(--text-dim); font-size: .85em; margin-top: 4px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px; max-width: 1200px; margin: 0 auto;
}
.card {
  background: var(--card); border-radius: 14px; padding: 18px;
  border: 1px solid rgba(255,255,255,.05);
  transition: all .3s ease;
}
.card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,212,255,.1); }
.card-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-title { font-size: 1em; font-weight: 600; }
.metric { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.03); }
.metric:last-child { border-bottom: none; }
.ml { color: var(--text-dim); font-size: .82em; }
.mv { font-weight: 600; }
.temp { font-size: 2.2em; font-weight: 700; text-align: center; padding: 12px 0;
  background: linear-gradient(135deg, var(--accent), #7c3aed);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.on { color: var(--success); }
.off { color: var(--text-dim); }
.warn { color: var(--warning); }
.danger { color: var(--danger); }
.sec-center { text-align: center; padding: 16px 0; }
.sec-icon { font-size: 2.8em; margin-bottom: 8px; }
.ebar { height: 7px; background: rgba(255,255,255,.08); border-radius: 4px; margin-top: 8px; overflow: hidden; }
.efill { height: 100%; border-radius: 4px; transition: width .5s; }
</style>
</head>
<body>
<div class="header">
  <h1>🤖 Jarvis Dashboard</h1>
  <div class="sub">Mise à jour : ${timeStr}</div>
</div>
<div class="grid">

${roomCards}

  <!-- Sécurité -->
  <div class="card">
    <div class="card-hdr"><span class="card-title">🔒 Sécurité</span><span>🛡️</span></div>
    <div class="sec-center">
      <div class="sec-icon">${data.securityOk ? "✅" : "⚠️"}</div>
      <div class="mv ${data.securityOk ? "on" : "warn"}">${data.securityOk ? "Tout sécurisé" : "Attention requise"}</div>
    </div>
    <div class="metric"><span class="ml">Porte entrée</span><span class="mv ${data.doorLocked !== false ? "on" : "danger"}">${data.doorLocked !== false ? "🔒 Verrouillée" : "🔓 Ouverte"}</span></div>
    <div class="metric"><span class="ml">Alarme</span><span class="mv ${data.alarmActive ? "danger" : "off"}">${data.alarmActive ? "⚡ Active" : "Désactivée"}</span></div>
  </div>

  <!-- Énergie -->
  <div class="card">
    <div class="card-hdr"><span class="card-title">⚡ Énergie</span><span>📊</span></div>
    <div class="metric"><span class="ml">Conso actuelle</span><span class="mv">${data.energyCurrent ? `${data.energyCurrent} W` : "—"}</span></div>
    <div class="ebar"><div class="efill" style="width:${energyPercent}%;background:${energyColor}"></div></div>
    <div class="metric" style="margin-top:8px"><span class="ml">Aujourd'hui</span><span class="mv">${data.energyToday ? `${data.energyToday} kWh` : "—"}</span></div>
    <div class="metric"><span class="ml">Ce mois</span><span class="mv">${data.energyMonth ? `${data.energyMonth} kWh` : "—"}</span></div>
  </div>

  <!-- Musique -->
  <div class="card">
    <div class="card-hdr"><span class="card-title">🎵 Musique</span><span>🔊</span></div>
    <div class="metric"><span class="ml">En cours</span><span class="mv">${data.musicTrack ?? "—"}</span></div>
    <div class="metric"><span class="ml">Pièce</span><span class="mv">${data.musicRoom ?? "—"}</span></div>
    <div class="metric"><span class="ml">Volume</span><span class="mv">${data.musicVolume !== undefined ? `${data.musicVolume}%` : "—"}</span></div>
  </div>

</div>
<script>
// Auto-refresh time display
setInterval(() => {
  const now = new Date();
  document.querySelector('.sub').textContent =
    'Mise à jour : ' + now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}, 1000);
</script>
</body>
</html>`;
  }

  private generateRoomCard(room: RoomData): string {
    const tempHtml = room.temperature !== undefined
      ? `<div class="temp">${room.temperature.toFixed(1)}°C</div>`
      : "";

    const lightsHtml = room.lightsOn !== undefined
      ? `<div class="metric">
          <span class="ml">Lumières</span>
          <span class="mv ${room.lightsOn ? "on" : "off"}">
            ${room.lightsOn ? `● ON${room.lightsBrightness ? ` (${room.lightsBrightness}%)` : ""}` : "○ OFF"}
          </span>
        </div>`
      : "";

    const coverHtml = room.coverPosition
      ? `<div class="metric"><span class="ml">Volets</span><span class="mv">${room.coverPosition}</span></div>`
      : "";

    const humidityHtml = room.humidity !== undefined
      ? `<div class="metric"><span class="ml">Humidité</span><span class="mv">${room.humidity.toFixed(0)}%</span></div>`
      : "";

    return `  <div class="card">
    <div class="card-hdr"><span class="card-title">${room.emoji} ${room.name}</span></div>
    ${tempHtml}
    ${lightsHtml}
    ${coverHtml}
    ${humidityHtml}
  </div>`;
  }

  // ── Push vers Canvas ──────────────────────────────────────────────────────

  /**
   * Pousse le dashboard avec données statiques de démonstration.
   */
  async push(): Promise<boolean> {
    const demoData: DashboardData = {
      rooms: [
        { name: "Salon", emoji: "🛋️", temperature: 21.5, humidity: 45, lightsOn: true, lightsBrightness: 70, coverPosition: "Ouverts" },
        { name: "Chambre", emoji: "🛏️", temperature: 19.8, lightsOn: false, coverPosition: "Fermés" },
        { name: "Cuisine", emoji: "🍳", temperature: 22.1, humidity: 52, lightsOn: true, lightsBrightness: 100 },
        { name: "Bureau", emoji: "💻", temperature: 20.5, lightsOn: true, lightsBrightness: 85 },
      ],
      energyCurrent: 847,
      energyToday: 12.4,
      energyMonth: 287,
      securityOk: true,
      alarmActive: false,
      doorLocked: true,
      updatedAt: new Date(),
    };
    return this.pushData(demoData);
  }

  /**
   * Récupère les données live depuis Home Assistant et les pousse dans le Canvas.
   */
  async pushWithLiveData(): Promise<boolean> {
    const data = await this.buildDashboardData();

    // Fallback vers démo si aucune pièce détectée
    if (data.rooms.length === 0) {
      log.warn("No HA rooms detected — using demo data");
      return this.push();
    }

    return this.pushData(data);
  }

  private async pushData(data: DashboardData): Promise<boolean> {
    const html = this.generateHTML(data);

    // Appel vers l'API Canvas OpenClaw via la gateway
    const { gatewayUrl, gatewayToken, nodeId } = this.config;

    try {
      const payload = {
        action: "present",
        target: "canvas",
        ...(nodeId ? { node: nodeId } : {}),
        // Le contenu HTML est passé via une URL data: ou un chemin temp
        url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (gatewayToken) {
        headers["Authorization"] = `Bearer ${gatewayToken}`;
      }

      const response = await fetch(`${gatewayUrl}/api/canvas`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        log.warn(`Canvas push failed: ${response.status} ${response.statusText}`);
        return false;
      }

      log.info(`Dashboard pushed to Canvas (${data.rooms.length} rooms, ${data.updatedAt.toISOString()})`);
      return true;
    } catch (err) {
      log.warn(`Canvas push error: ${String(err)}`);
      return false;
    }
  }

  /**
   * Cache le Canvas.
   */
  async hide(): Promise<void> {
    const { gatewayUrl, gatewayToken } = this.config;
    try {
      await fetch(`${gatewayUrl}/api/canvas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {}),
        },
        body: JSON.stringify({ action: "hide" }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      /* ignore */
    }
  }
}
