/**
 * Exemple Complet - Workflow de Décision Intelligente
 * 
 * Ce fichier montre comment utiliser tous les modules d'intelligence
 * ensemble pour créer un système autonome complet.
 */

import { IntelligenceCoordinator } from "./intelligence-coordinator.js";
import { CausalReasoner } from "./causal-reasoner.js";
import { DigitalTwin } from "./digital-twin.js";
import { ContextEnricher } from "./context-enricher.js";
import { PredictiveEngine } from "./predictive-engine.js";
import { ReinforcementLearner } from "./reinforcement-learner.js";
import { SemanticMemory } from "./semantic-memory.js";
import { MultiModalProcessor } from "./multi-modal-processor.js";

// ============================================================================
// Configuration du Système
// ============================================================================

const config = {
  coordination: {
    contextWeight: 0.25,
    predictionWeight: 0.25,
    rlWeight: 0.3,
    memoryWeight: 0.2,
    autonomyThreshold: 0.75,
    maxSuggestions: 3,
    explainableMode: true,
  },
  rl: {
    learningRate: 0.1,
    explorationRate: 0.3,
    explorationDecay: 0.995,
    minExploration: 0.01,
  },
  memory: {
    maxSize: 10000,
    embeddingDim: 384,
  },
};

// ============================================================================
// Initialisation de Tous les Modules
// ============================================================================

export function initializeIntelligenceSystem() {
  console.log("🚀 Initialisation du Système d'Intelligence Jarvis\n");

  // Modules de base
  const contextEnricher = new ContextEnricher();
  const predictiveEngine = new PredictiveEngine();
  const reinforcementLearner = new ReinforcementLearner(config.rl);
  const semanticMemory = new SemanticMemory(config.memory.maxSize, config.memory.embeddingDim);
  const multiModalProcessor = new MultiModalProcessor();

  // Modules avancés
  const causalReasoner = new CausalReasoner();
  const digitalTwin = new DigitalTwin(causalReasoner, predictiveEngine);
  
  const intelligenceCoordinator = new IntelligenceCoordinator(
    {
      contextEnricher,
      predictiveEngine,
      reinforcementLearner,
      semanticMemory,
      multiModalProcessor,
    },
    config.coordination
  );

  console.log("✅ Tous les modules initialisés\n");

  return {
    contextEnricher,
    predictiveEngine,
    reinforcementLearner,
    semanticMemory,
    multiModalProcessor,
    causalReasoner,
    digitalTwin,
    intelligenceCoordinator,
  };
}

// ============================================================================
// Scénario 1: Routine Matinale Intelligente
// ============================================================================

