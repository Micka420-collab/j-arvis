# Guide d'Utilisation - Intelligence Avancée Jarvis

Ce guide explique comment utiliser les modules d'intelligence avancée du système d'autonomie de Jarvis.

## 🚀 Démarrage Rapide

```typescript
import { AutonomySystem } from "@jarvis/autonomy";

// Initialiser le système
const autonomy = new AutonomySystem(config);

// Démarrer
await autonomy.initialize();
```

## 🧠 Modules d'Intelligence

### 1. Context Enricher

Enrichit le contexte pour des décisions plus intelligentes.

```typescript
import { ContextEnricher } from "@jarvis/autonomy/intelligence";

const enricher = new ContextEnricher();

const context = await enricher.enrichContext({
  userId: "user123",
  timestamp: new Date(),
});

console.log(context.weather);      // { condition: "clear", temp: 18 }
console.log(context.emotional);    // { mood: "focused", energy: 8 }
console.log(context.temporal);     // { timeOfDay: "morning", season: "spring" }
```

### 2. Predictive Engine

Prédit les besoins futurs de l'utilisateur.

```typescript
import { PredictiveEngine } from "@jarvis/autonomy/intelligence";

const predictor = new PredictiveEngine();

// Enregistrer des événements
predictor.recordEvent("make_coffee", 1, "morning", new Date());

// Prédire le prochain événement
const prediction = predictor.predictNext("make_coffee", 30);
console.log(prediction.confidence);  // 0.92
console.log(prediction.trend);       // "stable"
```

### 3. Reinforcement Learner

Apprend des retours utilisateur pour améliorer les suggestions.

```typescript
import { ReinforcementLearner } from "@jarvis/autonomy/intelligence";

const rl = new ReinforcementLearner({
  learningRate: 0.1,
  explorationRate: 0.3,
});

// Choisir une action
const action = rl.chooseAction("morning", [
  "suggest_coffee",
  "suggest_music",
  "suggest_focus"
]);

// Apprendre du feedback
rl.learn(rl.feedbackToReward("morning", action, "positive"));

// Voir les meilleures actions apprises
const best = rl.getBestActions("morning", 2);
```

### 4. Semantic Memory

Stocke et recherche des souvenirs sémantiques.

```typescript
import { SemanticMemory } from "@jarvis/autonomy/intelligence";

const memory = new SemanticMemory(1000, 384);

// Stocker un souvenir
await memory.store(
  "L'utilisateur aime le café le matin",
  "preference",
  0.9
);

// Recherche sémantique
const results = await memory.search("boisson matinale", 3);
// Retourne les souvenirs similaires avec score de pertinence
```

### 5. Multi-Modal Processor

Fusionne les entrées de différentes sources.

```typescript
import { MultiModalProcessor } from "@jarvis/autonomy/intelligence";

const processor = new MultiModalProcessor();

const context = await processor.process({
  text: "Allume la lumière",
  voice: { transcript: "Allume la lumière", emotion: "neutral" },
  sensors: { motion: true, light: 20, temperature: 21 },
});

console.log(context.dominatedBy);  // "text"
console.log(context.confidence);   // 0.95
```

## 🎯 Exemples d'Utilisation

### Suggestion Proactive Intelligente

```typescript
async function suggestProactively(userId: string) {
  // 1. Enrichir le contexte
  const context = await enricher.enrichContext({ userId });
  
  // 2. Prédire les besoins
  const prediction = predictor.predictNext("lights_on", 30);
  
  // 3. Consulter la mémoire
  const memories = await memory.search("préférences soir", 3);
  
  // 4. Décider avec RL
  const state = `${context.temporal.timeOfDay}_${context.emotional.energyLevel}`;
  const action = rl.chooseAction(state, actions);
  
  // 5. Exécuter si confiance suffisante
  if (prediction.confidence > 0.8) {
    return executeAction(action);
  }
}
```

### Apprentissage Continu

```typescript
async function learnFromInteraction(state: string, action: string) {
  // Observer le résultat
  const userFeedback = await observeUserReaction();
  
  // Convertir en reward
  const reward = rl.feedbackToReward(state, action, userFeedback);
  
  // Apprendre
  rl.learn(reward);
  
  // Stocker dans la mémoire si pertinent
  if (userFeedback === "positive") {
    await memory.store(
      `Action "${action}" appréciée en "${state}"`,
      "learning",
      0.8
    );
  }
}
```

### Personnalisation Contextuelle

```typescript
async function personalize(context: EnrichedContext) {
  // Rechercher des préférences similaires
  const relevant = await memory.search(
    `préférences ${context.temporal.timeOfDay}`,
    5
  );
  
  // Ajuster les suggestions
  return {
    musicGenre: relevant.find(r => r.entry.content.includes("musique"))?.genre,
    lightColor: context.weather?.condition === "rainy" ? "warm" : "cool",
    temperature: context.season === "winter" ? 22 : 20,
  };
}
```

## 📊 Monitoring

### Métriques de Performance

```typescript
// Statistiques RL
const rlStats = rl.getStats();
console.log(`Exploration: ${rlStats.explorationRate}`);
console.log(`Q-value moyenne: ${rlStats.averageQValue}`);

// Taux d'acceptation des suggestions
const acceptanceRate = calculateAcceptanceRate(history);
console.log(`Acceptation: ${acceptanceRate}%`);

// Précision prédictive
const predictionAccuracy = calculatePredictionAccuracy(predictions);
console.log(`Précision: ${predictionAccuracy}%`);
```

## ⚙️ Configuration

```typescript
const config: AutonomyConfig = {
  intelligence: {
    contextEnrichment: {
      enabled: true,
      includeWeather: true,
      includeEmotional: true,
    },
    prediction: {
      enabled: true,
      horizon: 60, // minutes
      minConfidence: 0.7,
    },
    reinforcementLearning: {
      enabled: true,
      learningRate: 0.1,
      initialExploration: 0.3,
    },
    semanticMemory: {
      enabled: true,
      maxSize: 10000,
      embeddingDim: 384,
    },
  },
};
```

## 🔧 Dépannage

### Problème: Suggestions non pertinentes

**Solution**: Augmenter la phase d'exploration RL

```typescript
const rl = new ReinforcementLearner({
  explorationRate: 0.5,  // Plus élevé
  explorationDecay: 0.99,
});
```

### Problème: Prédictions lentes

**Solution**: Utiliser le caching

```typescript
// Cache les prédictions fréquentes
const cache = new Map<string, Prediction>();

async function getPrediction(event: string) {
  const key = `${event}_${Date.now() / 60000}`; // 1 min cache
  if (cache.has(key)) return cache.get(key)!;
  
  const pred = predictor.predictNext(event, 30);
  cache.set(key, pred);
  return pred;
}
```

### Problème: Mémoire trop grande

**Solution**: Activer le nettoyage automatique

```typescript
const memory = new SemanticMemory(5000, 384); // Limite 5000

// Nettoyage périodique
setInterval(() => {
  memory.cleanup();
}, 86400000); // 1 jour
```

## 📚 Ressources

- [API Reference](./API_REFERENCE.md)
- [Architecture](./ARCHITECTURE.md)
- [Notebooks d'Analyse](../notebooks/autonomy-analysis.md)

## 🤝 Contribution

Pour ajouter de nouveaux modules d'intelligence:

1. Créer le fichier dans `src/autonomy/intelligence/`
2. Implémenter l'interface `IntelligenceModule`
3. Ajouter aux exports dans `index.ts`
4. Mettre à jour la documentation

---

*Version 2.0.0 - Mars 2026*
