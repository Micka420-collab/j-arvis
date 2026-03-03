# 🤖 Jarvis — Assistant IA Domotique Personnel

<p align="center">
  <strong>À votre service, Monsieur.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**Jarvis** est votre _assistant IA personnel_ qui tourne sur vos propres appareils.
Il répond sur les canaux que vous utilisez déjà (WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, IRC, Microsoft Teams, Matrix, WebChat, et plus).
Il peut parler et écouter, contrôler votre navigateur, et **gérer toute votre domotique**.

Basé sur le projet open-source OpenClaw, Jarvis est conçu pour être votre majordome numérique personnel — sans restrictions, sans limites.

## 🏠 Domotique

Jarvis peut contrôler toute votre maison connectée :

- **💡 Philips Hue** — Lumières, scènes, ambiances (via skill `openhue`)
- **🔊 Sonos** — Musique, volume, groupes d'enceintes (via skill `sonoscli`)
- **🏡 Home Assistant** — Contrôle complet de votre installation domotique (via skill `home-assistant`)
- **📡 MQTT / Zigbee2MQTT** — Appareils IoT, capteurs, actuateurs (via skill `mqtt-domotique`)
- **🔌 Tuya / Smart Life** — Prises, ampoules, appareils connectés (via skill `tuya-smart`)

### Exemples de commandes

```
"Jarvis, allume les lumières du salon"
"Jarvis, mets la température à 21 degrés"
"Jarvis, lance la scène cinéma"
"Jarvis, ferme les volets"
"Jarvis, quel est l'état de la maison ?"
```

## ⚡ Installation rapide

Runtime: **Node ≥22**.

```bash
npm install -g jarvis@latest

jarvis onboard --install-daemon
```

L'assistant d'installation configure le Gateway daemon pour qu'il reste toujours actif.

## 🚀 Démarrage rapide

```bash
jarvis onboard --install-daemon

jarvis gateway --port 18789 --verbose

# Envoyer un message
jarvis message send --to +1234567890 --message "Bonjour de Jarvis"

# Parler à l'assistant
jarvis agent --message "Allume les lumières du salon" --thinking high
```

## 🌟 Points Forts

- **🏠 Domotique complète** — Home Assistant, Philips Hue, MQTT, Tuya, Sonos
- **💬 Multi-canal** — WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams, et plus
- **🎙️ Commande vocale** — Wake words, Talk Mode, TTS
- **🖥️ Contrôle navigateur** — Chrome/Chromium intégré
- **🔧 Skills extensibles** — 50+ skills préintégrées + plugins personnalisés
- **🔒 Local-first** — Tourne sur vos appareils, vos données restent chez vous
- **📱 Multi-plateforme** — macOS, iOS, Android, Windows (WSL2), Linux
- **🤖 Multi-modèle** — OpenAI, Anthropic, Google, et plus
- **⚡ Déverrouillé** — Pas de restrictions d'outil, accès complet au système

## 📡 Canaux supportés

WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, BlueBubbles (iMessage), IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, WebChat.

## ⚙️ Configuration

Configuration minimale `~/.openclaw/openclaw.json` :

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-6",
  },
}
```

## 🏠 Configuration Domotique

Ajoutez vos clés API domotique dans votre fichier `.env` :

```env
# Home Assistant
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=votre_token_longue_durée

# MQTT
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=jarvis
MQTT_PASSWORD=votre_mot_de_passe

# Tuya
TUYA_ACCESS_ID=votre_access_id
TUYA_ACCESS_KEY=votre_access_key
```

## 🔓 Mode Déverrouillé

Jarvis fonctionne en mode déverrouillé par défaut :

- ✅ Accès complet au système de fichiers
- ✅ Exécution de commandes sans restrictions
- ✅ Accès réseau complet
- ✅ Tous les outils activés (browser, canvas, nodes, cron)
- ✅ Pas de sandbox par défaut (usage personnel)

## 📋 Commandes Chat

Envoyez ces commandes sur WhatsApp/Telegram/Slack/Discord/WebChat :

- `/status` — Statut de la session
- `/new` ou `/reset` — Réinitialiser la session
- `/compact` — Compacter le contexte
- `/think <level>` — off|minimal|low|medium|high|xhigh
- `/verbose on|off`
- `/restart` — Redémarrer le gateway

## 🛠️ Développement

```bash
git clone <votre-repo>
cd jarvis

pnpm install
pnpm ui:build
pnpm build

pnpm jarvis onboard --install-daemon

# Boucle de dev (auto-reload)
pnpm gateway:watch
```

## 📜 Licence

MIT — Faites-en ce que vous voulez.

---

_"À votre service, Monsieur."_ — **Jarvis** 🤖
