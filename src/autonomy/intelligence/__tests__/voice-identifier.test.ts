import { describe, it, expect, beforeEach } from "vitest";
import { VoiceIdentifier } from "../voice-identifier.js";
import { SemanticMemory } from "../semantic-memory.js";

describe("VoiceIdentifier", () => {
  let voiceId: VoiceIdentifier;
  let memory: SemanticMemory;

  beforeEach(() => {
    memory = new SemanticMemory(100, 64);
    voiceId = new VoiceIdentifier(memory);
  });

  describe("enrollVoice", () => {
    it("should create a voice profile with samples", async () => {
      const samples = [
        new Float32Array(32000).map(() => Math.random() * 2 - 1),
        new Float32Array(32000).map(() => Math.random() * 2 - 1),
        new Float32Array(32000).map(() => Math.random() * 2 - 1),
      ];

      const profile = await voiceId.enrollVoice("TestUser", samples, "user_123", {
        gender: "male",
        language: "fr",
      });

      expect(profile).toBeDefined();
      expect(profile.name).toBe("TestUser");
      expect(profile.userId).toBe("user_123");
      expect(profile.samples).toBe(3);
      expect(profile.confidence).toBeGreaterThan(0);
      expect(profile.embedding).toHaveLength(128);
      expect(profile.metadata.gender).toBe("male");
    });

    it("should throw error with empty samples", async () => {
      await expect(voiceId.enrollVoice("Test", [])).rejects.toThrow(
        "Au moins un échantillon audio requis"
      );
    });
  });

  describe("identifySpeaker", () => {
    it("should recognize a known speaker", async () => {
      // Enregistrer un profil
      const samples = [new Float32Array(32000).map(() => 0.5 + Math.random() * 0.3)];
      await voiceId.enrollVoice("KnownUser", samples, "user_known");

      // Reconnaître avec un échantillon similaire
      const audioData = new Float32Array(32000).map(() => 0.5 + Math.random() * 0.3);
      const result = await voiceId.identifySpeaker(audioData, "Hello");

      expect(result.isKnown).toBe(true);
      expect(result.name).toBe("KnownUser");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should detect unknown speaker", async () => {
      // Pas de profil enregistré
      const audioData = new Float32Array(32000).map(() => Math.random() * 2 - 1);
      const result = await voiceId.identifySpeaker(audioData, "Hello");

      expect(result.isKnown).toBe(false);
      expect(result.name).toContain("Inconnu");
      expect(result.confidence).toBe(0);
    });

    it("should provide alternatives when uncertain", async () => {
      // Enregistrer deux profils similaires
      await voiceId.enrollVoice("User1", [new Float32Array(32000).map(() => 0.4)]);
      await voiceId.enrollVoice("User2", [new Float32Array(32000).map(() => 0.45)]);

      // Tester avec un échantillon intermédiaire
      const audioData = new Float32Array(32000).map(() => 0.42);
      const result = await voiceId.identifySpeaker(audioData, "Hello");

      expect(result.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe("learnFromInteraction", () => {
    it("should improve confidence with more interactions", async () => {
      // Enregistrer un profil
      const profile = await voiceId.enrollVoice("Learner", [
        new Float32Array(32000).map(() => 0.5),
      ]);

      const initialConfidence = profile.confidence;

      // Apprendre de plusieurs interactions
      for (let i = 0; i < 5; i++) {
        const audioData = new Float32Array(32000).map(() => 0.5 + Math.random() * 0.1);
        await voiceId.learnFromInteraction(profile.id, audioData, "Test", "neutral", "test");
      }

      const updatedProfile = voiceId.getProfile(profile.id);
      expect(updatedProfile!.confidence).toBeGreaterThan(initialConfidence);
      expect(updatedProfile!.samples).toBe(6); // 1 initial + 5 apprentissages
    });

    it("should add to history", async () => {
      const profile = await voiceId.enrollVoice("HistoryUser", [
        new Float32Array(32000).map(() => 0.5),
      ]);

      await voiceId.learnFromInteraction(
        profile.id,
        new Float32Array(32000),
        "Hello Jarvis",
        "happy",
        "salon"
      );

      const updatedProfile = voiceId.getProfile(profile.id);
      expect(updatedProfile!.history.length).toBe(1);
      expect(updatedProfile!.history[0].transcript).toBe("Hello Jarvis");
      expect(updatedProfile!.history[0].emotion).toBe("happy");
    });
  });

  describe("verifySameSpeaker", () => {
    it("should confirm same speaker", async () => {
      const sample1 = new Float32Array(32000).map(() => 0.5);
      const sample2 = new Float32Array(32000).map(() => 0.51);

      const result = await voiceId.verifySameSpeaker(sample1, sample2);

      expect(result.same).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should detect different speakers", async () => {
      const sample1 = new Float32Array(32000).map(() => 0.2);
      const sample2 = new Float32Array(32000).map(() => 0.8);

      const result = await voiceId.verifySameSpeaker(sample1, sample2);

      expect(result.same).toBe(false);
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe("profile management", () => {
    it("should get profile by name", async () => {
      await voiceId.enrollVoice("NamedUser", [new Float32Array(32000)]);

      const profile = voiceId.getProfileByName("NamedUser");

      expect(profile).toBeDefined();
      expect(profile!.name).toBe("NamedUser");
    });

    it("should update profile name", async () => {
      const profile = await voiceId.enrollVoice("OldName", [new Float32Array(32000)]);

      const updated = await voiceId.updateProfileName(profile.id, "NewName");

      expect(updated!.name).toBe("NewName");
      expect(voiceId.getProfileByName("NewName")).toBeDefined();
    });

    it("should link profile to user", async () => {
      const profile = await voiceId.enrollVoice("Unlinked", [new Float32Array(32000)]);

      const linked = await voiceId.linkProfileToUser(profile.id, "user_789");

      expect(linked!.userId).toBe("user_789");
    });

    it("should delete profile", async () => {
      const profile = await voiceId.enrollVoice("ToDelete", [new Float32Array(32000)]);

      const deleted = await voiceId.deleteProfile(profile.id);

      expect(deleted).toBe(true);
      expect(voiceId.getProfile(profile.id)).toBeUndefined();
    });

    it("should merge profiles", async () => {
      const profile1 = await voiceId.enrollVoice("UserA", [
        new Float32Array(32000).map(() => 0.5),
      ]);
      const profile2 = await voiceId.enrollVoice("UserB", [
        new Float32Array(32000).map(() => 0.52),
      ]);

      const merged = await voiceId.mergeProfiles(profile1.id, profile2.id);

      expect(merged).toBeDefined();
      expect(merged!.samples).toBe(2);
      expect(voiceId.getProfile(profile2.id)).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      // Créer des profils avec différents niveaux de confiance
      await voiceId.enrollVoice("HighConf", [
        new Float32Array(32000),
        new Float32Array(32000),
        new Float32Array(32000),
      ]);

      const stats = voiceId.getStats();

      expect(stats.totalProfiles).toBe(1);
      expect(stats.knownProfiles).toBeGreaterThanOrEqual(0);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.totalSamples).toBe(3);
    });
  });
});
