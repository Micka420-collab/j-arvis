# 🤖 Jarvis 2.0 — Rapport d'Implémentation Complète

> Version : v2026.3.2 — Rapport final · Mars 2026

---

## Vue d'ensemble

Jarvis 2.0 est désormais un assistant IA **pleinement autonome**, capable d'écouter votre voix à domicile, de contrôler vos appareils connectés, d'apprendre de vos habitudes et de vous notifier de manière proactive — le tout en français, avec la personnalité de Jarvis.

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        JARVIS 2.0                               │
│                                                                  │
│  ┌──────────────┐    ┌────────────────────────────────────────┐ │
│  │  MODULE VOCAL │    │           GATEWAY PRINCIPAL            │ │
│  │              │    │                                        │ │
│  │  🎙️ Micro     │    │  📲 Telegram / Discord / Slack         │ │
│  │     ↓        │    │         ↓                              │ │
│  │  sox VAD     │    │  AutonomyGatewayIntegration            │ │
│  │     ↓        │───▶│         ↓                              │ │
│  │  Mistral STT │    │  GatewayJarvisBridge (réel)            │ │
│  │     ↓        │    │    ├── notify()  → sendMessage()       │ │
│  │  Wake word   │    │    ├── execute() → HA / Message        │ │
│  │  detection   │    │    └── requestApproval() → timeout     │ │
│  │     ↓        │    │         ↓                              │ │
│  │  Jarvis agent│    │  AutonomyService                       │ │
│  │     ↓        │    │    ├── LearningEngine                  │ │
│  │  ElevenLabs  │    │    ├── PatternDetector                 │ │
│  │  / say       │    │    ├── DecisionEngine                  │ │
│  └──────────────┘    │    ├── GoalManager                     │ │
│                       │    ├── KnowledgeGraph (JSON persist)   │ │
│  ┌──────────────┐    │    ├── EthicsGuard                     │ │
│  │  DOMOTIQUE   │    │    ├── ActionPlanner                   │ │
│  │              │◀───│    └── ProactiveEngine                 │ │
│  │  Home Assist │    │         ↓                              │ │
│  │  (REST API)  │    │  HomeAssistantClient (direct HTTP)     │ │
│  │  🏡 Lumières │    │         ↓                              │ │
│  │  🌡️ Thermost │    │  ~/.openclaw/knowledge-graph.json      │ │
│  │  🪟 Volets   │    └────────────────────────────────────────┘ │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modules implémentés

### 1. 🧠 Moteur d'Autonomie (Sessions 2-3)

| Fichier | Rôle | État |
|---------|------|------|
| `src/autonomy/decision-engine.ts` | Prend des décisions contextuelles avec 4 critères | ✅ Complété |
| `src/autonomy/action-planner.ts` | Planifie les actions en séquences | ✅ Complété |
| `src/autonomy/goal-manager.ts` | Gère 5 critères d'évaluation des objectifs | ✅ Complété |
| `src/autonomy/knowledge-graph.ts` | Persistance JSON (`~/.openclaw/knowledge-graph.json`) | ✅ Complété |
| `src/autonomy/proactive-engine.ts` | Suggestions proactives par fenêtre temporelle | ✅ Créé |
| `src/autonomy/jarvis-bridge.ts` | Interface de connexion autonomie↔gateway | ✅ Créé |

### 2. 🔌 Bridge Gateway (Session 3)

Fichier : `src/autonomy/integration/gateway-integration.ts`

| Méthode | Fonctionnalité | État |
|---------|----------------|------|
| `GatewayJarvisBridge.notify()` | Envoie via `sendMessage()` (import dynamique) | ✅ |
| `GatewayJarvisBridge.execute()` → message:* | Envoie un message à l'utilisateur | ✅ |
| `GatewayJarvisBridge.execute()` → domotic:* | Appelle HomeAssistantClient directement | ✅ |
| `GatewayJarvisBridge.requestApproval()` | Envoie demande + attend réponse (timeout) | ✅ |
| `GatewayJarvisBridge.hasPendingApprovals()` | Détecte les approbations en attente | ✅ |
| `handleIncomingMessage()` → `parseApprovalResponse()` | Résout les approbations depuis chat | ✅ |

### 3. 🎙️ Module Vocal Mistral STT (Session 4)

Pipeline complet : **Micro → sox VAD → Mistral STT → Wake word → Jarvis → TTS**

| Fichier | Rôle |
|---------|------|
| `src/voice/mistral-stt-client.ts` | Client API Mistral STT (transcription audio) |
| `src/voice/audio-capture.ts` | Capture micro (sox/arecord/ffmpeg + VAD) |
| `src/voice/voice-pipeline.ts` | Orchestrateur du pipeline vocal |
| `src/voice/voice-daemon.ts` | Daemon persistant + reconnexion auto |
| `src/voice/index.ts` | Exports du module |
| `skills/mistral-stt/` | Skill + scripts test/transcription |

### 4. 🏡 Home Assistant (Session 5)

