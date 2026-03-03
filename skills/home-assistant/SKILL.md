---
name: home-assistant
description: Contrôle complet de votre installation Home Assistant via l'API REST.
homepage: https://www.home-assistant.io/
metadata:
  {
    "openclaw":
      {
        "emoji": "🏡",
        "requires": { "env": ["HOME_ASSISTANT_URL", "HOME_ASSISTANT_TOKEN"] },
      },
  }
---

# Home Assistant — Contrôle Domotique Complet

Utilisez l'API REST de Home Assistant pour contrôler tous vos appareils connectés.

## Configuration requise

```env
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=votre_token_longue_durée
```

Pour créer un token longue durée :

1. Ouvrez Home Assistant → Profil utilisateur
2. Tout en bas → "Tokens d'accès longue durée"
3. Créez un token et copiez-le

## Quand utiliser

✅ **UTILISEZ ce skill quand :**

- "Allume/éteins les lumières"
- "Règle la température à 21°C"
- "Ferme les volets"
- "Active la scène cinéma"
- "Quel est l'état de la maison ?"
- "Verrouille la porte d'entrée"
- "Montre les caméras"
- Tout contrôle d'appareil connecté via Home Assistant

## Quand NE PAS utiliser

❌ **N'UTILISEZ PAS ce skill quand :**

- Appareils Philips Hue directement → utilisez le skill `openhue`
- Enceintes Sonos → utilisez le skill `sonoscli`
- Appareils uniquement sur Tuya → utilisez le skill `tuya-smart`

## Commandes API

### Lister les entités

```bash
curl -s -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  "$HOME_ASSISTANT_URL/api/states" | jq '.[].entity_id'
```

### État d'une entité

```bash
curl -s -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  "$HOME_ASSISTANT_URL/api/states/light.salon" | jq '{state, attributes: {brightness, color_temp}}'
```

### Allumer/Éteindre

```bash
# Allumer une lumière
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "light.salon"}' \
  "$HOME_ASSISTANT_URL/api/services/light/turn_on"

# Éteindre
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "light.salon"}' \
  "$HOME_ASSISTANT_URL/api/services/light/turn_off"

# Avec luminosité et couleur
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "light.salon", "brightness": 128, "color_temp": 300}' \
  "$HOME_ASSISTANT_URL/api/services/light/turn_on"
```

### Climatisation / Chauffage

```bash
# Régler la température
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "climate.thermostat_salon", "temperature": 21}' \
  "$HOME_ASSISTANT_URL/api/services/climate/set_temperature"

# Changer le mode (heat, cool, auto, off)
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "climate.thermostat_salon", "hvac_mode": "heat"}' \
  "$HOME_ASSISTANT_URL/api/services/climate/set_hvac_mode"
```

### Volets / Stores

```bash
# Ouvrir
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "cover.volet_salon"}' \
  "$HOME_ASSISTANT_URL/api/services/cover/open_cover"

# Fermer
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "cover.volet_salon"}' \
  "$HOME_ASSISTANT_URL/api/services/cover/close_cover"

# Position (0=fermé, 100=ouvert)
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "cover.volet_salon", "position": 50}' \
  "$HOME_ASSISTANT_URL/api/services/cover/set_cover_position"
```

### Scènes

```bash
# Activer une scène
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "scene.cinema"}' \
  "$HOME_ASSISTANT_URL/api/services/scene/turn_on"
```

### Serrures

```bash
# Verrouiller
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "lock.porte_entree"}' \
  "$HOME_ASSISTANT_URL/api/services/lock/lock"

# Déverrouiller
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "lock.porte_entree"}' \
  "$HOME_ASSISTANT_URL/api/services/lock/unlock"
```

### Interrupteurs / Prises

```bash
# Allumer
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "switch.prise_bureau"}' \
  "$HOME_ASSISTANT_URL/api/services/switch/turn_on"
```

## Scènes prédéfinies courantes

```bash
# Matin — lumières vives, volets ouverts
# Cinéma — lumières tamisées, volets fermés
# Nuit — tout éteint, alarme activée
# Absent — économie d'énergie, simulation présence
```

## Notes

- L'URL doit être accessible depuis la machine qui fait tourner Jarvis
- Le token doit avoir les permissions suffisantes
- Les entity_id sont au format `domaine.nom` (ex: `light.salon`, `climate.thermostat`)
- Utilisez l'interface HA pour découvrir vos entity_id exacts
