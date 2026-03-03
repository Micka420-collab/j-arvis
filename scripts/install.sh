#!/bin/bash
#
# Script d'installation unifié OpenClaw + Jarvis Autonomy
# Ce script s'exécute automatiquement lors de l'installation
#

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Header
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║              🚀 OPENCLAW + JARVIS INSTALLER                    ║"
echo "║           Installation unifiée avec Autonomie                  ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Vérification des prérequis
log_info "Vérification des prérequis..."

# Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js n'est pas installé"
    echo "   → Installez Node.js 22+ : https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    log_error "Node.js 22+ requis (version actuelle: $(node --version))"
    exit 1
fi
log_success "Node.js $(node --version)"

# pnpm
if ! command -v pnpm &> /dev/null; then
    log_warning "pnpm n'est pas installé"
    echo "   → Installation de pnpm..."
    npm install -g pnpm
fi
log_success "pnpm $(pnpm --version)"

# Git
if ! command -v git &> /dev/null; then
    log_error "Git n'est pas installé"
    exit 1
fi
log_success "Git $(git --version | cut -d' ' -f3)"

echo ""

# Installation des dépendances
log_info "Installation des dépendances OpenClaw..."
pnpm install
log_success "Dépendances installées"

echo ""

# Build
log_info "Compilation d'OpenClaw..."
pnpm build
log_success "Compilation terminée"

echo ""

# 🆕 INSTALLATION AUTOMATIQUE DE L'AUTONOMIE
log_info "Installation du système d'autonomie Jarvis..."
echo ""

# Créer les dossiers nécessaires
mkdir -p config
mkdir -p data/autonomy

# Configuration par défaut de l'autonomie
cat > config/autonomy.json <<EOF
{
  "enabled": true,
  "learning": {
    "enabled": true,
    "learningRate": 0.1,
    "feedbackThreshold": 0.5
  },
  "prediction": {
    "enabled": true,
    "horizon": 60,
    "minConfidence": 0.7
  },
  "proactivity": {
    "enabled": true,
    "maxSuggestionsPerHour": 3,
    "suggestionDelay": 300,
    "requireConfirmation": false
  },
  "coordination": {
    "contextWeight": 0.25,
    "predictionWeight": 0.25,
    "rlWeight": 0.3,
    "memoryWeight": 0.2,
    "autonomyThreshold": 0.75,
    "maxSuggestions": 3,
    "explainableMode": true
  },
  "causal": {
    "minConfidenceThreshold": 0.6,
    "maxEvents": 10000
  },
  "memory": {
    "maxSize": 10000,
    "embeddingDim": 384,
    "decayRate": 0.01
  }
}
EOF
log_success "Configuration de l'autonomie créée"

# Ajouter variables d'environnement si pas présentes
if [ -f ".env.local" ]; then
    if ! grep -q "AUTONOMY_ENABLED" .env.local; then
        echo "" >> .env.local
        echo "# Jarvis Autonomy System" >> .env.local
        echo "AUTONOMY_ENABLED=true" >> .env.local
        echo "AUTONOMY_LEARNING_ENABLED=true" >> .env.local
        echo "AUTONOMY_PROACTIVE_MODE=true" >> .env.local
        echo "AUTONOMY_LOG_LEVEL=info" >> .env.local
        echo "AUTONOMY_DATA_PATH=./data/autonomy" >> .env.local
    fi
else
    cat > .env.local <<EOF
# OpenClaw Configuration
NODE_ENV=development

# Jarvis Autonomy System
AUTONOMY_ENABLED=true
AUTONOMY_LEARNING_ENABLED=true
AUTONOMY_PROACTIVE_MODE=true
AUTONOMY_LOG_LEVEL=info
AUTONOMY_DATA_PATH=./data/autonomy
EOF
fi
log_success "Variables d'environnement configurées"

# Vérification des modules d'intelligence
log_info "Vérification des modules d'intelligence..."

INTELLIGENCE_MODULES=(
    "src/autonomy/intelligence/context-enricher.ts"
    "src/autonomy/intelligence/predictive-engine.ts"
    "src/autonomy/intelligence/reinforcement-learner.ts"
    "src/autonomy/intelligence/semantic-memory.ts"
    "src/autonomy/intelligence/multi-modal-processor.ts"
    "src/autonomy/intelligence/intelligence-coordinator.ts"
    "src/autonomy/intelligence/causal-reasoner.ts"
    "src/autonomy/intelligence/digital-twin.ts"
)

MODULES_OK=true
for module in "${INTELLIGENCE_MODULES[@]}"; do
    if [ -f "$module" ]; then
        echo "   ✅ $(basename $module)"
    else
        echo "   ❌ $(basename $module) - MANQUANT"
        MODULES_OK=false
    fi
done

if [ "$MODULES_OK" = false ]; then
    log_error "Certains modules sont manquants"
    exit 1
fi

log_success "8 modules d'intelligence vérifiés"

echo ""

# Message de bienvenue Autonomie
cat <<'EOF'
┌─────────────────────────────────────────────────────────────────┐
│                    🤖 JARVIS AUTONOMY                           │
│                      Activé par défaut                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Votre assistant OpenClaw est maintenant équipé de :            │
│                                                                 │
│  🧠 Intelligence Proactive    → Anticipe vos besoins            │
│  🎓 Apprentissage Continu     → S'améliore avec vous            │
│  🔮 Prédiction                → Comprend vos habitudes          │
│  🔗 Raisonnement Causal       → Analyse causes & effets         │
│  🏭 Simulation                → Teste avant d'agir              │
│                                                                 │
│  Tout est configuré automatiquement !                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
EOF

echo ""
log_success "Système d'autonomie installé et configuré"

echo ""

# Résumé final
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ INSTALLATION TERMINÉE                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Démarrage rapide :"
echo ""
echo "   1. Lancer OpenClaw + Autonomie :"
echo "      pnpm dev"
echo ""
echo "   2. Ou avec le tutoriel :"
echo "      pnpm jarvis:start --tutorial"
echo ""
echo "   3. Accéder au dashboard :"
echo "      http://localhost:3000/autonomy"
echo ""
echo "   4. Vérifier l'installation :"
echo "      pnpm jarvis:doctor"
echo ""
echo "📚 Documentation :"
echo "   • Guide autonomie : src/autonomy/README.md"
echo "   • API référence : docs/autonomy/API.md"
echo ""
echo "🆘 Support :"
echo "   • Diagnostic : pnpm jarvis:doctor"
echo "   • Logs : pnpm jarvis:logs"
echo "   • Reset : pnpm jarvis:reset"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "🚀 OpenClaw avec Autonomie est prêt !"
echo ""
