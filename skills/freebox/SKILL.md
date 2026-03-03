---
name: freebox
description: Contrôle de la Freebox (Free), Livebox (Orange), SFR Box via leurs API locales.
homepage: https://dev.freebox.fr/sdk/os/
metadata: { "openclaw": { "emoji": "📦" } }
---

# Freebox / Livebox / SFR Box — Contrôle Box Internet

Contrôlez votre box internet française : redémarrer le WiFi, voir les appareils connectés, contrôler le player TV, et plus.

## Freebox (Free)

### Configuration

La Freebox dispose d'une API locale complète. Première étape : obtenir un token d'accès.

```bash
# Demander l'autorisation (appuyez sur ✓ sur l'écran LCD de la Freebox)
curl -s http://mafreebox.freebox.fr/api/v8/login/authorize/ \
  -d '{"app_id":"jarvis","app_name":"Jarvis","app_version":"1.0","device_name":"Jarvis Assistant"}' | jq
```

Notez le `app_token` retourné et ajoutez-le à votre `.env` :

```env
FREEBOX_APP_TOKEN=votre_app_token
FREEBOX_APP_ID=jarvis
FREEBOX_URL=http://mafreebox.freebox.fr
```

### Session (authentification)

```bash
# Obtenir le challenge
CHALLENGE=$(curl -s http://mafreebox.freebox.fr/api/v8/login/ | jq -r '.result.challenge')

# Calculer le password (HMAC-SHA1)
PASSWORD=$(echo -n "$CHALLENGE" | openssl dgst -sha1 -hmac "$FREEBOX_APP_TOKEN" | awk '{print $2}')

# Ouvrir la session
SESSION_TOKEN=$(curl -s http://mafreebox.freebox.fr/api/v8/login/session/ \
  -d "{\"app_id\":\"jarvis\",\"password\":\"$PASSWORD\"}" | jq -r '.result.session_token')
```

### Commandes courantes

```bash
# État de la connexion internet
curl -s -H "X-Fbx-App-Auth: $SESSION_TOKEN" \
  http://mafreebox.freebox.fr/api/v8/connection/ | jq '.result | {state, type, ipv4, rate_down, rate_up}'

# Appareils connectés au réseau
curl -s -H "X-Fbx-App-Auth: $SESSION_TOKEN" \
  http://mafreebox.freebox.fr/api/v8/lan/browser/pub/ | jq '.result[] | {primary_name, l3connectivities: [.l3connectivities[].addr], active}'

# Redémarrer la Freebox
curl -s -X POST -H "X-Fbx-App-Auth: $SESSION_TOKEN" \
  http://mafreebox.freebox.fr/api/v8/system/reboot/

# État du WiFi
curl -s -H "X-Fbx-App-Auth: $SESSION_TOKEN" \
  http://mafreebox.freebox.fr/api/v8/wifi/config/ | jq '.result | {enabled}'

# Activer/Désactiver le WiFi
curl -s -X PUT -H "X-Fbx-App-Auth: $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' \
  http://mafreebox.freebox.fr/api/v8/wifi/config/

# Contrôle du Freebox Player (TV)
# Play/Pause
curl -s -X POST -H "X-Fbx-App-Auth: $SESSION_TOKEN" \
  http://mafreebox.freebox.fr/api/v8/airmedia/receivers/Freebox%20Player/ \
  -d '{"action":"toggle_pause","media_type":"video"}'

# Baisser/Monter le volume
curl -s -X POST -H "X-Fbx-App-Auth: $SESSION_TOKEN" \
  http://mafreebox.freebox.fr/api/v8/airmedia/receivers/Freebox%20Player/ \
  -d '{"action":"volume_dec"}'

# Téléchargements en cours
curl -s -H "X-Fbx-App-Auth: $SESSION_TOKEN" \
  http://mafreebox.freebox.fr/api/v8/downloads/ | jq '.result[] | {name, status, rx_pct, rx_rate}'

# Système - températures et ventilateurs
curl -s -H "X-Fbx-App-Auth: $SESSION_TOKEN" \
  http://mafreebox.freebox.fr/api/v8/system/ | jq '.result | {temp_cpub, temp_cpum, fan_rpm}'
```

## Livebox (Orange)

### Configuration

```env
LIVEBOX_URL=http://192.168.1.1
LIVEBOX_PASSWORD=votre_mot_de_passe_admin
```

### Authentification

```bash
# Obtenir un token de session
CONTEXT_ID=$(curl -s -X POST http://192.168.1.1/ws \
  -H "Content-Type: application/x-sah-ws-4-call+json" \
  -d '{"service":"sah.Device.Information","method":"createContext","parameters":{"applicationName":"so_sdkut","username":"admin","password":"'$LIVEBOX_PASSWORD'"}}' | jq -r '.data.contextID')
```

### Commandes courantes

```bash
# Appareils connectés
curl -s -X POST http://192.168.1.1/ws \
  -H "Content-Type: application/x-sah-ws-4-call+json" \
  -H "X-Context: $CONTEXT_ID" \
  -d '{"service":"Devices","method":"get","parameters":{}}' | jq '.status'

# Redémarrer la Livebox
curl -s -X POST http://192.168.1.1/ws \
  -H "Content-Type: application/x-sah-ws-4-call+json" \
  -H "X-Context: $CONTEXT_ID" \
  -d '{"service":"NMC","method":"reboot","parameters":{}}'

# État WiFi
curl -s -X POST http://192.168.1.1/ws \
  -H "Content-Type: application/x-sah-ws-4-call+json" \
  -H "X-Context: $CONTEXT_ID" \
  -d '{"service":"NMC.Wifi","method":"get","parameters":{}}' | jq '.data | {Enable, Status}'

# Activer/Désactiver WiFi
curl -s -X POST http://192.168.1.1/ws \
  -H "Content-Type: application/x-sah-ws-4-call+json" \
  -H "X-Context: $CONTEXT_ID" \
  -d '{"service":"NMC.Wifi","method":"set","parameters":{"Enable":true,"Status":true}}'
```

## SFR Box

### Configuration

```env
SFRBOX_URL=http://192.168.1.1
SFRBOX_PASSWORD=votre_mot_de_passe
```

### Commandes courantes

```bash
# Informations système
curl -s "http://192.168.1.1/api/1.0/?method=system.getInfo" | jq

# État de la connexion
curl -s "http://192.168.1.1/api/1.0/?method=wan.getInfo" | jq

# Appareils connectés
curl -s "http://192.168.1.1/api/1.0/?method=lan.getHostsList" | jq

# État WiFi
curl -s "http://192.168.1.1/api/1.0/?method=wlan.getInfo" | jq
```

## Notes

- Les API sont locales — la box doit être sur le même réseau que Jarvis
- Freebox : l'autorisation initiale nécessite d'appuyer sur le bouton LCD
- Livebox : le mot de passe admin est sur l'étiquette sous la box
- Les IP par défaut : Freebox = `mafreebox.freebox.fr`, Livebox = `192.168.1.1`, SFR = `192.168.1.1`
