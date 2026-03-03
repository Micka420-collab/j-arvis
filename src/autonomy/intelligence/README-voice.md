# 🎙️ Reconnaissance Vocale (Voice ID)

Ce module permet à Jarvis de reconnaître qui parle, de mémoriser les voix et d'associer chaque voix à un profil utilisateur.

## 🎯 Capacités

- ✅ **Reconnaissance en temps réel** - Identifie qui parle pendant une conversation
- ✅ **Apprentissage few-shot** - Enregistre une voix avec seulement 3 échantillons
- ✅ **Mémorisation persistante** - Les voix ne sont jamais oubliées (stockage sémantique)
- ✅ **Distinction multiples locuteurs** - Reconnaît qui parle dans un groupe
- ✅ **Amélioration continue** - Plus Jarvis entend une voix, plus il la reconnaît bien
- ✅ **Intégration autonomie** - Fonctionne avec tous les autres modules

## 🚀 Utilisation Rapide

### 1. Enregistrer une voix

```typescript
import { VoiceIdentifier, SemanticMemory } from "@openclaw/autonomy/intelligence";

const memory = new SemanticMemory(1000, 384);
const voiceId = new VoiceIdentifier(memory);

// Enregistrer "Mick" avec 3 échantillons
const profile = await voiceId.enrollVoice(
  "Mick",                                    // Nom
  [audioSample1, audioSample2, audioSample3], // Échantillons audio
  "user_mick_123",                          // ID utilisateur lié
  { gender: "male", language: "fr" }         // Métadonnées
);

console.log(`Profil créé: ${profile.name}`);
console.log(`Confiance: ${(profile.confidence * 100).toFixed(0)}%`);
```

### 2. Reconnaître pendant une conversation

```typescript
// Pendant une conversation
const audioData = new Float32Array(/* buffer microphone */);
const transcript = "Jarvis, allume les lumières";

const result = await voiceId.identifySpeaker(audioData, transcript);

if (result.isKnown) {
  console.log(`Reconnu: ${result.name} (${(result.confidence * 100).toFixed(0)}%)`);
  
  // Apprendre de cette interaction
  await voiceId.learnFromInteraction(
    result.profileId,
    audioData,
    transcript,
    "neutral",
    "salon"
  );
} else {
  console.log(`Nouvelle voix détectée: ${result.name}`);
}
```

### 3. Intégration avec l'autonomie complète

```typescript
import { 
  VoiceIdentifier,
  IntelligenceCoordinator,
  ContextEnricher,
  // ... autres modules
} from "@openclaw/autonomy/intelligence";

// Initialiser tous les modules
const voiceId = new VoiceIdentifier(memory);
const coordinator = new IntelligenceCoordinator({ /* modules */ });

// Enregistrer les voix de la famille
await voiceId.enrollVoice("Papa", samples1, "user_papa");
await voiceId.enrollVoice("Maman", samples2, "user_maman");

// Dans la boucle principale
const audioData = getMicrophoneData();
const transcript = getTranscript();

// 1. Identifier qui parle
const voiceResult = await voiceId.identifySpeaker(audioData, transcript);

// 2. Prendre une décision contextuelle
const decision = await coordinator.coordinate({
  userId: voiceResult.profileId,
  timestamp: new Date(),
  multimodalInput: {
    text: transcript,
    voice: {
      transcript,
      emotion: "neutral",
      confidence: voiceResult.confidence,
      speaker: voiceResult.name,  // 🎙️ Nom du locuteur identifié
    },
  },
});

console.log(`${voiceResult.name} demande: ${transcript}`);
console.log(`Action: ${decision.decision.selectedAction?.description}`);
```

## 📊 Caractéristiques Techniques

### Extraction de Features

Le système extrait :
- **MFCC** (Mel-Frequency Cepstral Coefficients) - 13 coefficients
- **Pitch** (hauteur de voix) - moyenne, écart-type, min, max
- **Formants** (résonances vocales) - F1, F2
- **Énergie** - volume moyen et variance
- **ZCR** (Zero Crossing Rate) - texture du son
- **Features spectrales** - centroid, rolloff, flux
- **Tempo** - mots par minute, pauses

### Similarité

Utilise la **similarité cosinus** entre embeddings :
```
score = cosinus(embedding_voix, embedding_profil)

score > 0.7  → Reconnu avec confiance
score 0.3-0.7 → Demander confirmation
score < 0.3  → Nouveau profil
```

### Apprentissage

- **Initial** : Enregistrement avec 3 échantillons → confiance ~50%
- **Continu** : Chaque interaction améliore le profil
- **Convergence** : Après ~20 interactions → confiance >95%

## 🔧 Configuration

```typescript
const voiceId = new VoiceIdentifier(memory, {
  recognitionThreshold: 0.7,      // Seuil de reconnaissance (0-1)
  newProfileThreshold: 0.3,       // Seuil nouvelle voix (0-1)
  minSamplesForReliability: 3,    // Échantillons minimum fiable
  embeddingSize: 128,             // Taille vecteur embedding
  minSampleDuration: 2.0,         // Durée min (secondes)
  maxSampleDuration: 30.0,        // Durée max (secondes)
});
```

## 🎭 Exemples Complets

Voir `example-voice-recognition.ts` pour :
- Enregistrement de voix
- Reconnaissance en temps réel
- Intégration autonomie
- Apprentissage continu
- Gestion des erreurs

```bash
# Lancer la démo
pnpm tsx src/autonomy/intelligence/example-voice-recognition.ts
```

## 📝 API Référence

### Méthodes Principales

| Méthode | Description |
|---------|-------------|
| `enrollVoice()` | Enregistrer une nouvelle voix |
| `identifySpeaker()` | Identifier qui parle |
| `learnFromInteraction()` | Apprendre d'une interaction |
| `verifySameSpeaker()` | Vérifier si deux échantillons sont la même personne |
| `updateProfileName()` | Renommer un profil |
| `linkProfileToUser()` | Lier profil vocal à utilisateur |
| `mergeProfiles()` | Fusionner deux profils (même personne) |
| `deleteProfile()` | Supprimer un profil |

### Interfaces

```typescript
interface VoiceProfile {
  id: string;
  name: string;
  userId?: string;
  embedding: number[];
  samples: number;
  confidence: number;
  metadata: {
    gender?: "male" | "female";
    language?: string;
    age?: number;
  };
  history: VoiceInteraction[];
}

interface VoiceIdentificationResult {
  profileId: string | null;
  name: string | null;
  confidence: number;
  isKnown: boolean;
  alternatives: Array<{ profileId: string; name: string; score: number }>;
}
```

## 🔗 Intégration Web Audio API

Pour une vraie implémentation audio dans le navigateur :

```typescript
// Capture microphone
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);

// Analyser
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
source.connect(analyser);

// Buffer
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Float32Array(bufferLength);

// Lecture
function getAudioData(): Float32Array {
  analyser.getFloatTimeDomainData(dataArray);
  return dataArray;
}
```

## 🎉 Résumé

Le système de reconnaissance vocale permet à Jarvis de :
- 🎙️ **Reconnaître** qui parle en temps réel
- 🧠 **Mémoriser** indéfiniment chaque voix
- 📈 **S'améliorer** avec chaque interaction
- 🔗 **S'intégrer** parfaitement avec l'autonomie

**Jarvis n'oubliera jamais votre voix !** 🤖🎙️
