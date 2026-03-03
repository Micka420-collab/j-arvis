/**
 * Exemple Complet - Reconnaissance Vocale avec Autonomie
 * 
 * Montre comment intégrer VoiceIdentifier avec tous les autres modules
 * pour créer une expérience de reconnaissance vocale complète.
 */

import { VoiceIdentifier } from "./voice-identifier.js";
import { SemanticMemory } from "./semantic-memory.js";
import { IntelligenceCoordinator } from "./intelligence-coordinator.js";
import { ContextEnricher } from "./context-enricher.js";
import { PredictiveEngine } from "./predictive-engine.js";
import { ReinforcementLearner } from "./reinforcement-learner.js";
import { MultiModalProcessor } from "./multi-modal-processor.js";

// ============================================================================
// Scénario 1: Enregistrement d'une nouvelle voix (apprentissage)
// ============================================================================

export async function scenario1_EnrollVoice() {
  console.log("\n" + "=".repeat(60));
  console.log("🎙️  SCÉNARIO 1: Enregistrement d'une voix");
  console.log("=".repeat(60) + "\n");

  // Initialiser
  const memory = new SemanticMemory(1000, 384);
  const voiceId = new VoiceIdentifier(memory);

  console.log("👤 Enregistrement de la voix de 'Mick'...\n");

  // Simuler 3 échantillons audio (en vrai: enregistrement microphone)
  const audioSamples = [
    new Float32Array(32000).map(() => Math.random() * 2 - 1), // 2 secondes @ 16kHz
    new Float32Array(32000).map(() => Math.random() * 2 - 1),
    new Float32Array(32000).map(() => Math.random() * 2 - 1),
  ];

  // Enregistrer le profil
  const profile = await voiceId.enrollVoice(
    "Mick",                          // Nom
    audioSamples,                    // Échantillons
    "user_mick_123",                 // ID utilisateur (optionnel)
    { gender: "male", language: "fr" } // Métadonnées
  );

  console.log("✅ Profil vocal créé :");
  console.log(`   ID: ${profile.id}`);
  console.log(`   Nom: ${profile.name}`);
  console.log(`   Confiance: ${(profile.confidence * 100).toFixed(0)}%`);
  console.log(`   Échantillons: ${profile.samples}`);
  console.log(`   Genre détecté: ${profile.metadata.gender}`);

  return { voiceId, profile };
}

// ============================================================================
// Scénario 2: Reconnaissance pendant une conversation
// ============================================================================

export async function scenario2_RecognizeDuringConversation() {
  console.log("\n" + "=".repeat(60));
  console.log("🗣️  SCÉNARIO 2: Reconnaissance pendant conversation");
  console.log("=".repeat(60) + "\n");

  const memory = new SemanticMemory(1000, 384);
  const voiceId = new VoiceIdentifier(memory);

  // D'abord, enregistrer Mick et Sarah
  console.log("📚 Enregistrement des profils...");
  
  await voiceId.enrollVoice(
    "Mick",
    [new Float32Array(32000).map(() => Math.random() * 0.8 - 0.4)],
    "user_mick",
    { gender: "male" }
  );

  await voiceId.enrollVoice(
    "Sarah",
    [new Float32Array(32000).map(() => Math.random() * 0.6 + 0.2)],
    "user_sarah",
    { gender: "female" }
  );

  console.log("   ✅ Mick et Sarah enregistrés\n");

  // Simulation d'une conversation
  const conversation = [
    { speaker: "Mick", text: "Jarvis, allume les lumières" },
    { speaker: "Sarah", text: "Et mets de la musique douce" },
    { speaker: "Mick", text: "Bonne idée, quelque chose de relaxant" },
    { speaker: "Inconnu", text: "Vous avez des invités ?" }, // Nouvelle voix !
  ];

  console.log("🎭 Simulation de conversation :\n");

  for (const turn of conversation) {
    // Simuler l'audio (en vrai: buffer du microphone)
    const audioData = new Float32Array(32000).map(() => 
      Math.random() * (turn.speaker === "Sarah" ? 0.6 : 0.8) - 0.3
    );

    // Identifier qui parle
    const result = await voiceId.identifySpeaker(audioData, turn.text);

    if (result.isKnown) {
      console.log(`   🎤 "${turn.text}"`);
      console.log(`      → Reconnu: ${result.name} (${(result.confidence * 100).toFixed(0)}%)`);
      
      // Apprendre de cette interaction
      await voiceId.learnFromInteraction(
        result.profileId!,
        audioData,
        turn.text,
        "neutral",
        "conversation salon"
      );
    } else {
      console.log(`   🎤 "${turn.text}"`);
      console.log(`      → ⚠️  NOUVELLE VOIX détectée !`);
      console.log(`      → Profil temporaire: ${result.name}`);
      
      if (result.alternatives.length > 0) {
        console.log(`      → Pourrait être: ${result.alternatives[0].name} (${(result.alternatives[0].score * 100).toFixed(0)}%)`);
      }
    }
    console.log();
  }

  // Afficher les stats
  const stats = voiceId.getStats();
  console.log("📊 Statistiques :");
  console.log(`   Profils connus: ${stats.knownProfiles}`);
  console.log(`   Profils inconnus/temp: ${stats.unknownProfiles}`);
  console.log(`   Confiance moyenne: ${(stats.averageConfidence * 100).toFixed(0)}%`);

  return voiceId;
}

