/**
 * OpenHue Integration — Contrôle Philips Hue pour Jarvis
 *
 * Wrapper autour du CLI `openhue` pour le contrôle des lumières Hue
 * via des commandes naturelles (ex: "allume le salon", "mode cinéma").
 *
 * Prérequis :
 *   brew install openhue/cli/openhue-cli
 *   openhue setup   # Première configuration (appui bouton bridge requis)
 *
 * Usage :
 *   const hue = new OpenhueIntegration();
 *   await hue.setRoom("Salon", { on: true, brightness: 70 });
 *   await hue.setScene("Relax", "Salon");
 *   const lights = await hue.listLights();
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("autonomy:hue");

// ============================================================================
// Types
// ============================================================================

export type HueLightState = {
  on?: boolean;
  brightness?: number;         // 0-100
  colorTemperature?: number;   // 153 (chaud) à 500 (froid) mirek
  color?: string;              // Nom (red, blue...) ou hex (#FF5500)
  transitionTime?: number;     // ms
};

export type HueLight = {
  id: string;
  name: string;
  state: "on" | "off" | "unavailable";
  brightness?: number;
  type?: string;
};

export type HueRoom = {
  id: string;
  name: string;
  lightsOn: number;
  lightsTotal: number;
};

export type HueScene = {
  id: string;
  name: string;
  room?: string;
};

export type HueCommandResult = {
  success: boolean;
  output?: string;
  error?: string;
};

// ============================================================================
// Présets intelligents (commandes naturelles → config Hue)
// ============================================================================

export const HUE_PRESETS: Record<string, HueLightState> = {
  // Mode travail
  "work":       { on: true, brightness: 100, colorTemperature: 250 },
  "bureau":     { on: true, brightness: 100, colorTemperature: 250 },
  "focus":      { on: true, brightness: 90, colorTemperature: 233 },

  // Mode détente
  "relax":      { on: true, brightness: 50, colorTemperature: 400 },
  "soiree":     { on: true, brightness: 40, colorTemperature: 370 },
  "lecture":    { on: true, brightness: 70, colorTemperature: 300 },

  // Mode cinéma
  "cinema":     { on: true, brightness: 10, colorTemperature: 500 },
  "film":       { on: true, brightness: 10, colorTemperature: 500 },
  "movie":      { on: true, brightness: 10, colorTemperature: 500 },

  // Mode nuit
  "nuit":       { on: true, brightness: 5, colorTemperature: 500 },
  "veilleuse":  { on: true, brightness: 3, colorTemperature: 500 },
  "coucher":    { on: true, brightness: 15, colorTemperature: 450 },

  // Mode matin
  "matin":      { on: true, brightness: 70, colorTemperature: 330 },
  "reveil":     { on: true, brightness: 50, colorTemperature: 370 },
  "petit-dejeuner": { on: true, brightness: 80, colorTemperature: 320 },

  // Mode fête
  "fete":       { on: true, brightness: 80, color: "#FF0088" },
  "party":      { on: true, brightness: 80, color: "#FF0088" },
  "disco":      { on: true, brightness: 100, color: "blue" },

  // Éteindre
  "off":        { on: false },
  "eteint":     { on: false },
  "eteindre":   { on: false },
};

// ============================================================================
// Intégration principale
// ============================================================================

export class OpenhueIntegration {
  private openhueAvailable: boolean | null = null; // null = non vérifié

  // ── Vérification disponibilité ─────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    if (this.openhueAvailable !== null) return this.openhueAvailable;

    const result = await this.exec("openhue --version");
    this.openhueAvailable = result.success;

    if (!result.success) {
      log.warn("openhue CLI not found. Install: brew install openhue/cli/openhue-cli");
    }

    return this.openhueAvailable;
  }

  // ── Listes ─────────────────────────────────────────────────────────────

  async listLights(): Promise<HueLight[]> {
    const result = await this.exec("openhue get light --output json");
    if (!result.success || !result.output) return [];

    try {
      const raw = JSON.parse(result.output) as Array<{
        id?: string;
        metadata?: { name?: string };
        on?: { on?: boolean };
        dimming?: { brightness?: number };
        color?: unknown;
        type?: string;
      }>;
      return raw.map((l) => ({
        id: l.id ?? "",
        name: l.metadata?.name ?? "Unknown",
        state: l.on?.on ? "on" : "off",
        brightness: l.dimming?.brightness,
        type: l.color ? "color" : "white",
      }));
    } catch {
      // Tenter le format texte simple
      return this.parseLightText(result.output);
    }
  }

  async listRooms(): Promise<HueRoom[]> {
    const result = await this.exec("openhue get room --output json");
    if (!result.success || !result.output) return [];

    try {
      const raw = JSON.parse(result.output) as Array<{
        id?: string;
        metadata?: { name?: string };
        children?: unknown[];
      }>;
      return raw.map((r) => ({
        id: r.id ?? "",
        name: r.metadata?.name ?? "Unknown",
        lightsOn: 0,
        lightsTotal: r.children?.length ?? 0,
      }));
    } catch {
      return [];
    }
  }

  async listScenes(): Promise<HueScene[]> {
    const result = await this.exec("openhue get scene --output json");
    if (!result.success || !result.output) return [];

    try {
      const raw = JSON.parse(result.output) as Array<{
        id?: string;
        metadata?: { name?: string };
        group?: { rid?: string };
      }>;
      return raw.map((s) => ({
        id: s.id ?? "",
        name: s.metadata?.name ?? "Unknown",
      }));
    } catch {
      return [];
    }
  }

  // ── Contrôle lumières ──────────────────────────────────────────────────

  /**
   * Contrôle une lumière par nom.
   */
  async setLight(lightName: string, state: HueLightState): Promise<HueCommandResult> {
    const args = this.buildLightArgs(state);
    return this.exec(`openhue set light "${lightName}" ${args}`);
  }

  /**
   * Contrôle une pièce entière.
   */
  async setRoom(roomName: string, state: HueLightState): Promise<HueCommandResult> {
    const args = this.buildLightArgs(state);
    return this.exec(`openhue set room "${roomName}" ${args}`);
  }

  /**
   * Active une scène dans une pièce.
   */
  async setScene(sceneName: string, roomName?: string): Promise<HueCommandResult> {
    const roomArg = roomName ? `--room "${roomName}"` : "";
    return this.exec(`openhue set scene "${sceneName}" ${roomArg}`);
  }

  /**
   * Allume ou éteint toutes les lumières d'une pièce.
   */
  async toggleRoom(roomName: string, on: boolean): Promise<HueCommandResult> {
    return this.setRoom(roomName, { on });
  }

  /**
   * Applique un préset nommé sur une pièce.
   * Ex: applyPreset("cinema", "Salon")
   */
  async applyPreset(presetName: string, roomName?: string): Promise<HueCommandResult> {
    const normalized = presetName.toLowerCase().trim();
    const preset = HUE_PRESETS[normalized];

    if (!preset) {
      // Tenter la recherche de scène
      if (roomName) {
        return this.setScene(presetName, roomName);
      }
      return { success: false, error: `Unknown preset: "${presetName}"` };
    }

    if (roomName) {
      return this.setRoom(roomName, preset);
    }

    // Appliquer à toutes les pièces
    const rooms = await this.listRooms();
    if (rooms.length === 0) return { success: false, error: "No rooms found" };

    let allSuccess = true;
    for (const room of rooms) {
      const result = await this.setRoom(room.name, preset);
      if (!result.success) allSuccess = false;
    }

    return { success: allSuccess };
  }

  /**
   * Interprète une commande naturelle et l'exécute.
   * Ex: "allume le salon à 70%", "mode cinéma dans le salon"
   */
  async handleNaturalCommand(command: string): Promise<HueCommandResult> {
    const lower = command.toLowerCase().trim();

    // Détecter la pièce
    const roomMatch = lower.match(
      /\b(salon|chambre|cuisine|bureau|couloir|salle[- ]de[- ]bain|toilettes?)\b/i
    );
    const roomName = roomMatch?.[0] ?? undefined;

    // Détecter le niveau (brightness)
    const brightnessMatch = lower.match(/(\d+)\s*%/);
    const brightness = brightnessMatch ? parseInt(brightnessMatch[1]) : undefined;

    // Détecter les intentions
    if (/\b(éteins?|eteins?|off|coupe|coupe les lumières)\b/i.test(lower)) {
      if (roomName) return this.setRoom(this.capitalizeRoom(roomName), { on: false });
      return this.applyPreset("off");
    }

    if (/\b(allume|mets?|active|lumière)\b/i.test(lower)) {
      const state: HueLightState = { on: true };
      if (brightness !== undefined) state.brightness = brightness;
      if (roomName) return this.setRoom(this.capitalizeRoom(roomName), state);
    }

    // Détecter les présets
    for (const [presetKey] of Object.entries(HUE_PRESETS)) {
      if (lower.includes(presetKey)) {
        return this.applyPreset(presetKey, roomName ? this.capitalizeRoom(roomName) : undefined);
      }
    }

    // Détecter les scènes Hue
    const sceneMatch = lower.match(/\bscène?\s+["']?([a-zA-ZÀ-ÿ ]+)["']?/i);
    if (sceneMatch) {
      return this.setScene(sceneMatch[1].trim(), roomName ? this.capitalizeRoom(roomName) : undefined);
    }

    return { success: false, error: `Command not understood: "${command}"` };
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  private buildLightArgs(state: HueLightState): string {
    const args: string[] = [];

    if (state.on === true) args.push("--on");
    else if (state.on === false) args.push("--off");

    if (state.brightness !== undefined) args.push(`--brightness ${state.brightness}`);
    if (state.colorTemperature !== undefined) args.push(`--temperature ${state.colorTemperature}`);
    if (state.color !== undefined) args.push(`--color "${state.color}"`);
    if (state.transitionTime !== undefined) args.push(`--transition ${Math.round(state.transitionTime / 100)}`);

    return args.join(" ");
  }

  private capitalizeRoom(room: string): string {
    return room.charAt(0).toUpperCase() + room.slice(1).toLowerCase();
  }

  private parseLightText(text: string): HueLight[] {
    const lights: HueLight[] = [];
    const lines = text.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const parts = line.trim().split(/\s{2,}/);
      if (parts.length >= 2) {
        lights.push({
          id: String(lights.length),
          name: parts[0] ?? "Unknown",
          state: (parts[1]?.toLowerCase() === "on" ? "on" : "off") as "on" | "off",
        });
      }
    }
    return lights;
  }

  private async exec(command: string): Promise<HueCommandResult> {
    try {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      const { stdout, stderr } = await execAsync(command, {
        timeout: 10_000,
        env: { ...process.env },
      });

      return { success: true, output: stdout.trim() || stderr.trim() };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.debug(`openhue command failed: ${command} → ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _hue: OpenhueIntegration | null = null;

export function getOpenhue(): OpenhueIntegration {
  if (!_hue) _hue = new OpenhueIntegration();
  return _hue;
}
