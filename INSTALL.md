# 🚀 Installation OpenClaw + Jarvis Autonomy

## Installation Rapide (Recommandée)

```bash
# 1. Cloner le repository
git clone https://github.com/votre-repo/openclaw.git
cd openclaw

# 2. Installer (OpenClaw + Autonomie en UNE SEULE commande)
pnpm install

# 3. C'est tout ! L'autonomie est déjà configurée
# Démarrez OpenClaw :
pnpm dev
```

**L'autonomie Jarvis s'installe et se configure AUTOMATIQUEMENT** pendant `pnpm install`.

---

## 🎯 Que se passe-t-il pendant l'installation ?

Quand vous tapez `pnpm install` :

```
✅ Dépendances OpenClaw installées
✅ Build effectué
🤖 Autonomie Jarvis configurée automatiquement :
   ✅ Dossiers créés (config/, data/autonomy/, logs/)
   ✅ Fichier config/autonomy.json créé
   ✅ Variables d'environnement ajoutées
   ✅ 8 modules d'intelligence vérifiés
✅ Tout est prêt !
```

---

## 🚀 Démarrage

### Option 1 : Démarrage Standard
```bash
pnpm dev
```
OpenClaw démarre avec l'autonomie activée en arrière-plan.

### Option 2 : Avec Tutoriel
```bash
pnpm jarvis:start --tutorial
```
Démarrage avec guide interactif pour découvrir les fonctionnalités.

### Option 3 : Dashboard uniquement
```bash
pnpm dev
# Puis ouvrir :
# http://localhost:3000/autonomy
```

---

## 🔧 Vérification

```bash
# Vérifier que tout est OK
pnpm jarvis:doctor

# Résultat attendu :
# ✅ Node.js version
# ✅ Structure src/autonomy
# ✅ 8 modules d'intelligence
# ✅ Configuration
# ✅ Variables d'environnement
# ✅ Dossier de données
# ✅ node_modules
# ✅ Build
# 
# 📊 Résultats : 9/9 ✅
```

---

## ⚙️ Configuration

### Modifier la configuration

```bash
# Éditer le fichier config/autonomy.json
nano config/autonomy.json
```

### Options principales

```json
{
  "enabled": true,                    // Activer/désactiver l'autonomie
  "proactivity": {
    "enabled": true,                  // Mode proactif
    "maxSuggestionsPerHour": 3,      // Limite de suggestions
    "requireConfirmation": false      // Demander confirmation
  },
  "learning": {
    "enabled": true,                  // Apprentissage activé
    "learningRate": 0.1               // Vitesse d'apprentissage
  }
}
```

### Désactiver temporairement

```bash
# Sans désinstaller
export AUTONOMY_ENABLED=false
pnpm dev
```

---

## 🆘 Dépannage

### Problème : L'autonomie ne s'est pas installée

```bash
# Forcer la reconfiguration
pnpm jarvis:init
```

### Problème : Erreurs de modules

```bash
# Réinstallation complète
rm -rf node_modules data/autonomy
pnpm install
```

### Problème : Reset total

```bash
# Tout réinitialiser
pnpm jarvis:reset
pnpm install
```

---

## 📚 Documentation

- **Guide autonomie** : `src/autonomy/README.md`
- **API référence** : `docs/autonomy/API.md`
- **Architecture** : `INTELLIGENCE_IMPLEMENTATION_SUMMARY.md`
- **Modules avancés** : `ADVANCED_MODULES_SUMMARY.md`

---

## 🎉 Résumé

| Étape | Commande | Temps |
|-------|----------|-------|
| Cloner | `git clone ...` | 10s |
| Installer | `pnpm install` | 2-3min |
| Démarrer | `pnpm dev` | 10s |
| **Total** | | **~3min** |

**L'autonomie Jarvis fait maintenant partie d'OpenClaw et s'installe automatiquement !** 🤖✨
