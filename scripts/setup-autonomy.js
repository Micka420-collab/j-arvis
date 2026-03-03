#!/usr/bin/env node
/**
 * Script d'installation guidée du système d'autonomie Jarvis
 * Guide l'utilisateur à travers la configuration initiale
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                                                              ║');
console.log('║           🚀 JARVIS AUTONOMY SYSTEM - SETUP                  ║');
console.log('║                                                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('\n');

async function main() {
  try {
    // Vérification des prérequis
    console.log('📋 Vérification des prérequis...\n');
    
    const nodeVersion = process.version;
    console.log(`   ✓ Node.js ${nodeVersion}`);
    
    if (parseInt(nodeVersion.split('.')[0].slice(1)) < 22) {
      console.error('   ❌ Node.js 22+ requis');
      process.exit(1);
    }

    // Vérifier si on est dans le bon dossier
    if (!fs.existsSync('package.json')) {
      console.error('   ❌ package.json non trouvé. Exécutez depuis la racine du projet.');
      process.exit(1);
    }

    console.log('   ✓ Environnement OK\n');

    // Configuration
    console.log('⚙️  Configuration du système d\'autonomie...\n');
    
    const enableAutonomy = await question('Activer le système d\'autonomie ? (O/n) : ');
    const autonomyEnabled = enableAutonomy.toLowerCase() !== 'n';

    let config = {
      enabled: autonomyEnabled,
      learning: { enabled: true, learningRate: 0.1 },
      prediction: { enabled: true, horizon: 60, minConfidence: 0.7 },
      proactivity: { maxSuggestionsPerHour: 3, requireConfirmation: false },
    };

    if (autonomyEnabled) {
      const proactiveMode = await question('Activer le mode proactif ? (O/n) : ');
      config.proactivity.enabled = proactiveMode.toLowerCase() !== 'n';

      const confirmActions = await question('Demander confirmation pour les actions ? (o/N) : ');
      config.proactivity.requireConfirmation = confirmActions.toLowerCase() === 'o';

      const suggestionsPerHour = await question('Nombre max de suggestions/heure (défaut: 3) : ');
      config.proactivity.maxSuggestionsPerHour = parseInt(suggestionsPerHour) || 3;
    }

    // Créer le dossier de données
    const dataPath = path.join(process.cwd(), 'data', 'autonomy');
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
      console.log(`   ✓ Dossier créé: ${dataPath}`);
    }

    // Sauvegarder la configuration
    const configPath = path.join(process.cwd(), 'config', 'autonomy.json');
    if (!fs.existsSync(path.dirname(configPath))) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`   ✓ Configuration sauvegardée: ${configPath}`);

    // Créer .env.local si nécessaire
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    if (!envContent.includes('AUTONOMY_ENABLED')) {
      envContent += `\n# Jarvis Autonomy System\n`;
      envContent += `AUTONOMY_ENABLED=${autonomyEnabled}\n`;
      envContent += `AUTONOMY_LEARNING_ENABLED=true\n`;
      envContent += `AUTONOMY_PROACTIVE_MODE=${config.proactivity.enabled}\n`;
      envContent += `AUTONOMY_LOG_LEVEL=info\n`;
      envContent += `AUTONOMY_DATA_PATH=./data/autonomy\n`;
      
      fs.writeFileSync(envPath, envContent);
      console.log(`   ✓ Variables d'environnement ajoutées`);
    }

    console.log('\n');
    console.log('📦 Installation des dépendances...\n');
    
    try {
      execSync('pnpm install', { stdio: 'inherit' });
      console.log('   ✓ Dépendances installées\n');
    } catch (e) {
      console.log('   ⚠️  Erreur lors de l\'installation, essayez manuellement: pnpm install');
    }

    // Build
    console.log('🔨 Compilation...\n');
    try {
      execSync('pnpm build:autonomy', { stdio: 'inherit' });
      console.log('   ✓ Compilation réussie\n');
    } catch (e) {
      console.log('   ⚠️  Erreur de compilation, essayez manuellement: pnpm build');
    }

    // Résumé
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ INSTALLATION TERMINÉE                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    console.log('🎯 Prochaines étapes :\n');
    console.log('   1. Démarrer le système :');
    console.log('      pnpm jarvis:start\n');
    console.log('   2. Voir le dashboard :');
    console.log('      pnpm jarvis:dashboard\n');
    console.log('   3. Vérifier l\'installation :');
    console.log('      pnpm jarvis:doctor\n');
    console.log('   4. Lire la documentation :');
    console.log('      docs/autonomy/README.md\n');

    if (autonomyEnabled) {
      console.log('🤖 Le système d\'autonomie est ACTIVÉ et prêt !\n');
    } else {
      console.log('⚠️  Le système d\'autonomie est installé mais DÉSACTIVÉ.');
      console.log('   Modifiez config/autonomy.json pour l\'activer.\n');
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'installation:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
