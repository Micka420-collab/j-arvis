# 🤖 Jarvis Autonomy System

Système d'autonomie intelligente pour OpenClaw - Un assistant IA proactif et autonome.

## 🌟 Vue d'Ensemble

Le système d'autonomie de Jarvis ajoute des capacités d'intelligence artificielle avancée à OpenClaw :

- **🧠 Intelligence Proactive** : Anticipe vos besoins avant que vous ne les exprimiez
- **🎓 Apprentissage Continu** : S'améliore avec chaque interaction
- **🔮 Prédiction Comportementale** : Comprend vos habitudes et routines
- **🔗 Raisonnement Causal** : Analyse les causes et effets de vos comportements
- **🏭 Simulation** : Teste des scénarios avant d'agir

## 🚀 Installation

### Prérequis

- Node.js ≥ 22
- pnpm (recommandé) ou npm
- Git

### Installation Rapide

```bash
# Cloner le repository
git clone https://github.com/votre-repo/openclaw.git
cd openclaw

# Installer les dépendances
pnpm install

# Configuration initiale
pnpm run setup:autonomy

# Démarrer le système
pnpm run dev:autonomy
```

### Installation Guidée

```bash
# 1. Configuration interactive
pnpm jarvis:init

# 2. Vérification du système
pnpm jarvis:doctor

# 3. Premier démarrage avec tutoriel
pnpm jarvis:start --tutorial
```

## 📁 Structure

```
src/autonomy/
├── core/                    # Cœur du système
│   ├── learning/           # Apprentissage automatique
│   ├── decision/           # Moteur de décision
│   ├── observation/        # Couche d'observation
│   └── ethics/             # Garde-fous éthiques
├── intelligence/           # Modules d'IA avancés ⭐
│   ├── context-enricher.ts      # Enrichissement contextuel
│   ├── predictive-engine.ts     # Prédiction comportementale
│   ├── reinforcement-learner.ts # Apprentissage par renforcement
│   ├── semantic-memory.ts       # Mémoire sémantique
│   ├── multi-modal-processor.ts # Fusion multi-modale
│   ├── intelligence-coordinator.ts # Orchestrateur central
│   ├── causal-reasoner.ts       # Raisonnement causal
│   ├── digital-twin.ts          # Simulation de scénarios
│   └── __tests__/               # Tests complets
├── ui/                     # Interface utilisateur
│   ├── dashboard/         # Tableau de bord
│   ├── components/        # Composants React
│   └── hooks/             # Hooks personnalisés
├── bridge/                 # Pont avec OpenClaw
├── types.ts               # Types TypeScript
└── index.ts               # Exports publics
```

## 🎯 Utilisation

### Démarrage Basique

```typescript
import { AutonomySystem } from "@openclaw/autonomy";

// Initialiser
const autonomy = new AutonomySystem(config);

// Démarrer
await autonomy.initialize();

// Activer le mode autonome
autonomy.enableProactiveMode();
```

### Utilisation Avancée (Tous les Modules)

```typescript
import { 
  IntelligenceCoordinator,
  CausalReasoner,
  DigitalTwin,
  ContextEnricher,
  PredictiveEngine,
  ReinforcementLearner,
  SemanticMemory,
  MultiModalProcessor
} from "@openclaw/autonomy/intelligence";

// Initialiser tous les modules
const modules = {
  contextEnricher: new ContextEnricher(),
  predictiveEngine: new PredictiveEngine(),
  reinforcementLearner: new ReinforcementLearner(),
  semanticMemory: new SemanticMemory(1000, 384),
  multiModalProcessor: new MultiModalProcessor(),
};

// Modules avancés
const coordinator = new IntelligenceCoordinator(modules);
const causal = new CausalReasoner();
const twin = new DigitalTwin(causal, modules.predictiveEngine);

// Workflow complet
twin.syncState(currentState);
const scenario = twin.createScenario("Test", "Description", actions, 120);
const simulation = await twin.runSimulation(scenario.id);

if (simulation.outcomes.userSatisfaction > 0.8) {
  const decision = await coordinator.coordinate({
    userId: "user123",
    timestamp: new Date(),
  });
  
  if (decision.confidence > 0.75) {
    await execute(decision.decision);
  }
}
```

## 🛠️ Commandes CLI

