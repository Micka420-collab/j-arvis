# 🤖 Jarvis Autonomy - Intégration OpenClaw

## 🎯 Concept

**L'autonomie s'installe AUTOMATIQUEMENT avec OpenClaw.**

Pas de commande supplémentaire. Pas de configuration manuelle. 

Lorsque vous faites `pnpm install`, le système d'autonomie Jarvis se configure tout seul.

---

## 📦 Installation Unifiée

### Nouvelle Installation

```bash
git clone https://github.com/votre-repo/openclaw.git
cd openclaw
pnpm install    # ← OpenClaw + Autonomie en une commande
pnpm dev        # ← Démarre tout
```

### Mise à jour d'OpenClaw existant

```bash
cd openclaw
git pull origin main
pnpm install    # ← L'autonomie s'installe automatiquement
```

---

## ✨ Ce qui est automatique

### Pendant `pnpm install` :

- ✅ Création des dossiers (`config/`, `data/autonomy/`, `logs/`)
- ✅ Fichier `config/autonomy.json` avec paramètres optimaux
- ✅ Variables d'environnement dans `.env.local`
- ✅ Vérification des 8 modules d'intelligence
- ✅ Prêt à l'emploi immédiatement

### Au premier démarrage (`pnpm dev`) :

- ✅ Initialisation de la mémoire sémantique
- ✅ Chargement des modèles de prédiction
- ✅ Activation du mode proactif
- ✅ Dashboard disponible sur `/autonomy`

---

## 🚀 Commandes

### Démarrage
```bash
pnpm dev                    # OpenClaw + Autonomie (standard)
pnpm jarvis:start          # Avec messages de bienvenue
pnpm jarvis:start --tutorial # Avec tutoriel interactif
```

### Monitoring
```bash
pnpm jarvis:doctor         # Diagnostic complet
pnpm jarvis:logs           # Voir les logs
pnpm jarvis:stats          # Statistiques
```

### Configuration
```bash
pnpm jarvis:init           # Reconfiguration interactive
pnpm jarvis:reset          # Reset des données
```

---

## 🔌 Intégration Technique

### Architecture

```
OpenClaw Core
    ├── src/
    │   ├── gateway/          # Core OpenClaw
    │   ├── daemon/           # Core OpenClaw
    │   └── autonomy/         # 🆕 Système d'autonomie
    │       ├── intelligence/ # 8 modules d'IA
    │       └── ...
    ├── config/
    │   └── autonomy.json     # 🆕 Config auto-générée
    └── data/
        └── autonomy/         # 🆕 Données persistantes
```

### Flow d'installation

```
pnpm install
    ├── pnpm install (dépendances)
    ├── pnpm build
    └── pnpm postinstall
            └── node scripts/install-autonomy.js
                    ├── Créer config/autonomy.json
                    ├── Créer data/autonomy/
                    └── Configurer .env.local
```

---

## ⚙️ Personnalisation

### Désactiver l'installation automatique

```bash
export SKIP_AUTONOMY_SETUP=1
pnpm install
```

### Désactiver après installation

```bash
# Éditer config/autonomy.json
{
  "enabled": false
}
```

Ou temporairement :
```bash
AUTONOMY_ENABLED=false pnpm dev
```

---

## 🎓 Pour les Développeurs

### Structure des modules

```typescript
// Les 8 modules sont disponibles immédiatement
import { 
  ContextEnricher,
  PredictiveEngine,
  ReinforcementLearner,
  SemanticMemory,
  MultiModalProcessor,
  IntelligenceCoordinator,
  CausalReasoner,
  DigitalTwin
} from "@openclaw/autonomy/intelligence";
```

### Tests

```bash
# Tests autonomie uniquement
pnpm test:autonomy

# Tests avec couverture
pnpm test:autonomy:coverage

# Tests complets
pnpm test
```

---

## 📊 Résultat

Après `pnpm install`, vous avez :

| Composant | Statut |
|-----------|--------|
| OpenClaw Core | ✅ Installé |
| 8 Modules IA | ✅ Prêts |
| Configuration | ✅ Auto-générée |
| Base de données | ✅ Initialisée |
| Dashboard | ✅ Accessible |
| Mode proactif | ✅ Actif |

**Temps total : ~3 minutes** ⏱️

---

## 🆘 Support

### Problèmes courants

**L'autonomie ne s'est pas installée ?**
```bash
pnpm jarvis:init
```

**Réinstallation complète ?**
```bash
rm -rf node_modules data/autonomy config/autonomy.json
pnpm install
```

**Debug ?**
```bash
pnpm jarvis:doctor
```

---

## 🎉 Résumé

> **Une commande. Une installation. Un assistant intelligent.**
> 
> `pnpm install` = OpenClaw + Jarvis Autonomy

Pas de friction. Pas de configuration complexe. 
L'IA proactive est incluse d'office dans OpenClaw.

---

*Version: 2.1.0 - Intégration automatique*
