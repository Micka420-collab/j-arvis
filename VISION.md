## Vision Jarvis

Jarvis est l'IA qui agit vraiment.
Il tourne sur vos appareils, dans vos canaux, avec vos règles.

Ce document explique l'état actuel et la direction du projet.

Jarvis est né de la vision de créer un assistant personnel véritablement utile :
un majordome numérique capable de contrôler votre maison, gérer vos messages, et exécuter des tâches réelles sur un vrai ordinateur — sans restrictions.

L'objectif : un assistant personnel facile à utiliser, supportant un large éventail de plateformes, et qui respecte votre vie privée.

### Priorités actuelles :

- **Domotique complète** — Home Assistant, Philips Hue, MQTT, Tuya, Sonos
- **Stabilité et fiabilité** — Corrections de bugs, setup fiable
- **Support multi-canal** — WhatsApp, Telegram, Discord, Slack, Signal, et plus
- **Commande vocale** — Wake words, Talk Mode, TTS
- **Contrôle total** — Pas de sandbox, pas de restrictions pour usage personnel

### Prochaines priorités :

- Support de tous les fournisseurs de modèles majeurs
- Amélioration des capacités d'automatisation et d'agent
- Ergonomie CLI et interface web
- Applications compagnon sur toutes les plateformes

## Domotique

La domotique est au cœur de Jarvis. L'objectif est de pouvoir contrôler chaque aspect de votre maison connectée :

- **Éclairage** — Philips Hue, MQTT lights, Tuya bulbs
- **Chauffage/Climatisation** — Thermostats via Home Assistant
- **Volets/Stores** — Contrôle via Home Assistant ou MQTT
- **Sécurité** — Caméras, serrures, alarmes
- **Multimédia** — Sonos, Chromecast, TV
- **Énergie** — Prises connectées, monitoring consommation
- **Capteurs** — Température, humidité, mouvement, ouverture

## Plugins & Skills

Jarvis a une API de plugins extensible.
Le cœur reste léger ; les capacités optionnelles sont livrées comme skills.

Skills domotique incluses :

- `openhue` — Philips Hue
- `sonoscli` — Sonos
- `home-assistant` — Home Assistant
- `mqtt-domotique` — MQTT/Zigbee2MQTT/Tasmota
- `tuya-smart` — Tuya/Smart Life

## Pourquoi TypeScript ?

Jarvis est principalement un système d'orchestration : prompts, outils, protocoles et intégrations.
TypeScript a été choisi pour garder Jarvis facilement hackable par défaut.

## Mode Déverrouillé

Jarvis fonctionne sans restrictions par défaut. C'est votre assistant personnel — il a votre confiance totale.
Pas de sandbox, pas de DM pairing obligatoire, accès complet à tous les outils.
