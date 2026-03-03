---
name: autonomy
description: Configuration et gestion du système d'autonomie de Jarvis - auto-apprentissage et prise de décision autonome avec interface de visualisation
homepage: https://github.com/openclaw/openclaw
tools:
  - name: autonomy_configure
    description: Configure le niveau d'autonomie de Jarvis
    parameters:
      level:
        type: string
        enum: ["none", "suggest", "ask", "act_with_notice", "full"]
        description: Niveau d'autonomie
  - name: autonomy_status
    description: Affiche le statut du système d'autonomie
  - name: autonomy_goals
    description: Liste les objectifs détectés et actifs
  - name: autonomy_patterns
    description: Affiche les patterns comportementaux appris
  - name: autonomy_feedback
    description: Donne un feedback sur une décision autonome
    parameters:
      decision_id:
        type: string
        description: ID de la décision
      feedback:
        type: string
        enum: ["positive", "negative", "corrected"]
      correction:
        type: string
        description: Correction optionnelle
  - name: autonomy_dashboard
    description: Ouvre le tableau de bord de visualisation
metadata:
  openclaw:
    emoji: 🧠
    category: core
---

# Autonomy Skill - Système d'Autonomie de Jarvis

Ce skill permet de configurer et de superviser le système d'auto-apprentissage et de prise de décision autonome de Jarvis.

## 🎯 Fonctionnalités

### Auto-apprentissage
- Détection des patterns comportementaux
- Apprentissage des préférences utilisateur
- Inférence des objectifs implicites

### Prise de Décision Autonome
- Analyse du contexte
- Évaluation des options
- Vérification éthique
- Exécution ou suggestion

### Interface de Visualisation
- Dashboard avec statistiques en temps réel
- Vue des patterns appris avec filtres
- Gestion des objectifs détectés
- Exploration du graphe de connaissances
- Historique des décisions avec feedback
- Timeline chronologique des événements

## 🧠 Niveaux d'Autonomie

| Niveau | Icône | Description |
|--------|-------|-------------|
| `none` | ❌ | Pas d'autonomie |
| `suggest` | 💡 | Suggère des actions |
| `ask` | ❓ | Demande confirmation |
| `act_with_notice` | ✅ | Agit et notifie |
| `full` | 🤖 | Autonomie complète |

## 🖥️ Interface de Visualisation

### Dashboard Principal (`autonomy-dashboard`)
```
┌─────────────────────────────────────────────┐
│  🧠 Système d'Autonomie                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  [Patterns] [Goals] [Knowledge] [Decisions] │
│  [Timeline]                                  │
│                                              │
│  📊 Statistiques:                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │  15  │ │   4  │ │   8  │ │  42  │       │
│  │Pat.  │ │Goals │ │Pref. │ │Nodes │       │
│  └──────┘ └──────┘ └──────┘ └──────┘       │
│                                              │
│  ⚙️ Configuration:                           │
│  [None] [Suggest] [Ask] [Act] [Full]        │
└─────────────────────────────────────────────┘
```

### Vue des Patterns (`autonomy-patterns-view`)
- Liste des patterns avec confiance et fréquence
- Filtres par niveau de confiance
- Recherche textuelle
- Indicateurs de tendance (📈 📉 ➡️)
- Actions: Modifier / Supprimer

### Vue des Objectifs (`autonomy-goals-view`)
- Cartes d'objectifs avec barre de progression
- Statuts: Actif / En pause / Complété
- Badges: Auto-détecté (🤖) vs Manuel (👤)
- Actions: Mettre à jour / Pause / Terminer

### Vue des Connaissances (`autonomy-knowledge-view`)
- Graphe de nœuds et relations
- Types: Préférences, Habitudes, Faits, Objectifs
- Filtres par type
- Mode Liste ou Graphe

### Vue des Décisions (`autonomy-decisions-view`)
- Historique chronologique
- Taux de succès visuel
- Feedback utilisateur (👍 / 👎)
- Filtres: Exécutées / En attente / Avec feedback

### Vue Timeline (`autonomy-timeline-view`)
- Chronologie visuelle
- Regroupement par date
- Types d'événements colorés
- Icônes contextuelles

## 📱 Commandes

