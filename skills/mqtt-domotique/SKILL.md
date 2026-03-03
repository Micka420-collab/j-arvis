---
name: mqtt-domotique
description: Contrôle d'appareils IoT via MQTT (Zigbee2MQTT, Tasmota, ESPHome).
homepage: https://mqtt.org/
metadata:
  {
    "openclaw":
      {
        "emoji": "📡",
        "requires": { "env": ["MQTT_BROKER_URL"] },
        "install":
          [
            {
              "id": "brew-mosquitto",
              "kind": "brew",
              "formula": "mosquitto",
              "bins": ["mosquitto_pub", "mosquitto_sub"],
              "label": "Install Mosquitto MQTT clients (brew)",
            },
          ],
      },
  }
---

# MQTT Domotique — Contrôle IoT Direct

Contrôlez vos appareils IoT via MQTT : Zigbee2MQTT, Tasmota, ESPHome, et tout appareil compatible MQTT.

## Configuration requise

```env
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=jarvis
MQTT_PASSWORD=votre_mot_de_passe
```

## Quand utiliser

✅ **UTILISEZ ce skill quand :**

- Contrôle direct d'appareils Zigbee via Zigbee2MQTT
- Contrôle d'appareils Tasmota (prises, ampoules, relais)
- Contrôle d'appareils ESPHome
- Monitoring de capteurs IoT (température, humidité, mouvement)
- Tout appareil publiant/souscrivant via MQTT

## Quand NE PAS utiliser

❌ **N'UTILISEZ PAS ce skill quand :**

- Home Assistant est disponible et configuré → utilisez le skill `home-assistant`
- Philips Hue via pont → utilisez le skill `openhue`
- Sonos → utilisez le skill `sonoscli`

## Commandes Zigbee2MQTT

### Lister les appareils

```bash
mosquitto_sub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "zigbee2mqtt/bridge/devices" -C 1 | jq '.[].friendly_name'
```

### Contrôler un appareil

```bash
# Allumer
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "zigbee2mqtt/lampe_salon/set" -m '{"state": "ON"}'

# Éteindre
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "zigbee2mqtt/lampe_salon/set" -m '{"state": "OFF"}'

# Luminosité (0-254)
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "zigbee2mqtt/lampe_salon/set" -m '{"state": "ON", "brightness": 128}'

# Couleur
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "zigbee2mqtt/lampe_salon/set" -m '{"state": "ON", "color": {"hex": "#FF5500"}}'

# Température de couleur
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "zigbee2mqtt/lampe_salon/set" -m '{"state": "ON", "color_temp": 350}'
```

### Lire un capteur

```bash
# Écouter un capteur de température/humidité
mosquitto_sub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "zigbee2mqtt/capteur_salon" -C 1 | jq '{temperature, humidity, battery}'
```

## Commandes Tasmota

### Contrôle basique

```bash
# Allumer
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "cmnd/prise_bureau/POWER" -m "ON"

# Éteindre
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "cmnd/prise_bureau/POWER" -m "OFF"

# Toggle
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "cmnd/prise_bureau/POWER" -m "TOGGLE"

# État
mosquitto_sub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "stat/prise_bureau/POWER" -C 1
```

### Monitoring énergie (Tasmota avec mesure de puissance)

```bash
mosquitto_sub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "tele/prise_bureau/SENSOR" -C 1 | jq '.ENERGY'
```

## Commandes ESPHome

```bash
# Allumer un switch
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "esphome/device_name/switch/relay/command" -m "ON"

# Lire un capteur
mosquitto_sub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "esphome/device_name/sensor/temperature/state" -C 1
```

## Commande générique MQTT

```bash
# Publier un message
mosquitto_pub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "topic/quelconque" -m "message"

# Écouter un topic
mosquitto_sub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "topic/quelconque" -C 1

# Écouter tous les messages (debug)
mosquitto_sub -h localhost -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t "#" -v
```

## Notes

- Le broker MQTT doit être accessible depuis la machine Jarvis
- Zigbee2MQTT utilise le préfixe `zigbee2mqtt/` par défaut
- Tasmota utilise les préfixes `cmnd/`, `stat/`, `tele/`
- Pour les appareils sans nom, utilisez l'adresse IEEE (ex: `0x00158d0001234567`)
- `-C 1` = recevez un seul message puis quittez