export async function morningRoutineWorkflow(system: ReturnType<typeof initializeIntelligenceSystem>) {
  console.log("\n" + "=".repeat(60));
  console.log("🌅 SCÉNARIO 1: Routine Matinale Intelligente");
  console.log("=".repeat(60) + "\n");

  const { 
    predictiveEngine, 
    semanticMemory, 
    causalReasoner, 
    digitalTwin, 
    intelligenceCoordinator 
  } = system;

  // Étape 1: Enregistrer l'historique (simulation de données passées)
  console.log("📚 Étape 1: Apprentissage des habitudes...");
  
  for (let day = 0; day < 7; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    date.setHours(8, 0, 0, 0);
    
    predictiveEngine.recordEvent("make_coffee", 1, "morning", date);
    predictiveEngine.recordEvent("lights_on", 1, "morning", new Date(date.getTime() + 5 * 60000));
    
    // Enregistrer dans le raisonnement causal
    causalReasoner.recordEvent({
      type: "wake_up",
      timestamp: date,
      variables: { energy: 5 },
    });
    
    causalReasoner.recordEvent({
      type: "make_coffee",
      timestamp: new Date(date.getTime() + 10 * 60000),
      variables: { intensity: 0.8 },
      outcome: 0.9,
    });
  }

  await semanticMemory.store(
    "L'utilisateur préfère un café court et fort le matin",
    "preference",
    0.95
  );
  
  await semanticMemory.store(
    "La musique classique aide à se concentrer le matin",
    "preference",
    0.8
  );

  console.log("   ✓ 7 jours d'historique enregistrés");
  console.log("   ✓ Préférences mémorisées\n");

  // Étape 2: Synchroniser le Digital Twin
  console.log("🏭 Étape 2: Synchronisation du jumeau numérique...");
  
  digitalTwin.syncState({
    location: "home",
    weather: { condition: "clear", temperature: 18, humidity: 65 },
    devices: {
      coffee_machine: { 
        id: "coffee_machine", 
        type: "appliance", 
        status: "standby", 
        settings: {}, 
        powerConsumption: 0 
      },
      lights: { 
        id: "lights", 
        type: "lighting", 
        status: "off", 
        settings: {}, 
        powerConsumption: 0 
      },
    },
    user: {
      presence: true,
      activity: "just_awake",
      energyLevel: 4,
      mood: "sleepy",
    },
  });

  console.log("   ✓ État synchronisé\n");

  // Étape 3: Simuler la routine
  console.log("🎮 Étape 3: Simulation de la routine matinale...");
  
  const morningScenario = digitalTwin.createScenario(
    "Routine Matinale",
    "Simulation de la routine matinale avec café et lumières",
    [
      { 
        id: "1", 
        type: "LIGHTS_ON", 
        description: "Allumer les lumières", 
        parameters: { brightness: 0.7 }, 
        confidence: 0.9,
        metadata: { scheduledTime: 5 }
      },
      { 
        id: "2", 
        type: "MAKE_COFFEE", 
        description: "Préparer le café", 
        parameters: { intensity: "strong", size: "short" }, 
        confidence: 0.95,
        metadata: { scheduledTime: 10 }
      },
      { 
        id: "3", 
        type: "PLAY_MUSIC", 
        description: "Musique classique", 
        parameters: { genre: "classical", volume: 0.3 }, 
        confidence: 0.8,
        metadata: { scheduledTime: 15 }
      },
    ],
    60 // 1 heure
  );

  const simulationResult = await digitalTwin.runSimulation(morningScenario.id);
  
  console.log("   📊 Résultats de la simulation:");
  console.log(`   - Consommation: ${simulationResult.outcomes.energyConsumption}Wh`);
  console.log(`   - Confort: ${simulationResult.outcomes.comfortScore.toFixed(1)}/10`);
  console.log(`   - Satisfaction: ${simulationResult.outcomes.userSatisfaction.toFixed(1)}/10`);
  console.log(`   - Risques: ${simulationResult.outcomes.risks.length === 0 ? "Aucun" : simulationResult.outcomes.risks.join(", ")}`);
  console.log();

  // Étape 4: Analyse Causale
  console.log("🔗 Étape 4: Analyse causale...");
  
  const causalGraph = causalReasoner.buildCausalGraph(["wake_up", "make_coffee", "energy_boost", "productivity"]);
  
  console.log(`   ✓ Graphe causal construit: ${causalGraph.nodes.length} nœuds, ${causalGraph.edges.length} relations`);
  
  const relation = causalReasoner.discoverCausalRelations("wake_up", "make_coffee", 30);
  if (relation) {
    console.log(`   ✓ Relation trouvée: wake_up → make_coffee (${(relation.strength * 100).toFixed(0)}% force)`);
  }
  console.log();

  // Étape 5: Décision Coordonnée
  console.log("🎯 Étape 5: Prise de décision coordonnée...");
  
  const baseContext = {
    userId: "user123",
    timestamp: new Date("2026-03-03T08:00:00"),
  };

  const coordinatedDecision = await intelligenceCoordinator.coordinate(baseContext);
  
  console.log("   📋 Décision finale:");
  console.log(`   - Action: ${coordinatedDecision.decision.selectedAction?.description}`);
  console.log(`   - Confiance: ${(coordinatedDecision.confidence * 100).toFixed(0)}%`);
  console.log(`   - Autonome: ${coordinatedDecision.decision.selectedAction?.requiresConfirmation ? "Non (confirmation requise)" : "Oui"}`);
  console.log();
  
  console.log("   💡 Explication:");
  console.log(`   ${coordinatedDecision.explanation.summary}`);
  console.log();
  
  if (coordinatedDecision.alternatives.length > 0) {
    console.log("   🔄 Alternatives:");
    coordinatedDecision.alternatives.forEach((alt, i) => {
      console.log(`   ${i + 1}. ${alt.description} (${(alt.confidence * 100).toFixed(0)}%)`);
    });
  }

  return coordinatedDecision;
}

// ============================================================================
// Scénario 2: Gestion de Stress (Root Cause Analysis)
// ============================================================================

