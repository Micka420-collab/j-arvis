#!/usr/bin/env node
/**
 * Script de démarrage de Jarvis avec guide interactif
 */

const { spawn } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const args = process.argv.slice(2);
const isTutorial = args.includes('--tutorial');
const isDebug = args.includes('--debug');

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                                                              ║');
console.log('║              🤖 JARVIS AUTONOMY SYSTEM                       ║');
console.log('║                   Démarrage...                               ║');
console.log('║                                                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('\n');

async function checkConfig() {
  if (!fs.existsSync('config/autonomy.json')) {
    console.log('⚠️  Configuration manquante. Lancement de l\'installation...\n');
    const { execSync } = require('child_process');
    execSync('node scripts/setup-autonomy.js', { stdio: 'inherit' });
    return;
  }

  const config = JSON.parse(fs.readFileSync('config/autonomy.json', 'utf8'));
  
  if (!config.enabled) {
    console.log('⚠️  Le système d\'autonomie est désactivé.\n');
    console.log('   Pour l\'activer, modifiez config/autonomy.json\n');
    process.exit(0);
  }

  console.log('✅ Configuration chargée\n');
  console.log(`   Mode proactif: ${config.proactivity?.enabled ? '✅' : '❌'}`);
  console.log(`   Apprentissage: ${config.learning?.enabled ? '✅' : '❌'}`);
  console.log(`   Confirmation requise: ${config.proactivity?.requireConfirmation ? '✅' : '❌'}`);
  console.log(`   Max suggestions/heure: ${config.proactivity?.maxSuggestionsPerHour || 3}\n`);
}

async function showTutorial() {
  if (!isTutorial) return;

  console.log('📚 TUTORIEL - Premiers pas avec Jarvis\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const steps = [
    {
      title: '1️⃣  Comprendre le système',
      text: 'Jarvis utilise 8 modules d\'intelligence pour anticiper vos besoins.'
    },
    {
      title: '2️⃣  Interaction naturelle',
      text: 'Parlez à Jarvis comme à un assistant. Il comprend le contexte.'
    },
    {
      title: '3️⃣  Suggestions proactives',
      text: 'Jarvis vous suggérera des actions basées sur vos habitudes.'
    },
    {
      title: '4️⃣  Feedback',
      text: 'Donnez votre avis sur les suggestions pour améliorer le système.'
    },
    {
      title: '5️⃣  Dashboard',
      text: 'Accédez à http://localhost:3000/autonomy pour visualiser tout.'
    }
  ];

  for (const step of steps) {
    console.log(`${step.title}`);
    console.log(`   ${step.text}\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('✅ Tutoriel terminé !\n');
}

function startServer() {
  console.log('🚀 Démarrage du serveur...\n');

  const env = {
    ...process.env,
    DEBUG: isDebug ? 'jarvis:*' : process.env.DEBUG,
  };

  const child = spawn('pnpm', ['dev'], {
    stdio: 'inherit',
    env,
    shell: true
  });

  child.on('error', (err) => {
    console.error('❌ Erreur de démarrage:', err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code);
  });

  // Gestion de l'arrêt gracieux
  process.on('SIGINT', () => {
    console.log('\n\n👋 Arrêt de Jarvis...\n');
    child.kill('SIGINT');
  });
}

async function main() {
  try {
    await checkConfig();
    await showTutorial();
    
    if (isDebug) {
      console.log('🐛 Mode debug activé\n');
    }

    console.log('🎯 Démarrage dans 3 secondes...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    startServer();

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
