/**
 * Voice Identifier - Système de Reconnaissance Vocale
 * 
 * Permet à Jarvis de :
 * - Reconnaître qui parle (utilisateur ou autre)
 * - Mémoriser les empreintes vocales
 * - Associer une voix à un profil/utilisateur
 * - S'améliorer avec le temps (apprentissage continu)
 */

import type { SemanticMemory, MemoryEntry } from "./semantic-memory.js";

export interface VoiceProfile {
  id: string;
  name: string;                    // Nom associé à la voix
  userId?: string;                 // Lien vers un utilisateur connu
  embedding: number[];             // Vecteur caractéristique de la voix
  samples: number;                 // Nombre d'échantillons collectés
  confidence: number;              // Confiance dans cette empreinte (0-1)
  createdAt: Date;
  lastHeardAt: Date;
  metadata: {
    age?: number;                  // Estimation d'âge
    gender?: "male" | "female" | "unknown";
    language?: string;             // Langue détectée
    accent?: string;               // Accent
    emotionalBaseline?: string;    // Ton de base (calme, énergique...)
  };
  history: VoiceInteraction[];     // Historique des interactions
}

export interface VoiceInteraction {
  timestamp: Date;
  transcript: string;
  emotion: string;
  context: string;
  duration: number;                // Durée en secondes
}

export interface VoiceSample {
  id: string;
  audioData: Float32Array;         // Données audio normalisées
  features: VoiceFeatures;         // Caractéristiques extraites
  timestamp: Date;
  duration: number;
}

export interface VoiceFeatures {
  // MFCC (Mel-Frequency Cepstral Coefficients)
  mfcc: number[];
  // Pitch (hauteur de voix)
  pitch: {
    mean: number;
    std: number;
    min: number;
    max: number;
  };
  // Formants (résonances du conduit vocal)
  formants: number[];
  // Énergie/volume
  energy: {
    mean: number;
    variance: number;
  };
  // ZCR (Zero Crossing Rate) - indicateur de bruit/voix
  zcr: number;
  // Spectral features
  spectral: {
    centroid: number;
    rolloff: number;
    flux: number;
  };
  // Rythme de parole
  tempo: {
    wordsPerMinute: number;
    pauses: number[];
  };
}

export interface VoiceIdentificationResult {
  profileId: string | null;
  name: string | null;
  confidence: number;
  isKnown: boolean;
  matchScore: number;
  alternatives: Array<{
    profileId: string;
    name: string;
    score: number;
  }>;
  features: VoiceFeatures;
}

export interface VoiceConfig {
  // Seuil de confiance pour reconnaître une voix
  recognitionThreshold: number;    // 0.7 par défaut
  // Seuil pour créer un nouveau profil
  newProfileThreshold: number;     // 0.3 par défaut
  // Nombre minimum d'échantillons pour un profil fiable
  minSamplesForReliability: number; // 3
  // Taille du vecteur d'embedding
  embeddingSize: number;           // 128
  // Durée minimum d'échantillon (secondes)
  minSampleDuration: number;       // 2.0
  // Durée maximum d'échantillon (secondes)
  maxSampleDuration: number;       // 30.0
}

export class VoiceIdentifier {
  private profiles: Map<string, VoiceProfile> = new Map();
  private semanticMemory: SemanticMemory;
  private config: VoiceConfig;
  private currentSession: Map<string, VoiceSample[]> = new Map();

  constructor(
    semanticMemory: SemanticMemory,
    config?: Partial<VoiceConfig>
  ) {
    this.semanticMemory = semanticMemory;
    this.config = {
      recognitionThreshold: 0.7,
      newProfileThreshold: 0.3,
      minSamplesForReliability: 3,
      embeddingSize: 128,
      minSampleDuration: 2.0,
      maxSampleDuration: 30.0,
      ...config,
    };
  }

  // ============================================================================
  // API Publique Principale
  // ============================================================================

