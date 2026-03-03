---
name: openhue
description: Control Philips Hue lights and scenes via the OpenHue CLI.
homepage: https://www.openhue.io/cli
implementation: src/autonomy/hue/openhue-integration.ts
class: OpenhueIntegration
singleton: getOpenhue()
metadata:
  {
    "openclaw":
      {
        "emoji": "💡",
        "requires": { "bins": ["openhue"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "openhue/cli/openhue-cli",
              "bins": ["openhue"],
              "label": "Install OpenHue CLI (brew)",
            },
          ],
      },
  }
---

# OpenHue CLI

Use `openhue` to control Philips Hue lights and scenes via a Hue Bridge.

## When to Use

✅ **USE this skill when:**

- "Turn on/off the lights"
- "Dim the living room lights"
- "Set a scene" or "movie mode"
- Controlling specific Hue rooms or zones
- Adjusting brightness, color, or color temperature

## When NOT to Use

❌ **DON'T use this skill when:**

- Non-Hue smart devices (other brands) → not supported
- HomeKit scenes or Shortcuts → use Apple's ecosystem
- TV or entertainment system control
- Thermostat or HVAC
- Smart plugs (unless Hue smart plugs)

## Common Commands

### List Resources

```bash
openhue get light       # List all lights
openhue get room        # List all rooms
openhue get scene       # List all scenes
```

### Control Lights

```bash
# Turn on/off
openhue set light "Bedroom Lamp" --on
openhue set light "Bedroom Lamp" --off

# Brightness (0-100)
openhue set light "Bedroom Lamp" --on --brightness 50

# Color temperature (warm to cool: 153-500 mirek)
openhue set light "Bedroom Lamp" --on --temperature 300

# Color (by name or hex)
openhue set light "Bedroom Lamp" --on --color red
openhue set light "Bedroom Lamp" --on --rgb "#FF5500"
```

### Control Rooms

```bash
# Turn off entire room
openhue set room "Bedroom" --off

# Set room brightness
openhue set room "Bedroom" --on --brightness 30
```

### Scenes

```bash
# Activate scene
openhue set scene "Relax" --room "Bedroom"
openhue set scene "Concentrate" --room "Office"
```

## Quick Presets

```bash
# Bedtime (dim warm)
openhue set room "Bedroom" --on --brightness 20 --temperature 450

# Work mode (bright cool)
openhue set room "Office" --on --brightness 100 --temperature 250

# Movie mode (dim)
openhue set room "Living Room" --on --brightness 10
```

## Notes

- Bridge must be on local network
- First run requires button press on Hue bridge to pair
- Colors only work on color-capable bulbs (not white-only)

---

## TypeScript Integration (Jarvis)

L'implémentation TypeScript se trouve dans `src/autonomy/hue/openhue-integration.ts`.

### Usage

```typescript
import { getOpenhue } from "../../autonomy/hue/index.js";

const hue = getOpenhue();

// Vérifier la disponibilité du CLI
if (await hue.isAvailable()) {
  // Lister les lumières
  const lights = await hue.listLights();

  // Contrôler une pièce
  await hue.setRoom("Salon", { on: true, brightness: 70 });

  // Appliquer un préset
  await hue.applyPreset("cinema", "Salon");

  // Commande en langage naturel
  await hue.handleNaturalCommand("allume le salon à 60%");
  await hue.handleNaturalCommand("mode nuit dans la chambre");
  await hue.handleNaturalCommand("éteins la cuisine");
}
```

### Présets disponibles

| Préset | Brightness | Température |
|--------|-----------|-------------|
| `work` / `bureau` / `focus` | 90–100% | Froide (233–250 mirek) |
| `relax` / `soiree` / `lecture` | 40–70% | Chaude-neutre (300–400 mirek) |
| `cinema` / `film` / `movie` | 10% | Très chaude (500 mirek) |
| `nuit` / `veilleuse` / `coucher` | 3–15% | Très chaude (450–500 mirek) |
| `matin` / `reveil` | 50–70% | Neutre (330–370 mirek) |
| `fete` / `party` | 80% | Rose (#FF0088) |
| `disco` | 100% | Bleu |
| `off` / `eteint` | — | Extinction |

### Variables d'environnement

Aucune variable requise — le CLI `openhue` gère l'authentification au bridge lors du `openhue setup` initial.
