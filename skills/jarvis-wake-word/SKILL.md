---
name: jarvis-wake-word
description: Configuration du wake word "Jarvis" pour la commande vocale.
metadata: { "openclaw": { "emoji": "🎙️" } }
implementation: src/voice/wake-word-detector.ts
class: WakeWordDetector
---

# Wake Word "Jarvis" — Configuration Vocale

Configure Jarvis pour répondre au wake word **"Jarvis"** sur macOS, iOS et Android.

## Implémentation TypeScript

`src/voice/wake-word-detector.ts` — `WakeWordDetector`

### Deux modes disponibles

| Mode | Prérequis | Précision | Latence |
|------|-----------|-----------|---------|
| **Porcupine** (recommandé) | `@picovoice/porcupine-node` + clé API | Très haute | ~5 ms |
| **Fallback keyword** | Aucun | Bonne (post-STT) | dépend de Mistral STT |

### Démarrage rapide

```typescript
import { WakeWordDetector } from "./src/voice/wake-word-detector.js";

// Mode Porcupine (si clé API disponible)
const detector = await WakeWordDetector.create({
  keywords: ["jarvis", "hey jarvis"],
  picovoiceApiKey: process.env.PICOVOICE_API_KEY,
  sensitivity: 0.5,
});

detector.on("wake", (event) => {
  console.log(`Wake word: "${event.keyword}" via ${event.mode}`);
});

await detector.start();
```

### Mode fallback (vérification post-transcription)

```typescript
// Appeler après chaque transcription Mistral STT
const wakeEvent = detector.checkTranscription("Jarvis, allume les lumières");
if (wakeEvent) {
  // Traiter la commande...
}
```

### Variables d'environnement

```env
PICOVOICE_API_KEY=votre_clé_picovoice   # https://console.picovoice.ai/
JARVIS_WAKE_WORDS=jarvis,hey jarvis      # Mots déclencheurs (comma-separated)
JARVIS_MIC_DEVICE=default               # Index périphérique audio (-1 = défaut)
```

### Installation Picovoice (optionnel)

```bash
pnpm add @picovoice/porcupine-node @picovoice/pvrecorder-node
```

## Configuration

### Méthode 1 : Via openclaw.json

Ajoutez la configuration suivante dans `~/.openclaw/openclaw.json` :

```json5
{
  // Wake word configuration
  voiceWake: {
    enabled: true,
    wakeWord: "jarvis",
    // Sensibilité (0.0-1.0, plus haut = plus sensible mais plus de faux positifs)
    sensitivity: 0.5,
    // Langue pour la reconnaissance
    language: "fr-FR",
  },

  // Configuration TTS (Text-to-Speech) pour les réponses vocales
  voice: {
    enabled: true,
    // ElevenLabs pour une voix naturelle (recommandé)
    provider: "elevenlabs",
    // Voix style Jarvis : "Antoni" (ElevenLabs), "daniel" (système)
    voiceId: "Antoni",
    // Ou utiliser le TTS système
    // provider: "system",
    // voiceId: "Thomas", // Voix française macOS
    language: "fr-FR",
  },

  // Nom de l'assistant pour les interactions vocales
  agent: {
    name: "Jarvis",
    model: "anthropic/claude-opus-4-6",
  },
}
```

### Méthode 2 : Via la CLI

```bash
# Activer le wake word
jarvis config set voiceWake.enabled true
jarvis config set voiceWake.wakeWord "jarvis"
jarvis config set voiceWake.language "fr-FR"

# Configurer la voix de réponse
jarvis config set voice.enabled true
jarvis config set voice.provider "elevenlabs"
jarvis config set voice.language "fr-FR"

# Configurer le nom de l'agent
jarvis config set agent.name "Jarvis"
```

## Plateformes supportées

### macOS (Menu Bar App)

- **Voice Wake** : Le mot "Jarvis" déclenche l'écoute
- **Push-to-Talk** : Raccourci clavier configurable
- **Talk Mode** : Mode conversation continue

Configuration macOS :

```json5
{
  voiceWake: {
    enabled: true,
    wakeWord: "jarvis",
    // Commande exécutée quand le wake word est détecté
    command: 'jarvis agent --message "${text}" --thinking low',
  },
}
```

### iOS (Node)

- Wake word via le node iOS
- Canvas comme interface visuelle
- Fonctionne en arrière-plan

### Android (Node)

- Voice tab dans l'app Android
- Détection continue du wake word
- Réponse vocale native

## Configuration ElevenLabs (recommandé pour voix naturelle)

```env
ELEVENLABS_API_KEY=votre_clé_api
```

Voix recommandées pour un style Jarvis :

- **Antoni** — Voix masculine, professionnelle, calme
- **Daniel** — Voix avec accent britannique
- **Adam** — Voix grave et autoritaire

## Configuration voix système (gratuit)

```json5
{
  voice: {
    provider: "system",
    // macOS : Thomas (français), Daniel (anglais)
    // Lister les voix disponibles : say -v '?'
    voiceId: "Thomas",
  },
}
```

## Test rapide

```bash
# Tester la synthèse vocale
jarvis agent --message "Bonjour, je suis Jarvis, à votre service." --voice

# Tester le wake word (mode écoute)
jarvis voicewake --test
```

## Notes

- Le wake word fonctionne en local (pas de cloud pour la détection)
- La reconnaissance vocale après le wake word utilise le service configuré (Whisper, Deepgram, ou système)
- Sur macOS, accordez les permissions microphone dans Préférences Système → Confidentialité
- Sensibilité recommandée : 0.5 (équilibre entre détection et faux positifs)
