#!/usr/bin/env node
/**
 * Script post-installation automatique
 * S'exécute automatiquement après `pnpm install`
 * Configure l'autonomie Jarvis sans interaction utilisateur
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour le logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}`),
};

function main() {
  // Ne pas exécuter en CI ou si déjà configuré
  if (process.env.CI || process.env.SKIP_AUTONOMY_SETUP) {
    return;
  }

  const configPath = path.join(process.cwd(), 'config', 'autonomy.json');
  
  // Si déjà configuré, ne rien faire
  if (fs.existsSync(configPath)) {
    return;
  }

  log.section('🤖 Configuration de Jarvis Autonomy');
  log.info('Installation automatique du système d\'autonomie...\n');

  try {
    // Créer les dossiers
    const dirs = [
      path.join(process.cwd(), 'config'),
      path.join(process.cwd(), 'data', 'autonomy'),
      path.join(process.cwd(), 'logs'),
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Configuration par défaut
    const config = {
      enabled: true,
      learning: {
        enabled: true,
        learningRate: 0.1,
        feedbackThreshold: 0.5,
      },
      prediction: {
        enabled: true,
        horizon: 60,
        minConfidence: 0.7,
      },
      proactivity: {
        enabled: true,
        maxSuggestionsPerHour: 3,
        suggestionDelay: 300,
        requireConfirmation: false,
      },
      coordination: {
        contextWeight: 0.25,
        predictionWeight: 0.25,
        rlWeight: 0.3,
        memoryWeight: 0.2,
        autonomyThreshold: 0.75,
        maxSuggestions: 3,
        explainableMode: true,
      },
      causal: {
        minConfidenceThreshold: 0.6,
        maxEvents: 10000,
      },
      memory: {
        maxSize: 10000,
        embeddingDim: 384,
        decayRate: 0.01,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    log.success('Configuration créée');

    // Variables d'environnement
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    if (!envContent.includes('AUTONOMY_ENABLED')) {
      const autonomyEnv = `
# Jarvis Autonomy System (auto-configuré)
AUTONOMY_ENABLED=true
AUTONOMY_LEARNING_ENABLED=true
AUTONOMY_PROACTIVE_MODE=true
AUTONOMY_LOG_LEVEL=info
AUTONOMY_DATA_PATH=./data/autonomy
`;
      fs.writeFileSync(envPath, envContent + autonomyEnv);
      log.success('Variables d\'environnement configurées');
    }

    // Vérifier les modules
    const modulesDir = path.join(process.cwd(), 'src', 'autonomy', 'intelligence');
    const requiredModules = [
      'context-enricher.ts',
      'predictive-engine.ts',
      'reinforcement-learner.ts',
      'semantic-memory.ts',
      'multi-modal-processor.ts',
      'intelligence-coordinator.ts',
      'causal-reasoner.ts',
      'digital-twin.ts',
    ];

    let modulesFound = 0;
    requiredModules.forEach(mod => {
      if (fs.existsSync(path.join(modulesDir, mod))) {
        modulesFound++;
      }
    });

    if (modulesFound === requiredModules.length) {
      log.success(`8 modules d'intelligence vérifiés`);
    } else {
      log.warning(`${modulesFound}/8 modules trouvés`);
    }

    console.log('');
    log.success('Jarvis Autonomy est configuré et prêt !');
    console.log('');
    console.log(`${colors.cyan}Commandes disponibles :${colors.reset}`);
    console.log('  pnpm dev              → Démarrer OpenClaw + Autonomie');
    console.log('  pnpm jarvis:doctor    → Vérifier l\'installation');
    console.log('  pnpm jarvis:start     → Démarrer avec tutoriel');
    console.log('');

  } catch (error) {
    log.warning(`Erreur lors de la configuration: ${error.message}`);
    log.info('Vous pouvez configurer manuellement avec : pnpm jarvis:init');
  }
}

main();
