---
name: mistral-stt
description: Transcription vocale locale via l'API Mistral STT — microphones à domicile connectés en direct.
homepage: https://docs.mistral.ai/capabilities/audio/
metadata:
  {
    "openclaw":
      {
        "emoji": "🎙️",
        "requires":
          {
            "env": ["MISTRAL_API_KEY"],
            "bins": ["sox"],
          },
        "primaryEnv": "MISTRAL_API_KEY",
        "install":
          [
            {
              "id": "sox-brew",
              "kind": "brew",
              "formula": "sox",
              "bins": ["sox"],
              "label": "Install sox — capture audio (macOS)",
            },
            {
              "id": "sox-apt",
              "kind": "shell",
              "command": "sudo apt install -y sox",
              "label": "Install sox — capture audio (Linux/Debian)",
            },
          ],
      },
  }
---

# Mistral STT — Module Vocal Jarvis

Connecte vos **microphones à domicile** directement à l'API **Mistral Speech-to-Text** pour transformer Jarvis en assistant vocal Iron Man style — déclenché par le wake word **"Jarvis"**, transcription via Mistral, réponse vocale TTS.

```
🎙️ Micro → [sox VAD] → [Mistral STT] → [Agent Jarvis] → [TTS] → 🔊 Haut-parleur
```

## Prérequis