// ============================================================================
// Scénario 3: Intégration complète avec Autonomie
// ============================================================================

export async function scenario3_FullIntegration() {
  console.log("\n" + "=".repeat(60));
  console.log("🤖 SCÉNARIO 3: Intégration complète avec Autonomie");
  console.log("=".repeat(60) + "\n");

  // Initialiser tous les modules
  const memory = new SemanticMemory(1000, 384);
  const voiceId = new VoiceIdentifier(memory);
  
  const modules = {
    contextEnricher: new ContextEnricher(),
    predictiveEngine: new PredictiveEngine(),
    reinforcementLearner: new ReinforcementLearner(),
    semanticMemory: memory,
    multiModalProcessor: new MultiModalProcessor(),
  };
  
  const coordinator = new IntelligenceCoordinator(modules);

  // Enregistrer les voix de la famille
  console.log("👨‍👩‍👧 Enregistrement des voix familiales...\n");
  
  await voiceId.enrollVoice(
    "Papa",
    [new Float32Array(32000).map(() => Math.random() * 0.8 - 0.4)],
    "user_papa",
    { gender: "male" }
  );
  
  await voiceId.enrollVoice(
    "Maman",
    [new Float32Array(32000).map(() => Math.random() * 0.6 + 0.1)],
    "user_maman",
    { gender: "female" }
  );

  console.log("   ✅ Papa et Maman enregistrés\n");

  // Simulation : Papa parle
  console.log("🎭 Simulation : Papa demande quelque chose\n");
  
  const audioData = new Float32Array(32000).map(() => Math.random() * 0.8 - 0.4);
  const transcript = "Jarvis, rappelle-moi de prendre mon médicament à 20h";

  // 1. Identifier la voix
  const voiceResult = await voiceId.identifySpeaker(audioData, transcript);
  console.log(`🎤 Voix identifiée: ${voiceResult.name} (${(voiceResult.confidence * 100).toFixed(0)}%)`);

  if (voiceResult.isKnown && voiceResult.name === "Papa") {
    // 2. Enrichir le contexte avec l'identification vocale
    const enrichedContext = await modules.contextEnricher.enrichContext({
      userId: voiceResult.profileId!,
      timestamp: new Date(),
      emotionalInput: {
        // On peut déduire l'humeur de la voix
        mood: "focused",
        energyLevel: 7,
      },
    });

    // 3. Traitement multi-modal avec la voix
    const multiModalResult = await modules.multiModalProcessor.process({
      text: transcript,
      voice: {
        transcript,
        emotion: "focused",
        confidence: voiceResult.confidence,
        speaker: voiceResult.name,
      },
    });

    console.log(`🧠 Contexte enrichi:`);
    console.log(`   - Heure: ${enrichedContext.temporal.timeOfDay}`);
    console.log(`   - Speaker: ${voiceResult.name}`);
    console.log(`   - Intention: ${multiModalResult.fusedIntent}`);

    // 4. Prédiction basée sur l'historique de Papa
    modules.predictiveEngine.recordEvent("medication_reminder", 1, "evening", new Date());
    const prediction = modules.predictiveEngine.predictNext("medication_reminder", 60);

    // 5. Décision coordonnée
    const decision = await coordinator.coordinate({
      userId: voiceResult.profileId!,
      timestamp: new Date(),
      multimodalInput: {
        text: transcript,
        voice: {
          transcript,
          emotion: "focused",
          confidence: voiceResult.confidence,
        },
      },
    });

    console.log(`\n🎯 Décision:`);
    console.log(`   ${decision.explanation.summary}`);
    console.log(`   Action: Créer rappel médicament 20h pour ${voiceResult.name}`);
    console.log(`   Confiance: ${(decision.confidence * 100).toFixed(0)}%`);

    // 6. Apprendre de l'interaction
    await voiceId.learnFromInteraction(
      voiceResult.profileId!,
      audioData,
      transcript,
      "focused",
      "demande rappel médicament"
    );
  }

  return { voiceId, coordinator };
}

// ============================================================================
// Scénario 4: Apprentissage continu et amélioration
// ============================================================================