  /**
   * Identifie qui parle à partir d'un échantillon audio
   * C'est la méthode principale appelée lors de la détection vocale
   */
  async identifySpeaker(
    audioData: Float32Array,
    transcript?: string,
    context?: string
  ): Promise<VoiceIdentificationResult> {
    // 1. Extraire les caractéristiques
    const features = await this.extractFeatures(audioData);
    
    // 2. Créer l'embedding
    const embedding = this.createEmbedding(features);
    
    // 3. Comparer avec les profils connus
    const matches = await this.findMatches(embedding);
    
    // 4. Décider : connu ou inconnu ?
    if (matches.length > 0 && matches[0].score > this.config.recognitionThreshold) {
      // Voix reconnue !
      const bestMatch = matches[0];
      const profile = this.profiles.get(bestMatch.profileId)!;
      
      // Mettre à jour le profil
      await this.updateProfile(profile, embedding, features, transcript, context);
      
      return {
        profileId: profile.id,
        name: profile.name,
        confidence: bestMatch.score,
        isKnown: true,
        matchScore: bestMatch.score,
        alternatives: matches.slice(1).map(m => ({
          profileId: m.profileId,
          name: this.profiles.get(m.profileId)?.name || "Unknown",
          score: m.score,
        })),
        features,
      };
    } else {
      // Nouvelle voix détectée
      const isNewSpeaker = matches.length === 0 || matches[0].score < this.config.newProfileThreshold;
      
      if (isNewSpeaker) {
        // Créer un profil temporaire pour cette session
        const tempProfile = await this.createTemporaryProfile(embedding, features);
        
        return {
          profileId: tempProfile.id,
          name: tempProfile.name,
          confidence: 0,
          isKnown: false,
          matchScore: 0,
          alternatives: matches.map(m => ({
            profileId: m.profileId,
            name: this.profiles.get(m.profileId)?.name || "Unknown",
            score: m.score,
          })),
          features,
        };
      } else {
        // Voix faiblement reconnue - demander confirmation
        const bestMatch = matches[0];
        return {
          profileId: bestMatch.profileId,
          name: this.profiles.get(bestMatch.profileId)?.name || "Unknown",
          confidence: bestMatch.score,
          isKnown: false, // Faible confiance
          matchScore: bestMatch.score,
          alternatives: matches.slice(1).map(m => ({
            profileId: m.profileId,
            name: this.profiles.get(m.profileId)?.name || "Unknown",
            score: m.score,
          })),
          features,
        };
      }
    }
  }