export async function stressManagementWorkflow(system: ReturnType<typeof initializeIntelligenceSystem>) {
  console.log("\n" + "=".repeat(60));
  console.log("😰 SCÉNARIO 2: Gestion de Stress");
  console.log("=".repeat(60) + "\n");

  const { causalReasoner, digitalTwin, intelligenceCoordinator } = system;

  // Simuler des données historiques de stress
  console.log("📚 Analyse des patterns de stress...");
  
  const eventTypes = [
    { type: "deadline_approaching", outcome: -0.3 },
    { type: "poor_sleep", outcome: -0.5 },
    { type: "high_caffeine", outcome: -0.2 },
    { type: "interruption", outcome: -0.4 },
    { type: "stress", outcome: -0.8 },
  ];

  for (let i = 0; i < 20; i++) {
    const event = eventTypes[i % eventTypes.length];
    causalReasoner.recordEvent({
      type: event.type,
      timestamp: new Date(Date.now() - i * 3600000),
      variables: { severity: Math.random() },
      outcome: event.outcome,
    });
  }

  // Analyse des causes racines
  console.log("🔍 Recherche des causes racines du stress...\n");
  
  const rootCauseAnalysis = causalReasoner.analyzeRootCauses("stress", 7 * 24 * 60 * 60 * 1000);
  
  console.log("📊 Résultats de l'analyse:");
  console.log(`   Problème: ${rootCauseAnalysis.problem}`);
  console.log(`   Confiance: ${(rootCauseAnalysis.confidence * 100).toFixed(0)}%`);
  console.log();
  
  console.log("   Causes identifiées:");
  rootCauseAnalysis.rootCauses.forEach((cause, i) => {
    console.log(`   ${i + 1}. ${cause.factor} (${(cause.contribution * 100).toFixed(0)}% de contribution)`);
    cause.evidence.forEach(e => console.log(`      - ${e}`));
  });
  console.log();
  
  console.log("   Recommandations:");
  rootCauseAnalysis.recommendations.forEach((rec, i) => {
    console.log(`   ${i + 1}. ${rec}`);
  });
  console.log();

  // Simulation d'interventions
  console.log("🎮 Simulation des interventions...");
  
  digitalTwin.syncState({
    location: "home",
    weather: { condition: "clear", temperature: 22, humidity: 50 },
    devices: {},
    user: {
      presence: true,
      activity: "working",
      energyLevel: 3,
      mood: "stressed",
    },
  });

  // Scénario avec intervention
  const interventionScenario = digitalTwin.createScenario(
    "Intervention Anti-Stress",
    "Test d'interventions pour réduire le stress",
    [
      { 
        id: "1", 
        type: "SUGGEST_BREAK", 
        description: "Suggérer une pause", 
        parameters: { duration: 15 }, 
        confidence: 0.9 
      },
      { 
        id: "2", 
        type: "PLAY_MEDITATION", 
        description: "Méditation guidée", 
        parameters: { duration: 10 }, 
        confidence: 0.85 
      },
      { 
        id: "3", 
        type: "ADJUST_LIGHTING", 
        description: "Lumière douce", 
        parameters: { warmth: 0.8, brightness: 0.4 }, 
        confidence: 0.8 
      },
    ],
    30
  );

  const interventionResult = await digitalTwin.runSimulation(interventionScenario.id);
  
  console.log("   📊 Résultats de l'intervention:");
  console.log(`   - Confort: ${interventionResult.outcomes.comfortScore.toFixed(1)}/10`);
  console.log(`   - Satisfaction: ${interventionResult.outcomes.userSatisfaction.toFixed(1)}/10`);
  console.log(`   - Impact productivité: ${interventionResult.outcomes.productivityImpact.toFixed(1)}/10`);
  
  return rootCauseAnalysis;
}

// ============================================================================
// Scénario 3: Optimisation Quotidienne
// ============================================================================