export async function scenario4_ContinuousLearning() {
  console.log("\n" + "=".repeat(60));
  console.log("📈 SCÉNARIO 4: Apprentissage Continu");
  console.log("=".repeat(60) + "\n");

  const memory = new SemanticMemory(1000, 384);
  const voiceId = new VoiceIdentifier(memory);

  // Enregistrement initial (faible confiance)
  console.log("🎙️  Enregistrement initial (3 échantillons)...");
  const profile = await voiceId.enrollVoice(
    "Alice",
    [
      new Float32Array(32000).map(() => Math.random() * 0.7 - 0.35),
      new Float32Array(32000).map(() => Math.random() * 0.7 - 0.35),
      new Float32Array(32000).map(() => Math.random() * 0.7 - 0.35),
    ],
    "user_alice"
  );
  
  console.log(`   Confiance initiale: ${(profile.confidence * 100).toFixed(0)}%\n`);

  // Simuler 10 interactions supplémentaires
  console.log("🔄 Simulation de 10 interactions supplémentaires...\n");
  
  for (let i = 0; i < 10; i++) {
    const audioData = new Float32Array(32000).map(() => Math.random() * 0.7 - 0.35);
    
    await voiceId.learnFromInteraction(
      profile.id,
      audioData,
      `Message ${i + 1}`,
      ["happy", "neutral", "focused"][i % 3],
      "conversation"
    );

    // Montrer l'évolution de la confiance
    const updatedProfile = voiceId.getProfile(profile.id);
    if (i % 3 === 2) {
      console.log(`   Interaction ${i + 1}: Confiance = ${(updatedProfile!.confidence * 100).toFixed(0)}%`);
    }
  }

  const finalProfile = voiceId.getProfile(profile.id);
  console.log(`\n✅ Confiance finale: ${(finalProfile!.confidence * 100).toFixed(0)}%`);
  console.log(`   Total échantillons: ${finalProfile!.samples}`);
  console.log(`   Historique: ${finalProfile!.history.length} interactions`);
}

// ============================================================================
// Scénario 5: Gestion des erreurs et corrections
// ============================================================================

export async function scenario5_ErrorHandling() {
  console.log("\n" + "=".repeat(60));
  console.log("🔧 SCÉNARIO 5: Gestion des Erreurs");
  console.log("=".repeat(60) + "\n");

  const memory = new SemanticMemory(1000, 384);
  const voiceId = new VoiceIdentifier(memory);

  // Enregistrer deux personnes
  const mick = await voiceId.enrollVoice(
    "Mick",
    [new Float32Array(32000).map(() => Math.random() * 0.8 - 0.4)],
    "user_mick"
  );

  const john = await voiceId.enrollVoice(
    "John",
    [new Float32Array(32000).map(() => Math.random() * 0.75 - 0.35)],
    "user_john"
  );

  console.log("👥 Profils enregistrés: Mick et John\n");

  // Erreur de reconnaissance
  console.log("🎭 Simulation d'erreur...");
  const audioData = new Float32Array(32000).map(() => Math.random() * 0.8 - 0.4);
  const result = await voiceId.identifySpeaker(audioData, "Bonjour Jarvis");

  console.log(`   Reconnu: ${result.name} (${(result.confidence * 100).toFixed(0)}%)`);
  console.log(`   En réalité: C'est Mick qui parlait\n`);

  // Correction utilisateur
  console.log("🔧 Correction utilisateur:");
  console.log("   Utilisateur: 'Non, c'était Mick, pas John'\n");

  // Mettre à jour avec le bon profil
  await voiceId.learnFromInteraction(
    mick.id,
    audioData,
    "Bonjour Jarvis",
    "neutral",
    "correction"
  );

  // Fusionner si nécessaire (même personne reconnue comme deux)
  console.log("   ✅ Profil de Mick mis à jour avec la nouvelle donnée\n");

  // Vérification améliorée
  const verifyResult = await voiceId.verifySameSpeaker(
    new Float32Array(32000).map(() => Math.random() * 0.8 - 0.4),
    audioData
  );

  console.log(`📊 Vérification similarité: ${(verifyResult.confidence * 100).toFixed(0)}%`);
  console.log(`   Même personne: ${verifyResult.same ? "Oui" : "Non"}`);
}

// ============================================================================
// Démonstration Complète
// ============================================================================

export async function runVoiceRecognitionDemo() {
  console.log("\n" + "█".repeat(60));
  console.log("█" + " ".repeat(58) + "█");
  console.log("█" + "     🎙️  DÉMO RECONNAISSANCE VOCALE JARVIS        " + "█");
  console.log("█" + " ".repeat(58) + "█");
  console.log("█".repeat(60));

  try {
    await scenario1_EnrollVoice();
    await scenario2_RecognizeDuringConversation();
    await scenario3_FullIntegration();
    await scenario4_ContinuousLearning();
    await scenario5_ErrorHandling();

    console.log("\n" + "=".repeat(60));
    console.log("✅ Démonstration terminée !");
    console.log("=".repeat(60) + "\n");

    console.log("📝 Résumé des capacités :");
    console.log("   • Enregistrement de voix avec few-shot learning");
    console.log("   • Reconnaissance en temps réel pendant conversations");
    console.log("   • Intégration avec le système d'autonomie complet");
    console.log("   • Apprentissage continu (amélioration avec le temps)");
    console.log("   • Gestion des erreurs et corrections utilisateur");
    console.log("   • Distinction multiples locuteurs");
    console.log();

  } catch (error) {
    console.error("\n❌ Erreur:", error);
  }
}

// Export pour utilisation
export { runVoiceRecognitionDemo };