| Outil | Rôle | Installation |
|-------|------|-------------|
| `sox` | Capture audio + détection de silence | `brew install sox` / `apt install sox` |
| Clé API Mistral | Transcription vocale | [console.mistral.ai](https://console.mistral.ai) |
| `espeak-ng` (Linux) | TTS système | `apt install espeak-ng` |

## Configuration rapide

### 1. Clé API Mistral

```bash
# Dans ~/.openclaw/.env
MISTRAL_API_KEY=votre_clé_api_mistral

# Optionnel — personnalisation
MISTRAL_STT_MODEL=mistral-stt          # Modèle STT
MISTRAL_STT_LANGUAGE=fr                # Langue principale
JARVIS_OWNER_ID=votre_telegram_id      # Pour les notifications
JARVIS_NOTIFICATION_CHANNEL=telegram   # Canal de réponse
```

### 2. Activer le module vocal dans openclaw.json

```json5
{
  // Module vocal
  voice: {
    enabled: true,
    mode: "wake_word",          // "wake_word" | "push_to_talk" | "always_on"
    wakeWords: ["jarvis", "hey jarvis"],
    language: "fr",

    // STT — Mistral
    stt: {
      provider: "mistral",
      model: "mistral-stt",
      language: "fr",
    },

    // Capture micro
    capture: {
      // device: "hw:1,0",      // Laisser vide = micro par défaut
      sampleRate: 16000,
      silenceThresholdDb: -35,  // Sensibilité VAD (ajuster si besoin)
      silenceDurationSec: 1.5,  // Temps de silence avant envoi
      maxDurationSec: 30,       // Durée max d'une commande
    },

    // TTS système (réponse vocale)
    tts: {
      enabled: true,
      // macOS : "Thomas" (français) | "Daniel" (anglais)
      // Linux : "fr+m3" | "en+m3"
      voice: "Thomas",
    },
  },

  // Wake word déjà configuré par le skill jarvis-wake-word
  voiceWake: {
    enabled: true,
    wakeWord: "jarvis",
    language: "fr-FR",
  },
}
```

### 3. Tester la transcription

```bash
# Test rapide — enregistre 5 secondes et transcrit
{baseDir}/scripts/test-transcribe.sh

# Test avec un fichier audio existant
{baseDir}/scripts/transcribe.sh /chemin/vers/audio.wav

# Lister les micros disponibles
{baseDir}/scripts/list-devices.sh

# Test capture micro seule (sans API)
sox -d -r 16000 -c 1 /tmp/test.wav silence 1 0.1 35d 1 1.5 35d
```

## Micros à domicile — Configuration avancée

### Identifier votre microphone

```bash
# Linux — lister les cartes audio ALSA
arecord -l

# Exemple de sortie :
# **** List of CAPTURE Hardware Devices ****
# card 0: PCH [HDA Intel PCH], device 0: ALC256 Analog [ALC256 Analog]
# card 1: USB [USB Audio Device], device 0: USB Audio [USB Audio]
#   → Micro USB = "hw:1,0"

# macOS — lister les devices
ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -i audio
```

### Configurer le bon micro

```json5
{
  voice: {
    capture: {
      // Linux ALSA — micro USB sur card 1
      device: "hw:1,0",
      // Ou via nom du device
      // device: "plughw:USB,0",

      // macOS — CoreAudio index
      // device: ":1",
    }
  }
}
```

### Micro réseau (Raspberry Pi, NAS, caméra IP)

Pour utiliser un micro distant sur votre réseau local, exposez-le via `PulseAudio` ou `GStreamer` :

```bash
# Sur le Raspberry Pi (serveur micro)
pactl load-module module-native-protocol-tcp auth-anonymous=1

# Sur la machine Jarvis (client)
PULSE_SERVER=tcp:192.168.1.100:4713 sox -t pulseaudio default -r 16000 -c 1 out.wav
```

## Commandes vocales disponibles

Une fois activé, Jarvis répond à toutes les commandes de l'agent. Exemples :

| Commande vocale | Action |
|----------------|--------|
| "Jarvis, allume la lumière du salon" | Commande Home Assistant |
| "Jarvis, quel temps fait-il ?" | Requête météo |
| "Jarvis, mets un rappel dans 30 minutes" | Création d'alarme |
| "Jarvis, joue de la musique" | Contrôle Sonos/Spotify |
| "Jarvis, quel est mon agenda aujourd'hui ?" | Lecture calendrier |
| "Jarvis, sécurise la maison" | Activation alarme |
| "Jarvis, baisse le thermostat à 19 degrés" | Commande chauffage |

## Architecture technique

```
┌──────────────────────────────────────────────────────────┐
│                    VoiceDaemon                           │
│                                                          │
│  ┌──────────────┐    ┌────────────────┐                 │
│  │ AudioCapture │    │  VoicePipeline │                 │
│  │              │    │                │                 │
│  │ sox (VAD)    │───▶│ Wake word      │                 │
│  │ arecord      │    │ detection      │                 │
│  │ ffmpeg       │    │                │                 │
│  └──────────────┘    └───────┬────────┘                 │
│                              │                          │
│                    ┌─────────▼────────┐                 │
│                    │  Mistral STT     │                 │
│                    │  mistral-stt     │                 │
│                    │  (API cloud)     │                 │
│                    └─────────┬────────┘                 │
│                              │                          │
│                    ┌─────────▼────────┐                 │
│                    │  Agent Jarvis    │                 │
│                    │  (gateway)       │                 │
│                    └─────────┬────────┘                 │
│                              │                          │
│                    ┌─────────▼────────┐                 │
│                    │  TTS             │                 │
│                    │  say/espeak-ng   │                 │
│                    │  ElevenLabs      │                 │
│                    └──────────────────┘                 │
└──────────────────────────────────────────────────────────┘
```

## Modèles Mistral STT

| Modèle | Langues | Latence | Recommandé pour |
|--------|---------|---------|----------------|
| `mistral-stt` | FR, EN, ES, DE, IT... | ~1-2s | Commandes vocales courtes |
| `voix-latest` | FR optimisé | ~1s | Usage exclusivement français |

## TTS avancé — ElevenLabs (voix naturelle)

Pour une voix plus naturelle type Jarvis :

```env
ELEVENLABS_API_KEY=votre_clé
```

```json5
{
  voice: {
    tts: {
      provider: "elevenlabs",
      voiceId: "Antoni",        // Voix masculine, calme
      model: "eleven_multilingual_v2",
      language: "fr",
    }
  }
}
```

## Dépannage

**Micro non détecté :**
```bash
# Tester l'enregistrement direct
sox -d /tmp/test.wav trim 0 3
aplay /tmp/test.wav
```

**Transcription vide :**
- Vérifier le niveau du micro : `sox -d -n stats 2>&1` (regarder "RMS lev dB")
- Ajuster `silenceThresholdDb` (augmenter vers -20 si trop sensible)
- Vérifier que le fichier WAV n'est pas vide : `soxi /tmp/capture.wav`

**API Mistral 401 :**
```bash
curl https://api.mistral.ai/v1/models -H "Authorization: Bearer $MISTRAL_API_KEY"
```

**Sox VAD trop agressif (coupe la voix) :**
```json5
{ "capture": { "silenceThresholdDb": -45, "silenceDurationSec": 2.0 } }
```

## Notes

- La clé API Mistral ne stocke pas les enregistrements audio
- Les fichiers WAV sont supprimés après transcription
- Les heures de silence (22h-7h) désactivent les notifications proactives mais pas la capture vocale
- Pour tester sans API : installez `whisper` local comme fallback (skill `openai-whisper`)
