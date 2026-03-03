#!/usr/bin/env node
/**
 * Script de diagnostic du système Jarvis
 * Vérifie que tout est correctement configuré
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                  🔍 JARVIS DOCTOR                            ║');
console.log('║              Diagnostic du système                           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('\n');

const checks = [];

function check(name, test, message) {
  try {
    const result = test();
    checks.push({ name, status: result, message });
    return result;
  } catch (e) {
    checks.push({ name, status: false, message: e.message });
    return false;
  }
}

// Vérifications
console.log('🧪 Vérifications en cours...\n');

// 1. Node.js
check(
  'Node.js version',
  () => {
    const version = process.version;
    const major = parseInt(version.split('.')[0].slice(1));
    return major >= 22;
  },
  'Node.js 22+ requis'
);

// 2. package.json
check(
  'package.json',
  () => fs.existsSync('package.json'),
  'Fichier package.json manquant'
);

// 3. Structure des dossiers
check(
  'Structure src/autonomy',
  () => fs.existsSync('src/autonomy'),
  'Dossier src/autonomy manquant'
);

check(
  'Modules d\'intelligence',
  () => fs.existsSync('src/autonomy/intelligence'),
  'Dossier intelligence manquant'
);

// 4. Fichiers clés
const keyFiles = [
  'src/autonomy/index.ts',
  'src/autonomy/intelligence/index.ts',
  'src/autonomy/intelligence/intelligence-coordinator.ts',
  'src/autonomy/intelligence/causal-reasoner.ts',
  'src/autonomy/intelligence/digital-twin.ts',
];

keyFiles.forEach(file => {
  check(
    `Fichier ${path.basename(file)}`,
    () => fs.existsSync(file),
    `Fichier ${file} manquant`
  );
});

// 5. Configuration
check(
  'Configuration',
  () => {
    const configPath = 'config/autonomy.json';
    if (!fs.existsSync(configPath)) return false;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.enabled !== undefined;
  },
  'Configuration manquante (exécutez pnpm jarvis:init)'
);

// 6. Variables d'environnement
check(
  'Variables d\'environnement',
  () => {
    const envPath = '.env.local';
    if (!fs.existsSync(envPath)) return false;
    const env = fs.readFileSync(envPath, 'utf8');
    return env.includes('AUTONOMY_ENABLED');
  },
  'Variables d\'env manquantes'
);

// 7. Dossier de données
check(
  'Dossier de données',
  () => fs.existsSync('data/autonomy'),
  'Dossier data/autonomy manquant'
);

// 8. Dépendances
check(
  'node_modules',
  () => fs.existsSync('node_modules'),
  'Dépendances non installées (pnpm install)'
);

// 9. Build
check(
  'Build',
  () => fs.existsSync('dist') || fs.existsSync('build'),
  'Build manquant (pnpm build)'
);

// Résultats
console.log('\n');
console.log('📊 Résultats du diagnostic :\n');

let passed = 0;
let failed = 0;

checks.forEach(({ name, status, message }) => {
  if (status) {
    console.log(`   ✅ ${name}`);
    passed++;
  } else {
    console.log(`   ❌ ${name}`);
    console.log(`      → ${message}`);
    failed++;
  }
});

console.log('\n');
console.log(`📈 Total : ${passed} ✅ / ${failed} ❌ (${checks.length} vérifications)`);

// Statistiques des modules
console.log('\n');
console.log('📦 Modules d\'intelligence :\n');

const modules = [
  'context-enricher.ts',
  'predictive-engine.ts',
  'reinforcement-learner.ts',
  'semantic-memory.ts',
  'multi-modal-processor.ts',
  'intelligence-coordinator.ts',
  'causal-reasoner.ts',
  'digital-twin.ts',
];

modules.forEach(mod => {
  const exists = fs.existsSync(`src/autonomy/intelligence/${mod}`);
  console.log(`   ${exists ? '✅' : '❌'} ${mod}`);
});

// Recommandations
console.log('\n');
if (failed === 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              ✅ TOUT EST OK - SYSTÈME PRÊT !                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('🚀 Vous pouvez démarrer :\n');
  console.log('   pnpm jarvis:start\n');
} else {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           ⚠️  PROBLÈMES DÉTECTÉS                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('🔧 Corrections suggérées :\n');
  
  if (!fs.existsSync('node_modules')) {
    console.log('   → Installer les dépendances : pnpm install');
  }
  if (!fs.existsSync('config/autonomy.json')) {
    console.log('   → Configurer le système : pnpm jarvis:init');
  }
  if (!fs.existsSync('dist') && !fs.existsSync('build')) {
    console.log('   → Compiler : pnpm build');
  }
  console.log('');
}