### CLI
```bash
# Configuration
jarvis autonomy level suggest
jarvis autonomy status

# Visualisation
jarvis autonomy dashboard
jarvis autonomy patterns
jarvis autonomy goals

# Feedback
jarvis autonomy feedback positive
jarvis autonomy feedback negative "Correction..."
```

### Chat
```
"Jarvis, configure ton autonomie sur suggest"
"Jarvis, montre-moi les patterns que tu as appris"
"Jarvis, quels sont mes objectifs détectés ?"
"Jarvis, ouvre le dashboard d'autonomie"
"Jarvis, cette décision était bonne"
"Jarvis, non, la prochaine fois fais plutôt X"
```

## ⚙️ Configuration

```json
{
  "autonomy": {
    "enabled": true,
    "level": "suggest",
    "learningIntervalMinutes": 60,
    "decisionIntervalMinutes": 30,
    "maxDecisionsPerDay": 20,
    "requireApprovalFor": [
      "high_impact",
      "irreversible",
      "financial"
    ],
    "observationScope": {
      "commands": true,
      "schedules": true,
      "feedback": true
    },
    "maxFinancialImpact": 50,
    "strictEthicsMode": false,
    "notifyUserOnDecisions": true
  }
}
```

## 🔒 Sécurité

- **Anonymisation** des données utilisateur
- **Consentement** explicite pour actions sensibles
- **Contrôle utilisateur** total sur le niveau d'autonomie
- **Traçabilité** de toutes les décisions
- **Garde-fous** pour actions à risque

## 📁 Structure des Fichiers

```
src/autonomy/
├── types.ts
├── learning/
│   ├── learning-engine.ts
│   ├── pattern-detector.ts
│   └── knowledge-graph.ts
├── decision/
│   ├── decision-engine.ts
│   ├── goal-manager.ts
│   ├── ethics-guard.ts
│   └── action-planner.ts
├── observation/
│   └── behavior-observer.ts
├── integration/
│   ├── autonomy-service.ts
│   └── gateway-integration.ts
└── README.md

ui/src/ui/autonomy/
├── types.ts
├── autonomy-dashboard.ts       # Dashboard principal
├── patterns-view.ts            # Vue patterns
├── goals-view.ts               # Vue objectifs
├── knowledge-view.ts           # Vue connaissances
├── decisions-view.ts           # Vue décisions
├── timeline-view.ts            # Vue timeline
├── index.ts
└── demo.html
```

## 🎨 Personnalisation de l'UI

Les composants utilisent des CSS Custom Properties pour la personnalisation:

```css
autonomy-dashboard {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #4ade80;
  --warning-color: #fbbf24;
  --error-color: #f87171;
  --border-radius: 12px;
}
```

## 🔧 API JavaScript

```typescript
import { AutonomyGatewayIntegration } from "./autonomy/index.js";

const autonomy = new AutonomyGatewayIntegration(config);

// Démarrer
await autonomy.initialize();

// Traiter une interaction
await autonomy.processInteraction(userId, command, params, channel);

// Obtenir le statut
const stats = autonomy.getLearningStats();

// Déclencher une décision
const result = await autonomy.triggerAutonomousDecision(context);
```

## 📊 Exemples de Scénarios

**Scénario 1 - Allumage automatique:**
```
[Après 7 jours d'observation à 19h]
Dashboard: Pattern "Allumage lumières" détecté
Confiance: 92% | Fréquence: 28x
Jarvis: 💡 Souhaitez-vous que j'allume les lumières ?
```

**Scénario 2 - Correction:**
```
Dashboard: Feedback négatif sur décision
Pattern ajusté: Confiance réduite de 15%
Jarvis: 📝 Noté. Je demanderai la prochaine fois.
```

**Scénario 3 - Objectif détecté:**
```
Dashboard: Nouvel objectif "Productivité"
Source: Patterns de travail détectés
Jarvis: 🎯 Puis-je activer le mode "Ne pas déranger" ?
```

## 🚀 Roadmap

- [x] Moteur d'apprentissage
- [x] Moteur de décision
- [x] Interface de visualisation
- [ ] Visualisation graphe interactive (D3.js)
- [ ] Export/import des données
- [ ] Apprentissage fédéré
- [ ] Prédiction long terme

---

**Note**: Ce système est conçu pour respecter l'autonomie humaine. Jarvis ne remplace jamais la décision finale de l'utilisateur.