  /**
   * Enregistre explicitement une nouvelle voix (apprentissage supervisé)
   */
  async enrollVoice(
    name: string,
    audioSamples: Float32Array[],
    userId?: string,
    metadata?: Partial<VoiceProfile["metadata"]>
  ): Promise<VoiceProfile> {
    if (audioSamples.length === 0) {
      throw new Error("Au moins un échantillon audio requis");
    }

    // Extraire les features de tous les échantillons
    const allFeatures: VoiceFeatures[] = [];
    const allEmbeddings: number[][] = [];

    for (const sample of audioSamples) {
      const features = await this.extractFeatures(sample);
      const embedding = this.createEmbedding(features);
      allFeatures.push(features);
      allEmbeddings.push(embedding);
    }

    // Créer un embedding moyen (centroïde)
    const averageEmbedding = this.averageEmbeddings(allEmbeddings);
    
    // Agréger les features
    const aggregatedFeatures = this.aggregateFeatures(allFeatures);

    // Créer le profil
    const profile: VoiceProfile = {
      id: `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      userId,
      embedding: averageEmbedding,
      samples: audioSamples.length,
      confidence: Math.min(0.95, 0.5 + audioSamples.length * 0.1), // Plus d'échantillons = plus confiant
      createdAt: new Date(),
      lastHeardAt: new Date(),
      metadata: {
        gender: aggregatedFeatures.pitch.mean < 165 ? "male" : "female",
        ...metadata,
      },
      history: [],
    };

    this.profiles.set(profile.id, profile);
    
    // Sauvegarder dans la mémoire sémantique
    await this.saveProfileToMemory(profile);

    return profile;
  }

  /**
   * Met à jour le nom d'un profil vocal (correction utilisateur)
   */
  async updateProfileName(profileId: string, newName: string): Promise<VoiceProfile | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) return null;

    profile.name = newName;
    await this.saveProfileToMemory(profile);
    
    return profile;
  }

  /**
   * Associe un profil vocal à un utilisateur système
   */
  async linkProfileToUser(profileId: string, userId: string): Promise<VoiceProfile | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) return null;

    profile.userId = userId;
    await this.saveProfileToMemory(profile);
    
    return profile;
  }

  /**
   * Apprend d'une interaction (améliore le profil avec le temps)
   */
  async learnFromInteraction(
    profileId: string,
    audioData: Float32Array,
    transcript: string,
    emotion: string,
    context: string
  ): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    const features = await this.extractFeatures(audioData);
    const embedding = this.createEmbedding(features);
    
    // Mettre à jour avec une moyenne pondérée
    const weight = 1 / (profile.samples + 1);
    profile.embedding = this.updateEmbeddingAverage(
      profile.embedding,
      embedding,
      weight
    );
    
    profile.samples++;
    profile.lastHeardAt = new Date();
    profile.confidence = Math.min(0.99, profile.confidence + 0.01);
    
    // Ajouter à l'historique
    profile.history.push({
      timestamp: new Date(),
      transcript,
      emotion,
      context,
      duration: audioData.length / 16000, // Approximation 16kHz
    });

    // Limiter l'historique
    if (profile.history.length > 100) {
      profile.history = profile.history.slice(-100);
    }

    await this.saveProfileToMemory(profile);
  }

  /**
   * Vérifie si deux échantillons correspondent à la même voix
   */
  async verifySameSpeaker(
    sample1: Float32Array,
    sample2: Float32Array
  ): Promise<{ same: boolean; confidence: number }> {
    const features1 = await this.extractFeatures(sample1);
    const features2 = await this.extractFeatures(sample2);
    
    const embedding1 = this.createEmbedding(features1);
    const embedding2 = this.createEmbedding(features2);
    
    const similarity = this.cosineSimilarity(embedding1, embedding2);
    
    return {
      same: similarity > this.config.recognitionThreshold,
      confidence: similarity,
    };
  }

  // ============================================================================
  // Gestion des Profils
  // ============================================================================

  /**
   * Liste tous les profils vocaux connus
   */
  getAllProfiles(): VoiceProfile[] {
    return Array.from(this.profiles.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Récupère un profil par ID
   */
  getProfile(profileId: string): VoiceProfile | undefined {
    return this.profiles.get(profileId);
  }

  /**
   * Récupère un profil par nom
   */
  getProfileByName(name: string): VoiceProfile | undefined {
    return Array.from(this.profiles.values()).find(
      p => p.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Supprime un profil
   */
  async deleteProfile(profileId: string): Promise<boolean> {
    const deleted = this.profiles.delete(profileId);
    if (deleted) {
      // Supprimer aussi de la mémoire sémantique
      await this.semanticMemory.delete(`voice_profile_${profileId}`);
    }
    return deleted;
  }

  /**
   * Fusionne deux profils (même personne détectée deux fois)
   */
  async mergeProfiles(profileId1: string, profileId2: string): Promise<VoiceProfile | null> {
    const p1 = this.profiles.get(profileId1);
    const p2 = this.profiles.get(profileId2);
    
    if (!p1 || !p2) return null;

    // Garder le profil le plus ancien comme base
    const base = p1.createdAt < p2.createdAt ? p1 : p2;
    const other = base === p1 ? p2 : p1;

    // Fusionner les embeddings (moyenne pondérée)
    const totalSamples = base.samples + other.samples;
    const weight1 = base.samples / totalSamples;
    const weight2 = other.samples / totalSamples;
    
    base.embedding = base.embedding.map((v, i) => 
      v * weight1 + other.embedding[i] * weight2
    );
    
    base.samples = totalSamples;
    base.confidence = Math.max(base.confidence, other.confidence);
    base.history = [...base.history, ...other.history]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-100);
    
    base.lastHeardAt = new Date();

    // Supprimer l'ancien profil
    this.profiles.delete(other.id);
    await this.semanticMemory.delete(`voice_profile_${other.id}`);
    
    await this.saveProfileToMemory(base);
    
    return base;
  }

  // ============================================================================
  // Méthodes Privées
  // ============================================================================

  private async extractFeatures(audioData: Float32Array): Promise<VoiceFeatures> {
    // Simulation d'extraction de features (à remplacer par vraie implémentation audio)
    // Dans la vraie vie, utiliser : Web Audio API, Meyda, ou FFmpeg
    
    const duration = audioData.length / 16000; // Assume 16kHz
    
    // Calculs simplifiés pour démonstration
    const mean = audioData.reduce((a, b) => a + b, 0) / audioData.length;
    const variance = audioData.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / audioData.length;
    
    return {
      mfcc: Array(13).fill(0).map(() => Math.random() * 2 - 1),
      pitch: {
        mean: 100 + Math.random() * 100,
        std: 10 + Math.random() * 20,
        min: 80 + Math.random() * 40,
        max: 200 + Math.random() * 100,
      },
      formants: [500 + Math.random() * 500, 1500 + Math.random() * 500],
      energy: {
        mean: Math.abs(mean) * 1000,
        variance: variance * 1000,
      },
      zcr: Math.random() * 0.1,
      spectral: {
        centroid: 1000 + Math.random() * 2000,
        rolloff: 2000 + Math.random() * 2000,
        flux: Math.random() * 0.5,
      },
      tempo: {
        wordsPerMinute: 120 + Math.random() * 60,
        pauses: [],
      },
    };
  }

  private createEmbedding(features: VoiceFeatures): number[] {
    // Créer un vecteur d'embedding à partir des features
    // Dans la vraie vie, utiliser un modèle ML (OpenAI Whisper, etc.)
    
    const embedding: number[] = [];
    
    // Ajouter les MFCC
    embedding.push(...features.mfcc);
    
    // Ajouter le pitch normalisé
    embedding.push(features.pitch.mean / 300);
    embedding.push(features.pitch.std / 50);
    
    // Ajouter les formants
    embedding.push(...features.formants.map(f => f / 3000));
    
    // Ajouter l'énergie
    embedding.push(features.energy.mean / 1000);
    
    // Ajouter le ZCR
    embedding.push(features.zcr);
    
    // Ajouter les features spectrales
    embedding.push(features.spectral.centroid / 4000);
    embedding.push(features.spectral.rolloff / 4000);
    
    // Normaliser à la taille souhaitée
    while (embedding.length < this.config.embeddingSize) {
      embedding.push(Math.random() * 0.1 - 0.05);
    }
    
    return embedding.slice(0, this.config.embeddingSize);
  }

  private async findMatches(embedding: number[]): Promise<Array<{ profileId: string; score: number }>> {
    const matches: Array<{ profileId: string; score: number }> = [];
    
    for (const [id, profile] of this.profiles) {
      const similarity = this.cosineSimilarity(embedding, profile.embedding);
      matches.push({ profileId: id, score: similarity });
    }
    
    return matches.sort((a, b) => b.score - a.score);
  }

  private async createTemporaryProfile(
    embedding: number[],
    features: VoiceFeatures
  ): Promise<VoiceProfile> {
    const id = `temp_voice_${Date.now()}`;
    
    const profile: VoiceProfile = {
      id,
      name: `Inconnu_${this.profiles.size + 1}`,
      embedding: [...embedding],
      samples: 1,
      confidence: 0.3,
      createdAt: new Date(),
      lastHeardAt: new Date(),
      metadata: {
        gender: features.pitch.mean < 165 ? "male" : "female",
      },
      history: [],
    };
    
    this.profiles.set(id, profile);
    return profile;
  }

  private async updateProfile(
    profile: VoiceProfile,
    embedding: number[],
    features: VoiceFeatures,
    transcript?: string,
    context?: string
  ): Promise<void> {
    // Mise à jour incrémentale de l'embedding
    const learningRate = 0.1;
    profile.embedding = profile.embedding.map((v, i) => 
      v * (1 - learningRate) + embedding[i] * learningRate
    );
    
    profile.samples++;
    profile.lastHeardAt = new Date();
    profile.confidence = Math.min(0.99, profile.confidence + 0.005);
    
    if (transcript) {
      profile.history.push({
        timestamp: new Date(),
        transcript,
        emotion: "neutral",
        context: context || "",
        duration: 0,
      });
    }
    
    await this.saveProfileToMemory(profile);
  }

  private async saveProfileToMemory(profile: VoiceProfile): Promise<void> {
    const content = `Profil vocal: ${profile.name}. ` +
      `Confiance: ${(profile.confidence * 100).toFixed(0)}%. ` +
      `Échantillons: ${profile.samples}. ` +
      `Dernière interaction: ${profile.lastHeardAt.toISOString()}`;
    
    await this.semanticMemory.store(
      content,
      "voice_profile",
      profile.confidence,
      { profileId: profile.id }
    );
  }

  private averageEmbeddings(embeddings: number[][]): number[] {
    const size = embeddings[0].length;
    const avg: number[] = new Array(size).fill(0);
    
    for (const emb of embeddings) {
      for (let i = 0; i < size; i++) {
        avg[i] += emb[i];
      }
    }
    
    return avg.map(v => v / embeddings.length);
  }

  private updateEmbeddingAverage(current: number[], update: number[], weight: number): number[] {
    return current.map((v, i) => v * (1 - weight) + update[i] * weight);
  }

  private aggregateFeatures(features: VoiceFeatures[]): VoiceFeatures {
    const n = features.length;
    
    return {
      mfcc: features[0].mfcc, // Simplifié
      pitch: {
        mean: features.reduce((s, f) => s + f.pitch.mean, 0) / n,
        std: features.reduce((s, f) => s + f.pitch.std, 0) / n,
        min: Math.min(...features.map(f => f.pitch.min)),
        max: Math.max(...features.map(f => f.pitch.max)),
      },
      formants: features[0].formants, // Simplifié
      energy: {
        mean: features.reduce((s, f) => s + f.energy.mean, 0) / n,
        variance: features.reduce((s, f) => s + f.energy.variance, 0) / n,
      },
      zcr: features.reduce((s, f) => s + f.zcr, 0) / n,
      spectral: {
        centroid: features.reduce((s, f) => s + f.spectral.centroid, 0) / n,
        rolloff: features.reduce((s, f) => s + f.spectral.rolloff, 0) / n,
        flux: features.reduce((s, f) => s + f.spectral.flux, 0) / n,
      },
      tempo: {
        wordsPerMinute: features.reduce((s, f) => s + f.tempo.wordsPerMinute, 0) / n,
        pauses: [],
      },
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ============================================================================
  // Getters / Stats
  // ============================================================================

  getStats(): {
    totalProfiles: number;
    knownProfiles: number;
    unknownProfiles: number;
    averageConfidence: number;
    totalSamples: number;
  } {
    const profiles = this.getAllProfiles();
    const known = profiles.filter(p => p.confidence > 0.7);
    
    return {
      totalProfiles: profiles.length,
      knownProfiles: known.length,
      unknownProfiles: profiles.length - known.length,
      averageConfidence: profiles.reduce((s, p) => s + p.confidence, 0) / profiles.length || 0,
      totalSamples: profiles.reduce((s, p) => s + p.samples, 0),
    };
  }
}