Fichier : `src/domotic/home-assistant-client.ts`

**Commandes supportées via bridge :**

```
domotic:light_on       → Allume lumière (entity_id, brightness?, color_temp?)
domotic:light_off      → Éteint lumière
domotic:light_toggle   → Bascule lumière
domotic:cover_open     → Ouvre volet
domotic:cover_close    → Ferme volet
domotic:cover_set      → Positionne volet (0-100%)
domotic:switch_on/off  → Active/désactive prise
domotic:set_temp       → Règle thermostat (temperature en °C)
domotic:scene_activate → Active une scène HA
domotic:get_state      → Lit l'état d'une entité
domotic:list_entities  → Liste les entités (domain_filter optionnel)
domotic:call_service   → Appel service HA générique (domain, service, data)
```

### 5. 🔔 Approbations interactives

Résolution depuis messages entrants — formats supportés :

```
"oui" / "yes" / "✅" / "ok" / "confirme"  → Approuvé
"non" / "no" / "❌" / "cancel" / "annule"  → Refusé
"approve:<approvalId>"                      → Résolution explicite par ID
Metadata { approvalResponse: { id, approved } }  → Boutons inline Telegram/Discord
```

### 6. 🔊 TTS ElevenLabs + Fallback Système

Chaîne de priorité dans `VoiceDaemon.speakWithBestTTS()` :

```
1. ElevenLabs API (ELEVENLABS_API_KEY / XI_API_KEY)
   → eleven_multilingual_v2, voix Adam par défaut
   → Audio MP3 → afplay (macOS) / mpg123/ffplay (Linux)

2. Fallback TTS système :
   → macOS  : say -v Thomas (voix française native)
   → Linux  : espeak-ng -v fr+m3
   → Windows: PowerShell SAPI
```

---

## Configuration minimale

### `.env` (copier depuis `.env.example`)

```env
# Obligatoire
ANTHROPIC_API_KEY=sk-ant-...
MISTRAL_API_KEY=votre_clé_mistral     # Pour le module vocal

# Domotique
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=votre_token_longue_durée

# Notifications autonomes
JARVIS_OWNER_ID=votre_id_telegram
JARVIS_NOTIFICATION_CHANNEL=telegram

# TTS (optionnel — voix naturelle)
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB  # Adam (défaut)
```

### `openclaw.json` — activer le module vocal

```json
{
  "autonomy": {
    "enabled": true,
    "ownerUserId": "votre_telegram_id",
    "notificationChannel": "telegram",
    "voice": {
      "enabled": true,
      "wakeWords": ["jarvis", "hey jarvis"],
      "captureDevice": ""
    }
  }
}
```

### Identifier votre microphone

```bash
# Linux
arecord -l

# macOS
ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep "audio"

# Test rapide (5 secondes)
bash skills/mistral-stt/scripts/test-transcribe.sh
```

---

## Démarrage

```bash
# Installer les dépendances
npm install

# Configurer
cp .env.example ~/.openclaw/.env
# Éditer ~/.openclaw/.env avec vos clés

# Démarrer Jarvis
npm start
# → Le module vocal démarre automatiquement si voice.enabled=true
# → "Je vous écoute, Monsieur."
```

---

## Exemples de commandes vocales

| Vous dites | Jarvis fait |
|------------|-------------|
| "Jarvis, allume la lumière du salon" | `domotic:light_on` → `light.salon` |
| "Jarvis, règle la température à 21 degrés" | `domotic:set_temp` → `climate.thermostat`, 21°C |
| "Jarvis, ferme les volets du salon" | `domotic:cover_close` → `cover.volet_salon` |
| "Jarvis, active la scène cinéma" | `domotic:scene_activate` → `scene.cinema` |
| "Jarvis, quel est l'état de la lumière" | `domotic:get_state` → retourne l'état + attributs |
| "Jarvis, envoie un message à Marie" | `message:send` → sendMessage() |

---

## Architecture de sécurité

- **EthicsGuard** : valide chaque action avant exécution (niveau `none` → `full`)
- **requestApproval()** : toute action sensible demande confirmation avec timeout configurable
- **DefaultJarvisBridge** : si bridge non configuré, simule sans exécuter (sécurité au démarrage)
- **Import dynamique** : évite les dépendances circulaires entre autonomie et outbound

---

## Ce qui reste à faire (optionnel)

| Tâche | Priorité | Complexité |
|-------|----------|-----------|
| Tests unitaires (decision-engine, voice module) | Haute | Faible |
| memory-lancedb | Basse | Mémoire vectorielle long-terme pour LearningEngine |
| jarvis-wake-word skill | Basse | Configuration Picovoice pour wake words avancés |
| Dashboard Jarvis (`skills/jarvis-dashboard`) | Basse | Élevée |
| Intégration Philips Hue native (skill openhue) | Basse | Faible |

---

*Rapport généré automatiquement — Jarvis 2.0 · OpenClaw · Mars 2026*
