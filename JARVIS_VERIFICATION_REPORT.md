# Rapport de Vérification — Intégration Jarvis dans OpenClaw
**Date :** 2026-03-03
**Version :** Jarvis 2.0 / OpenClaw-main

---

## ✅ Résumé : Tous les modules sont fonctionnels

| Module | Fichiers | Status |
|--------|----------|--------|
| 🎙️ Vocal (Mistral STT) | `src/voice/` (5 fichiers) | ✅ OK |
| 🏡 Home Assistant | `src/domotic/home-assistant-client.ts` | ✅ OK |
| 🔊 ElevenLabs TTS | Intégré dans `voice-daemon.ts` | ✅ OK |
| 🤖 Autonomie / Gateway | `src/autonomy/integration/gateway-integration.ts` | ✅ OK |
| 🧙 Wizard Installation | `src/wizard/onboarding.jarvis-config.ts` | ✅ OK (bug corrigé) |
| 📋 Skills CLI | `skills/mistral-stt/` | ✅ OK |

---

## Bugs Détectés et Corrigés

### 🔴 BUG CRITIQUE — Zod Schema Strict
**Problème :** `onboarding.jarvis-config.ts` écrivait un champ `autonomy` dans `nextConfig`
(type `OpenClawConfig`). Or le Zod schema d'OpenClaw se termine par `.strict()`, donc
`writeConfigFile()` rejetait la config avec une erreur de validation.

