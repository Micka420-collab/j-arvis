/**
 * Hue — module d'intégration Philips Hue pour Jarvis
 *
 * Expose le wrapper OpenhueIntegration et les types associés.
 * Utilise le CLI `openhue` en sous-jacent (brew install openhue/cli/openhue-cli).
 */

export {
  OpenhueIntegration,
  getOpenhue,
  HUE_PRESETS,
} from "./openhue-integration.js";

export type {
  HueLightState,
  HueLight,
  HueRoom,
  HueScene,
  HueCommandResult,
} from "./openhue-integration.js";
