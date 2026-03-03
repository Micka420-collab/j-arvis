---
name: tuya-smart
description: Contrôle d'appareils Tuya/Smart Life (prises, ampoules, appareils connectés).
homepage: https://developer.tuya.com/
metadata:
  {
    "openclaw":
      {
        "emoji": "🔌",
        "requires": { "env": ["TUYA_ACCESS_ID", "TUYA_ACCESS_KEY"] },
        "install":
          [
            {
              "id": "pip-tinytuya",
              "kind": "pip",
              "package": "tinytuya",
              "bins": ["tinytuya"],
              "label": "Install TinyTuya (pip)",
            },
          ],
      },
  }
---

# Tuya / Smart Life — Contrôle d'Appareils Connectés

Contrôlez vos appareils Tuya/Smart Life : prises connectées, ampoules, humidificateurs, robots aspirateurs, et plus.

## Configuration requise

```env
TUYA_ACCESS_ID=votre_access_id
TUYA_ACCESS_KEY=votre_access_key
TUYA_REGION=eu  # eu, us, cn, in
```

Pour obtenir vos clés API :

1. Créez un compte sur https://platform.tuya.com/
2. Créez un projet Cloud
3. Liez votre compte Smart Life au projet
4. Copiez l'Access ID et l'Access Key

## Quand utiliser

✅ **UTILISEZ ce skill quand :**

- Contrôle de prises connectées Tuya/Smart Life
- Contrôle d'ampoules Tuya
- Contrôle d'appareils Smart Life (humidificateurs, ventilateurs, etc.)
- Monitoring d'appareils IoT Tuya

## Quand NE PAS utiliser

❌ **N'UTILISEZ PAS ce skill quand :**

- Les appareils sont déjà dans Home Assistant → utilisez le skill `home-assistant`
- Appareils Philips Hue → utilisez le skill `openhue`
- Appareils Zigbee/MQTT → utilisez le skill `mqtt-domotique`

## Scanner les appareils

```bash
python3 -m tinytuya scan
```

## Configuration locale

```bash
python3 -m tinytuya wizard
```

Cela crée un fichier `devices.json` avec les infos de vos appareils.

## Commandes via API REST Tuya

### Lister les appareils

```bash
# Via l'API Cloud Tuya
curl -s -H "client_id: $TUYA_ACCESS_ID" \
  -H "sign: <signature_calculée>" \
  -H "t: <timestamp>" \
  "https://openapi.tuya$TUYA_REGION.com/v1.0/devices" | jq '.result'
```

### Contrôle via TinyTuya (Python)

```python
import tinytuya

# Connexion à un appareil
d = tinytuya.OutletDevice('DEVICE_ID', 'IP_ADDRESS', 'LOCAL_KEY')
d.set_version(3.3)

# Allumer
d.turn_on()

# Éteindre
d.turn_off()

# État
data = d.status()
print(data)

# Contrôle d'une ampoule
bulb = tinytuya.BulbDevice('DEVICE_ID', 'IP_ADDRESS', 'LOCAL_KEY')
bulb.set_version(3.3)
bulb.turn_on()
bulb.set_brightness(50)  # 0-100
bulb.set_colourtemp(500)  # warm-cool
bulb.set_colour(255, 0, 0)  # RGB rouge
```

### Script bash rapide (via TinyTuya CLI)

```bash
# Allumer un appareil
python3 -c "
import tinytuya
d = tinytuya.OutletDevice('$DEVICE_ID', '$DEVICE_IP', '$LOCAL_KEY')
d.set_version(3.3)
d.turn_on()
print('Allumé')
"

# Éteindre
python3 -c "
import tinytuya
d = tinytuya.OutletDevice('$DEVICE_ID', '$DEVICE_IP', '$LOCAL_KEY')
d.set_version(3.3)
d.turn_off()
print('Éteint')
"
```

## Notes

- TinyTuya permet un contrôle **local** (sans cloud) si vous avez la local_key
- La local_key se récupère via `tinytuya wizard` ou depuis la plateforme Tuya
- Les appareils doivent être sur le même réseau que la machine Jarvis
- Version du protocole : la plupart des appareils récents utilisent la version 3.3 ou 3.4
- Si un appareil ne répond pas, vérifiez qu'il est en ligne dans l'app Smart Life