export async function dailyOptimizationWorkflow(system: ReturnType<typeof initializeIntelligenceSystem>) {
  console.log("\n" + "=".repeat(60));
  console.log("⚡ SCÉNARIO 3: Optimisation Quotidienne");
  console.log("=".repeat(60) + "\n");

  const { digitalTwin, intelligenceCoordinator } = system;

  // Simulation d'une journée complète
  console.log("🎮 Simulation de la journée type...\n");
  
  digitalTwin.syncState({
    location: "home",
    weather: { condition: "partly_cloudy", temperature: 20, humidity: 60 },
    devices: {
      thermostat: { id: "thermostat", type: "climate", status: "on", settings: { temp: 21 }, powerConsumption: 200 },
      lights: { id: "lights", type: "lighting", status: "on", settings: {}, powerConsumption: 150 },
    },
    user: {
      presence: true,
      activity: "mixed",
      energyLevel: 6,
      mood: "neutral",
    },
  });

  // Comparer plusieurs scénarios
  const scenario1 = digitalTwin.createScenario(
    "Approche Actuelle",
    "Gestion standard de la journée",
    [],
    24 * 60 // 24 heures
  );

  const scenario2 = digitalTwin.createScenario(
    "Approche Optimisée",
    "Avec ajustements automatiques",
    [
      { id: "1", type: "ADAPTIVE_LIGHTING", description: "Lumière adaptative", parameters: {}, confidence: 0.9 },
      { id: "2", type: "SMART_CLIMATE", description: "Climat intelligent", parameters: {}, confidence: 0.85 },
      { id: "3", type: "ENERGY_OPTIMIZATION", description: "Optimisation énergie", parameters: {}, confidence: 0.8 },
    ],
    24 * 60
  );

  const comparison = await digitalTwin.compareScenarios([scenario1.id, scenario2.id]);
  
  console.log("   📊 Comparaison des approches:");
  console.log();
  console.log(`   🏆 Meilleur scénario: ${comparison.best.scenario.name}`);
  console.log();
  
  console.log("   📈 Classement:");
  comparison.rankings.forEach((rank, i) => {
    console.log(`   ${i + 1}. ${rank.scenario} (score: ${(rank.score * 100).toFixed(1)}%)`);
    console.log(`      → ${rank.reason}`);
  });
  console.log();
  
  console.log("   📝 Analyse:");
  console.log(`   ${comparison.analysis}`);
  console.log();

  // Suggestions d'optimisation
  console.log("💡 Suggestions d'optimisation:");
  const suggestions = digitalTwin.suggestOptimizations("Approche Actuelle");
  
  suggestions.forEach((suggestion, i) => {
    console.log(`   ${i + 1}. ${suggestion.suggestedApproach}`);
    console.log(`      Amélioration attendue:`);
    console.log(`      - Énergie: ${suggestion.expectedImprovement.energy}%`);
    console.log(`      - Confort: +${suggestion.expectedImprovement.comfort}%`);
    console.log(`      - Satisfaction: +${suggestion.expectedImprovement.satisfaction}%`);
    console.log(`      Confiance: ${(suggestion.confidence * 100).toFixed(0)}%`);
    if (suggestion.tradeoffs.length > 0) {
      console.log(`      Compromis: ${suggestion.tradeoffs.join(", ")}`);
    }
    console.log();
  });

  return comparison;
}

// ============================================================================
// Exécution Complète
// ============================================================================

export async function runCompleteWorkflow() {
  console.log("\n" + "█".repeat(60));
  console.log("█" + " ".repeat(58) + "█");
  console.log("█" + "      JARVIS INTELLIGENCE - WORKFLOW COMPLET      " + "█");
  console.log("█" + " ".repeat(58) + "█");
  console.log("█".repeat(60) + "\n");

  try {
    // Initialisation
    const system = initializeIntelligenceSystem();

    // Scénario 1: Routine Matinale
    await morningRoutineWorkflow(system);

    // Scénario 2: Gestion de Stress
    await stressManagementWorkflow(system);

    // Scénario 3: Optimisation
    await dailyOptimizationWorkflow(system);

    // Statistiques finales
    console.log("\n" + "=".repeat(60));
    console.log("📊 STATISTIQUES FINALES");
    console.log("=".repeat(60) + "\n");

    const coordinatorStats = system.intelligenceCoordinator.getStats();
    console.log("Intelligence Coordinator:");
    console.log(`  - Décisions prises: ${coordinatorStats.totalDecisions}`);
    console.log(`  - Temps moyen: ${coordinatorStats.avgProcessingTime.toFixed(0)}ms`);
    console.log(`  - Confiance moyenne: ${(coordinatorStats.avgConfidence * 100).toFixed(0)}%`);
    console.log();

    const causalStats = system.causalReasoner.getStats();
    console.log("Causal Reasoner:");
    console.log(`  - Événements enregistrés: ${causalStats.totalEvents}`);
    console.log(`  - Relations causales: ${causalStats.causalRelations}`);
    console.log();

    const twinStats = system.digitalTwin.getStats();
    console.log("Digital Twin:");
    console.log(`  - Simulations: ${twinStats.totalSimulations}`);
    console.log(`  - Meilleur scénario: ${twinStats.bestScenario || "N/A"}`);
    console.log();

    console.log("\n" + "✅".repeat(30));
    console.log("Workflow complet exécuté avec succès !");
    console.log("✅".repeat(30) + "\n");

  } catch (error) {
    console.error("\n❌ Erreur lors du workflow:", error);
    throw error;
  }
}

// Export pour utilisation
export { runCompleteWorkflow };
