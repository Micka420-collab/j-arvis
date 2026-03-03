/**
 * Exemple d'utilisation des modules d'intelligence avancée
 * Montre comment combiner ContextEnricher, PredictiveEngine, RL et SemanticMemory
 */

import { ContextEnricher } from "./context-enricher.js";
import { PredictiveEngine } from "./predictive-engine.js";
import { ReinforcementLearner } from "./reinforcement-learner.js";
import { SemanticMemory } from "./semantic-memory.js";

// ============================================================================
// Exemple 1: Assistant Proactif Intelligent
// ============================================================================

export async function proactiveAssistantExample() {
  console.log("🚀 Démonstration de l'Assistant Proactif Intelligent\n");

  // Initialiser les composants
  const contextEnricher = new ContextEnricher();
  const predictor = new PredictiveEngine();
  const memory = new SemanticMemory();

  // Simuler des événements historiques
  console.log("📚 Apprentissage des habitudes...");
  
  // Enregistrer des patterns d'allumage des lumières
  for (let day = 0; day < 7; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    date.setHours(19, 0, 0, 0);
    predictor.recordEvent("lights_on", 1, "soir", date);
  }

  // Enregistrer des préférences
  await memory.store(
    "L'utilisateur préfère une température de 21°C le soir",
    "preference",
    0.9
  );
  
  await memory.store(
    "La musique jazz aide l'utilisateur à se détendre après le travail",
    "preference",
    0.8
  );

  console.log("✅ Habitudes apprises:\n");

  // Scénario: L'utilisateur rentre à la maison
  console.log("🏠 Scénario: L'utilisateur rentre à la maison (19h00)\n");

  // 1. Enrichir le contexte
  const context = await contextEnricher.enrichContext({
    userId: "user123",
    timestamp: new Date(),
  });

  console.log("📊 Contexte détecté:");
  console.log(`   - Localisation: ${context.location.isHome ? "Maison" : "Extérieur"}`);
  console.log(`   - Météo: ${context.weather?.condition || "Inconnue"}`);
  console.log(`   - Énergie: ${context.emotional.energyLevel || "N/A"}/10`);
  console.log(`   - Saison: ${context.seasonal.season}\n`);

  // 2. Prédire les besoins
  const prediction = predictor.predictNext("lights_on", 30);
  console.log("🔮 Prédiction:");
  console.log(`   - Probabilité d'allumer les lumières: ${(prediction.confidence * 100).toFixed(1)}%`);
  console.log(`   - Tendance: ${prediction.trend}`);
  if (prediction.nextOccurrence) {
    console.log(`   - Prochaine occurrence prévue: ${prediction.nextOccurrence.toLocaleTimeString()}`);
  }
  console.log();

  // 3. Consulter la mémoire
  const relevantMemories = await memory.search("soir détente", 3);
  console.log("💭 Souvenirs pertinents:");
  for (const result of relevantMemories) {
    console.log(`   - ${result.entry.content} (pertinence: ${(result.relevance * 100).toFixed(0)}%)`);
  }
  console.log();

  // 4. Générer des suggestions
  const suggestions = contextEnricher.generateContextualSuggestions(context);
  console.log("💡 Suggestions générées:");
  suggestions.slice(0, 3).forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.suggestion}`);
    console.log(`      Raison: ${s.reason} (confiance: ${(s.confidence * 100).toFixed(0)}%)`);
  });

  return { context, prediction, suggestions };
}

// ============================================================================
// Exemple 2: Apprentissage par Renforcement
// ============================================================================

export async function reinforcementLearningExample() {
  console.log("\n\n🎓 Démonstration de l'Apprentissage par Renforcement\n");

  const rl = new ReinforcementLearner({
    learningRate: 0.1,
    explorationRate: 0.3,
    explorationDecay: 0.99,
  });

  const states = ["morning", "evening", "weekend"];
  const actions = ["suggest_coffee", "suggest_music", "suggest_lights"];

  console.log("🔄 Simulation d'interactions:\n");

  // Simuler 20 interactions avec feedback aléatoire
  for (let i = 0; i < 20; i++) {
    const state = states[Math.floor(Math.random() * states.length)];
    
    // L'agent choisit une action
    const action = rl.chooseAction(state, actions);
    
    // Simuler un feedback utilisateur (plus probable d'être positif pour certaines combinaisons)
    let feedback: "positive" | "negative" | "neutral" = "neutral";
    if (state === "morning" && action === "suggest_coffee") {
      feedback = Math.random() > 0.2 ? "positive" : "neutral";
    } else if (state === "evening" && action === "suggest_music") {
      feedback = Math.random() > 0.3 ? "positive" : "neutral";
    } else {
      feedback = Math.random() > 0.5 ? "neutral" : "negative";
    }

    // L'agent apprend
    const reward = rl.feedbackToReward(state, action, feedback);
    rl.learn(reward);

    if (i < 5) {
      console.log(`   Interaction ${i + 1}:`);
      console.log(`   - État: ${state}, Action: ${action}`);
      console.log(`   - Feedback: ${feedback}, Reward: ${reward.value}`);
      console.log(`   - Exploration rate: ${rl.getStats().explorationRate.toFixed(3)}\n`);
    }
  }

  // Afficher les meilleures politiques apprises
  console.log("📊 Politiques apprises:");
  for (const state of states) {
    const bestActions = rl.getBestActions(state, 2);
    console.log(`   ${state}:`);
    bestActions.forEach((a, i) => {
      console.log(`      ${i + 1}. ${a.action} (Q-value: ${a.qValue.toFixed(2)})`);
    });
  }

  // Afficher les statistiques
  const stats = rl.getStats();
  console.log(`\n📈 Statistiques:`);
  console.log(`   - États explorés: ${stats.totalStates}`);
  console.log(`   - Actions apprises: ${stats.totalActions}`);
  console.log(`   - Q-value moyenne: ${stats.averageQValue.toFixed(2)}`);
  console.log(`   - Taux d'exploration final: ${stats.explorationRate.toFixed(3)}`);

  return rl;
}