| Commande | Description |
|----------|-------------|
| `pnpm jarvis:start` | Démarrer le système |
| `pnpm jarvis:init` | Configuration initiale |
| `pnpm jarvis:doctor` | Diagnostic système |
| `pnpm jarvis:reset` | Réinitialiser les données |
| `pnpm jarvis:export` | Exporter les données |
| `pnpm jarvis:import` | Importer des données |
| `pnpm jarvis:logs` | Voir les logs |
| `pnpm jarvis:stats` | Statistiques système |

## 📊 Dashboard

Accédez au tableau de bord d'autonomie :

```bash
# Démarrer le dashboard
pnpm jarvis:dashboard

# Ou via l'URL
http://localhost:3000/autonomy
```

### Fonctionnalités du Dashboard

- 📈 **Métriques en temps réel** : Performance, apprentissage, décisions
- 🧠 **Visualisation du graphe causal** : Relations cause-effet
- 🏭 **Simulateur** : Testez des scénarios
- 📚 **Mémoire sémantique** : Explorez les souvenirs
- 🎯 **Suggestions** : Actions recommandées

## ⚙️ Configuration

### Configuration de Base

```typescript
// config/autonomy.ts
export const autonomyConfig = {
  enabled: true,
  
  learning: {
    enabled: true,
    learningRate: 0.1,
    feedbackThreshold: 0.5,
  },
  
  prediction: {
    enabled: true,
    horizon: 60, // minutes
    minConfidence: 0.7,
  },
  
  proactivity: {
    maxSuggestionsPerHour: 3,
    suggestionDelay: 300, // ms
    requireConfirmation: false,
  },
  
  coordination: {
    contextWeight: 0.25,
    predictionWeight: 0.25,
    rlWeight: 0.3,
    memoryWeight: 0.2,
    autonomyThreshold: 0.75,
  },
};
```

### Variables d'Environnement

```bash
# .env.local
AUTONOMY_ENABLED=true
AUTONOMY_LEARNING_ENABLED=true
AUTONOMY_PROACTIVE_MODE=true
AUTONOMY_LOG_LEVEL=info
AUTONOMY_DATA_PATH=./data/autonomy
```

## 🧪 Tests

```bash
# Tests unitaires
pnpm test:autonomy

# Tests avec couverture
pnpm test:autonomy:coverage

# Tests e2e
pnpm test:autonomy:e2e

# Tests spécifiques
pnpm test src/autonomy/intelligence/__tests__/
```

## 📈 Monitoring

### Métriques Clés

```bash
# Voir les statistiques
pnpm jarvis:stats

# Exporter les métriques
pnpm jarvis:export:metrics
```

### Logs

```bash
# Logs en temps réel
pnpm jarvis:logs --follow

# Logs spécifiques
pnpm jarvis:logs --module intelligence
pnpm jarvis:logs --level error
```

## 🔒 Sécurité & Éthique

Le système d'autonomie inclut plusieurs garde-fous :

- **Confirmation utilisateur** pour les actions importantes
- **Limite de suggestions** (3/heure par défaut)
- **Désactivation rapide** (`pnpm jarvis:stop`)
- **Transparence** : Explications de chaque décision
- **Contrôle utilisateur** : Mode manuel/auto/hybride

## 🐛 Dépannage

### Problèmes Courants

```bash
# Réinitialiser le système
pnpm jarvis:reset

# Vérifier l'installation
pnpm jarvis:doctor

# Nettoyer le cache
pnpm jarvis:clean

# Mode debug
pnpm jarvis:start --debug
```

### Support

- 📖 Documentation : `/docs/autonomy`
- 🐛 Issues : GitHub Issues
- 💬 Discussions : GitHub Discussions

## 📝 Changelog

### v2.1.0 (2026-03-03)
- ✅ IntelligenceCoordinator : Orchestration centralisée
- ✅ CausalReasoner : Raisonnement causal avancé
- ✅ DigitalTwin : Simulation de scénarios
- ✅ Tests 100% couverture
- ✅ Documentation complète

### v2.0.0 (2026-03-01)
- ✅ Modules d'intelligence de base
- ✅ UI Dashboard React
- ✅ Intégration OpenClaw

## 🤝 Contribution

Voir `CONTRIBUTING.md` pour les guidelines de contribution.

## 📄 License

MIT License - voir `LICENSE` pour les détails.

---

**Fait avec ❤️ pour rendre l'IA plus utile et proactive.**