**Correction :** Suppression des deux blocs `nextConfig = { autonomy: { ... } }`.
Toutes les options Jarvis (wake words, niveau d'autonomie, owner ID...) sont désormais
stockées **uniquement** dans `~/.openclaw/.env`.

### 🟠 BUG MOYEN — ownerUserId jamais chargé depuis .env
**Problème :** `AutonomyGatewayIntegration` lisait `ownerUserId` depuis
`openClawConfig.ownerUserId` (champ inexistant) au lieu de `process.env.JARVIS_OWNER_ID`.

**Correction :** Le constructeur lit désormais en priorité :
- `process.env.JARVIS_OWNER_ID`
- `process.env.JARVIS_NOTIFICATION_CHANNEL`
- `process.env.JARVIS_AUTONOMY_LEVEL`
- `process.env.JARVIS_VOICE_ENABLED`
- `process.env.JARVIS_WAKE_WORDS`
- `process.env.JARVIS_MIC_DEVICE`

Toutes ces variables sont écrites par le wizard d'installation et chargées automatiquement
via `loadDotEnv()` → `~/.openclaw/.env` au démarrage d'OpenClaw.

---

## Architecture des Variables d'Environnement

```
~/.openclaw/.env (écrit par: openclaw onboard)
                 (chargé par: loadDotEnv() dans infra/dotenv.ts)

Module Vocal (Mistral STT)
├── MISTRAL_API_KEY          → mistral-stt-client.ts / voice-daemon.ts
├── MISTRAL_STT_MODEL        → mistral-stt-client.ts
├── MISTRAL_STT_LANGUAGE     → mistral-stt-client.ts
├── JARVIS_VOICE_ENABLED     → gateway-integration.ts (active le daemon)
├── JARVIS_WAKE_WORDS        → gateway-integration.ts (ex: "jarvis,hey jarvis")
└── JARVIS_MIC_DEVICE        → gateway-integration.ts → createVoiceDaemon

Home Assistant
├── HOME_ASSISTANT_URL       → home-assistant-client.ts
└── HOME_ASSISTANT_TOKEN     → home-assistant-client.ts

ElevenLabs TTS
├── ELEVENLABS_API_KEY       → voice-daemon.ts → speakWithBestTTS()
├── ELEVENLABS_VOICE_ID      → voice-daemon.ts (défaut: Adam)
└── ELEVENLABS_MODEL_ID      → voice-daemon.ts (défaut: eleven_multilingual_v2)

Autonomie Jarvis
├── JARVIS_OWNER_ID          → gateway-integration.ts → GatewayJarvisBridge
├── JARVIS_NOTIFICATION_CHANNEL → gateway-integration.ts (telegram/discord/...)
├── JARVIS_AUTONOMY_ENABLED  → gateway-integration.ts
└── JARVIS_AUTONOMY_LEVEL    → gateway-integration.ts (none/suggest/ask/act_with_notice/full)
```

---

## Flux d'Installation Vérifié

```
openclaw onboard
  │
  ├── requireRiskAcknowledgement
  ├── choix du flow (quickstart / advanced)
  ├── config gateway (port, bind, auth)
  ├── setup channels (Telegram, Discord, WhatsApp...)
  ├── writeConfigFile(nextConfig)          ← config de base sans Jarvis
  ├── setupSkills
  ├── setupInternalHooks
  │
  ├── ★ configureJarvisApis()             ← ÉTAPE JARVIS INJECTÉE
  │     ├── 🎙️  Mistral STT (clé + device + wake words → .env)
  │     ├── 🏡  Home Assistant (URL + token → .env)
  │     ├── 🔊  ElevenLabs TTS (clé + voice ID → .env)
  │     └── 🤖  Autonomie (owner ID + canal + niveau → .env)
  │
  ├── applyWizardMetadata
  ├── writeConfigFile(nextConfig)          ← config finale (sans champ autonomy)
  └── finalizeOnboardingWizard
```

**Position correcte :** `setupInternalHooks` (L.455) → `configureJarvisApis` (L.459) → `writeConfigFile` (L.469) ✅

---

## Vérification des Exports / Imports

### `src/voice/`
| Export | Fichier | Status |
|--------|---------|--------|
| `VoiceDaemon`, `createVoiceDaemon` | `voice-daemon.ts` | ✅ |
| `VoicePipeline` | `voice-pipeline.ts` | ✅ |
| `MistralSTTClient`, `createMistralSTTClient` | `mistral-stt-client.ts` | ✅ |
| `AudioCapture`, `detectAudioTool` | `audio-capture.ts` | ✅ |
| Tout re-exporté | `index.ts` | ✅ |

### `src/domotic/`
| Export | Fichier | Status |
|--------|---------|--------|
| `HomeAssistantClient` | `home-assistant-client.ts` | ✅ |
| `getHomeAssistantClient()` | `home-assistant-client.ts` | ✅ |
| `DomoticCommandParams`, `HACommandResult` | `home-assistant-client.ts` | ✅ |

### `src/autonomy/`
| Export | Fichier | Status |
|--------|---------|--------|
| `JarvisBridge`, `registerJarvisBridge` | `jarvis-bridge.ts` | ✅ |
| `AutonomyGatewayIntegration` | `integration/gateway-integration.ts` | ✅ |

### `src/wizard/`
| Export | Fichier | Status |
|--------|---------|--------|
| `configureJarvisApis()` | `onboarding.jarvis-config.ts` | ✅ |
| Importé via dynamic import | `onboarding.ts` | ✅ |

---

## Chaîne TTS Vérifiée

```
VoiceDaemon.speakWithBestTTS(text)
  │
  ├── ELEVENLABS_API_KEY présent ?
  │     YES → speakWithElevenLabs() → API ElevenLabs → MP3 → afplay/mpg123/ffplay
  │     NO  ↓
  └── speakWithSystemTTS()
        ├── macOS  → say -v Thomas -r 180 "..."
        ├── Linux  → espeak-ng -v fr+m3 -s 150 "..."
        └── Windows → PowerShell Add-Type + SpeechSynthesizer
```

---

## Commandes de Démarrage

```bash
# Installation complète avec wizard Jarvis
openclaw onboard

# Test du module vocal uniquement
bash skills/mistral-stt/scripts/test-transcribe.sh

# Lister les micros disponibles
bash skills/mistral-stt/scripts/list-devices.sh

# Démarrer le gateway (charge ~/.openclaw/.env automatiquement)
openclaw start
```

---

## Tâches Optionnelles Restantes

| Tâche | Priorité | Description |
|-------|----------|-------------|
| Tests unitaires | Moyenne | decision-engine, learning-engine, voice |
| memory-lancedb | Basse | Mémoire vectorielle long-terme pour LearningEngine |
| jarvis-wake-word skill | Basse | Configuration Picovoice pour wake words avancés |
| jarvis-dashboard | Basse | Interface visuelle optionnelle |
| openhue | Basse | Intégration native Philips Hue |

---

*Rapport généré automatiquement — Jarvis 2.0 Integration Verification*