// ============================================================================
// Exemple 3: Mémoire Sémantique et Narratif
// ============================================================================

export async function semanticMemoryExample() {
  console.log("\n\n🧠 Démonstration de la Mémoire Sémantique\n");

  const memory = new SemanticMemory(100, 64);

  // Stocker des souvenirs
  console.log("💾 Stockage de souvenirs:\n");
  
  const memories = [
    { content: "L'utilisateur aime le café le matin", category: "preference" as const, importance: 0.9 },
    { content: "Réunion importante le mardi à 14h", category: "event" as const, importance: 0.8 },
    { content: "L'utilisateur préfère le calme pour travailler", category: "preference" as const, importance: 0.7 },
    { content: "Anniversaire de la femme le 15 mars", category: "event" as const, importance: 1.0 },
    { content: "Stressé avant les présentations", category: "emotion" as const, importance: 0.8 },
    { content: "Aime courir le weekend", category: "preference" as const, importance: 0.6 },
  ];

  for (const m of memories) {
    await memory.store(m.content, m.category, m.importance);
    console.log(`   ✓ "${m.content.substring(0, 40)}..." (${m.category})`);
  }

  // Recherche sémantique
  console.log("\n🔍 Recherche: 'préférences alimentaires'");
  const results = await memory.search("préférences alimentaires", 3);
  results.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.entry.content}`);
    console.log(`      Similarité: ${(r.similarity * 100).toFixed(0)}%`);
  });

  // Recherche: que faire le matin
  console.log("\n🔍 Recherche: 'routine matinale'");
  const morningResults = await memory.search("routine matinale", 3);
  morningResults.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.entry.content}`);
  });

  // Générer un récit
  console.log("\n📝 Narratif autobiographique (dernière semaine):");
  console.log(memory.generateNarrative("week"));

  // Renforcer un souvenir important
  const important = memory.getMostImportant(1)[0];
  if (important) {
    console.log(`\n⭐ Souvenir le plus important: "${important.content}"`);
    memory.reinforceMemory(important.id, 0.2);
    console.log("   → Importance renforcée !");
  }

  return memory;
}

// ============================================================================
// Exemple 4: Système Combiné Intelligent
// ============================================================================

export async function combinedIntelligenceExample() {
  console.log("\n\n🤖 Démonstration du Système Combiné Intelligent\n");
  console.log("=" .repeat(60));

  // Initialiser tous les composants
  const context = new ContextEnricher();
  const predictor = new PredictiveEngine();
  const rl = new ReinforcementLearner();
  const memory = new SemanticMemory();

  // Scénario: Début de journée de travail
  console.log("\n📅 Scénario: Début de journée de travail (Lundi 8h30)\n");

  // Enrichir le contexte
  const richContext = await context.enrichContext({
    userId: "user123",
    timestamp: new Date(),
  });

  // Prédire les besoins
  const workPrediction = predictor.predictNext("start_work_routine", 60);
  const coffeePrediction = predictor.predictNext("make_coffee", 30);

  // Consulter la mémoire
  const workMemories = await memory.search("préférences travail matin", 3);

  // Décider avec RL
  const state = `morning_${richContext.emotional.energyLevel || "medium"}_energy`;
  const availableActions = [
    "suggest_focus_mode",
    "suggest_coffee",
    "suggest_reminder_meeting",
    "ask_preferences",
  ];

  const chosenAction = rl.chooseAction(state, availableActions);

  // Afficher la décision
  console.log("🎯 Décision intelligente:");
  console.log(`   État: ${state}`);
  console.log(`   Action choisie: ${chosenAction}`);
  console.log(`   Confiance prédiction travail: ${(workPrediction.confidence * 100).toFixed(0)}%`);
  console.log(`   Confiance prédiction café: ${(coffeePrediction.confidence * 100).toFixed(0)}%`);

  if (workMemories.length > 0) {
    console.log(`   Souvenirs pertinents: ${workMemories.length}`);
  }

  console.log("\n💬 Message proposé:");
  console.log(`   "Bonjour ! Je vois que vous commencez votre journée.`);
  console.log(`    ${getActionDescription(chosenAction)}"`);

  // Simuler un feedback positif
  const feedback = "positive";
  rl.learn(rl.feedbackToReward(state, chosenAction, feedback));
  console.log(`\n✅ Feedback reçu: ${feedback} → Apprentissage effectué !`);

  return { chosenAction, context: richContext };
}

function getActionDescription(action: string): string {
  const descriptions: Record<string, string> = {
    suggest_focus_mode: "Je peux activer le mode focus pour vous aider à démarrer ?",
    suggest_coffee: "Voulez-vous que je prépare le café ?",
    suggest_reminder_meeting: "Vous avez une réunion dans 30 minutes, je vous rappelle ?",
    ask_preferences: "Comment puis-je vous aider ce matin ?",
  };
  return descriptions[action] || "Puis-je vous aider ?";
}

// ============================================================================
// Exécuter tous les exemples
// ============================================================================

export async function runAllExamples() {
  try {
    await proactiveAssistantExample();
    await reinforcementLearningExample();
    await semanticMemoryExample();
    await combinedIntelligenceExample();
    
    console.log("\n\n" + "=".repeat(60));
    console.log("✅ Toutes les démonstrations terminées avec succès !");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Erreur:", error);
  }
}

// Export pour utilisation
export { runAllExamples };
