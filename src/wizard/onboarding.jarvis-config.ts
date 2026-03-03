/**
 * Jarvis Setup Wizard — Étape de configuration des APIs Jarvis
 *
 * Injectée dans le wizard d'installation OpenClaw après la configuration
 * des canaux de messagerie. Permet de configurer :
 *
 *   1. 🎙️  Module Vocal (Mistral STT + micro)
 *   2. 🏡  Home Assistant (domotique)
 *   3. 🔊  ElevenLabs TTS (voix naturelle)
 *   4. 🤖  Autonomie Jarvis (owner ID + niveau)
 *
 * Architecture :
 *   - Écrit TOUTES les clés et options dans ~/.openclaw/.env (compatibilité Zod strict)
 *   - OpenClawConfig n'est PAS modifié (son Zod schema est .strict() et ne connaît pas autonomy)
 *   - Mode "quickstart" → questions essentielles seulement
 *   - Mode "advanced"   → configuration complète
 */

import path from "node:path";
import fs from "node:fs/promises";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { OpenClawConfig } from "../config/config.js";
import type { WizardFlow } from "./onboarding.types.js";
import type { WizardPrompter } from "./prompts.js";

const log = createSubsystemLogger("wizard:jarvis");

// ============================================================================
// Types
// ============================================================================

export type JarvisWizardResult = {
  /** Config OpenClaw mise à jour */
  nextConfig: OpenClawConfig;
  /** Résumé des APIs configurées pour l'affichage final */
  summary: JarvisSetupSummary;
};

export type JarvisSetupSummary = {
  voiceEnabled: boolean;
  haEnabled: boolean;
  elevenLabsEnabled: boolean;
  autonomyEnabled: boolean;
  ownerConfigured: boolean;
};

// ============================================================================
// Helpers
// ============================================================================

/** Chemin du fichier .env Jarvis */
function resolveJarvisEnvPath(): string {
  return path.join(process.env.HOME ?? process.env.USERPROFILE ?? "~", ".openclaw", ".env");
}

/**
 * Lit le .env existant et retourne les paires clé=valeur comme un objet.
 * Ignore les commentaires et les lignes vides.
 */
async function readEnvFile(envPath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const content = await fs.readFile(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        map.set(trimmed.slice(0, eqIdx).trim(), trimmed.slice(eqIdx + 1).trim());
      }
    }
  } catch {
    // Fichier inexistant — OK
  }
  return map;
}

/**
 * Écrit un Map de clés/valeurs dans un fichier .env.
 * Préserve les commentaires de section existants.
 * Ajoute les nouvelles clés à la fin.
 */
async function writeEnvFile(envPath: string, updates: Map<string, string>): Promise<void> {
  const dir = path.dirname(envPath);
  await fs.mkdir(dir, { recursive: true });

  let existing = "";
  try {
    existing = await fs.readFile(envPath, "utf-8");
  } catch {
    // Nouveau fichier
  }

  // Met à jour les valeurs existantes
  const lines = existing.split("\n");
  const updatedKeys = new Set<string>();

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      if (updates.has(key)) {
        updatedKeys.add(key);
        return `${key}=${updates.get(key)}`;
      }
    }
    return line;
  });

  // Ajoute les nouvelles clés non existantes
  const appendParts: string[] = [];
  for (const [key, value] of updates) {
    if (!updatedKeys.has(key) && value !== "") {
      appendParts.push(`${key}=${value}`);
    }
  }

  const finalContent = [
    newLines.join("\n"),
    appendParts.length > 0 ? "\n# Jarvis — ajouté par le wizard\n" + appendParts.join("\n") : "",
  ]
    .filter(Boolean)
    .join("");

  await fs.writeFile(envPath, finalContent.endsWith("\n") ? finalContent : finalContent + "\n", "utf-8");
}

/** Masque partiellement une clé API pour l'affichage */
function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 6) + "****" + key.slice(-4);
}

/** Teste la connexion à Home Assistant */
async function testHomeAssistant(url: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Teste la clé Mistral STT */
async function testMistralKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Teste la clé ElevenLabs */
async function testElevenLabsKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Étape principale du wizard
// ============================================================================

export async function configureJarvisApis(opts: {
  flow: WizardFlow;
  baseConfig: OpenClawConfig;
  nextConfig: OpenClawConfig;
  prompter: WizardPrompter;
}): Promise<JarvisWizardResult> {
  const { flow, prompter } = opts;
  let { nextConfig } = opts;

  const envPath = resolveJarvisEnvPath();
  const existingEnv = await readEnvFile(envPath);
  const envUpdates = new Map<string, string>();

  const summary: JarvisSetupSummary = {
    voiceEnabled: false,
    haEnabled: false,
    elevenLabsEnabled: false,
    autonomyEnabled: false,
    ownerConfigured: false,
  };

  // ── Introduction ──────────────────────────────────────────────────────────
  await prompter.note(
    [
      "Jarvis peut être beaucoup plus qu'un simple chatbot.",
      "",
      "Avec les bons modules, il peut :",
      "  🎙️  Vous écouter via vos micros à domicile",
      "  🏡  Contrôler vos lumières, volets, thermostat (Home Assistant)",
      "  🔊  Vous répondre avec une vraie voix (ElevenLabs)",
      "  🤖  Apprendre vos habitudes et agir de manière autonome",
      "",
      "Ces fonctionnalités nécessitent des clés API externes.",
      "Vous pouvez tout configurer maintenant ou sauter et revenir plus tard.",
    ].join("\n"),
    "🤖 Configuration Jarvis",
  );

  // ── Choix des modules à activer ───────────────────────────────────────────
  const wantJarvisFeatures = await prompter.confirm({
    message: "Configurer les fonctionnalités avancées de Jarvis maintenant ?",
    initialValue: true,
  });

  if (!wantJarvisFeatures) {
    await prompter.note(
      [
        "Vous pourrez configurer Jarvis plus tard en éditant :",
        `  ~/.openclaw/.env`,
        `  ~/.openclaw/openclaw.json`,
        "",
        "Consultez JARVIS_IMPLEMENTATION_REPORT.md pour le guide complet.",
      ].join("\n"),
      "Configuration différée",
    );
    return { nextConfig, summary };
  }

  const modulesToSetup = await prompter.multiselect<string>({
    message: "Quels modules souhaitez-vous activer ?",
    options: [
      {
        value: "voice",
        label: "🎙️  Module Vocal (Mistral STT)",
        hint: "Parlez à Jarvis via vos micros",
      },
      {
        value: "ha",
        label: "🏡  Home Assistant",
        hint: "Contrôle domotique (lumières, volets, chauffage…)",
      },
      {
        value: "elevenlabs",
        label: "🔊  ElevenLabs TTS",
        hint: "Voix naturelle pour les réponses (optionnel — fallback: espeak/say)",
      },
      {
        value: "autonomy",
        label: "🤖  Autonomie & Notifications",
        hint: "Suggestions proactives et apprentissage des habitudes",
      },
    ],
    initialValues: ["voice", "ha", "autonomy"],
  });

  const wants = (module: string) => modulesToSetup.includes(module);

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 1 : MISTRAL STT (MODULE VOCAL)
  // ═══════════════════════════════════════════════════════════════════════════

  if (wants("voice")) {
    await prompter.note(
      [
        "Le module vocal permet à Jarvis de vous écouter en continu via un micro.",
        "",
        "Pipeline : Micro → sox (VAD) → Mistral STT → Jarvis → TTS",
        "",
        "Prérequis :",
        "  1. Une clé API Mistral → https://console.mistral.ai",
        "  2. sox installé : brew install sox  /  apt install sox",
        "",
        "Wake words : « Jarvis » ou « Hey Jarvis »",
      ].join("\n"),
      "🎙️ Module Vocal",
    );

    const existingMistralKey = existingEnv.get("MISTRAL_API_KEY") ?? existingEnv.get("MISTRAL_STT_API_KEY") ?? "";

    let mistralKey = "";
    if (existingMistralKey) {
      const keepExisting = await prompter.confirm({
        message: `Clé Mistral existante détectée (${maskKey(existingMistralKey)}). La conserver ?`,
        initialValue: true,
      });
      mistralKey = keepExisting ? existingMistralKey : "";
    }

    if (!mistralKey) {
      mistralKey = await prompter.text({
        message: "Clé API Mistral (MISTRAL_API_KEY)",
        placeholder: "ex: votre_clé_mistral",
        validate: (v) => {
          if (!v.trim()) return "La clé ne peut pas être vide";
          return undefined;
        },
      });
    }

    if (mistralKey) {
      // Test de la clé
      const testProgress = prompter.progress("Test de la clé Mistral…");
      const ok = await testMistralKey(mistralKey.trim());
      testProgress.stop(ok ? "✅ Clé Mistral valide" : "⚠️  Impossible de vérifier (mode offline ?)");

      envUpdates.set("MISTRAL_API_KEY", mistralKey.trim());
      envUpdates.set("MISTRAL_STT_MODEL", "mistral-stt");
      envUpdates.set("MISTRAL_STT_LANGUAGE", "fr");

      // Device micro
      let captureDevice = "";
      if (flow === "advanced") {
        await prompter.note(
          [
            "Identifier votre microphone :",
            "  Linux : arecord -l",
            "  macOS : ffmpeg -f avfoundation -list_devices true -i '' 2>&1 | grep audio",
            "",
            "Laisser vide pour utiliser le micro par défaut du système.",
          ].join("\n"),
          "Microphone",
        );

        captureDevice = await prompter.text({
          message: "Device microphone (vide = défaut système)",
          placeholder: "ex: plughw:1,0  ou  :0  (macOS avfoundation)",
          validate: () => undefined, // Optionnel
        });

        if (captureDevice.trim()) {
          envUpdates.set("JARVIS_MIC_DEVICE", captureDevice.trim());
        }
      }

      // Wake words
      const wakeWords =
        flow === "advanced"
          ? await prompter.text({
              message: "Wake words (séparés par des virgules)",
              initialValue: "jarvis,hey jarvis",
              validate: (v) => (!v.trim() ? "Au moins un wake word requis" : undefined),
            })
          : "jarvis,hey jarvis";

      // Écrire les wake words dans .env (évite le Zod strict schema d'OpenClaw)
      const wakeWordList = wakeWords
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);

      envUpdates.set("JARVIS_WAKE_WORDS", wakeWordList.join(","));
      envUpdates.set("JARVIS_VOICE_ENABLED", "true");

      summary.voiceEnabled = true;
      log.info("Module vocal configuré");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 2 : HOME ASSISTANT
  // ═══════════════════════════════════════════════════════════════════════════

  if (wants("ha")) {
    await prompter.note(
      [
        "Home Assistant permet à Jarvis de contrôler tous vos appareils connectés.",
        "",
        "Pour créer un token longue durée :",
        "  1. Home Assistant → Profil utilisateur",
        "  2. Tout en bas → « Tokens d'accès longue durée »",
        "  3. Créez un token et copiez-le",
        "",
        "URL par défaut : http://homeassistant.local:8123",
      ].join("\n"),
      "🏡 Home Assistant",
    );

    const existingHaUrl = existingEnv.get("HOME_ASSISTANT_URL") ?? "";
    const existingHaToken = existingEnv.get("HOME_ASSISTANT_TOKEN") ?? "";

    let haUrl = "";
    let haToken = "";

    if (existingHaUrl && existingHaToken) {
      const keepExisting = await prompter.confirm({
        message: `Home Assistant existant (${existingHaUrl}). Conserver la config ?`,
        initialValue: true,
      });
      if (keepExisting) {
        haUrl = existingHaUrl;
        haToken = existingHaToken;
      }
    }

    if (!haUrl) {
      haUrl = await prompter.text({
        message: "URL Home Assistant",
        initialValue: "http://homeassistant.local:8123",
        placeholder: "http://192.168.1.x:8123",
        validate: (v) => {
          if (!v.trim()) return "URL requise";
          if (!v.startsWith("http")) return "L'URL doit commencer par http:// ou https://";
          return undefined;
        },
      });
    }

    if (!haToken) {
      haToken = await prompter.text({
        message: "Token longue durée Home Assistant",
        placeholder: "ey....",
        validate: (v) => {
          if (!v.trim()) return "Token requis";
          if (v.trim().length < 20) return "Token invalide (trop court)";
          return undefined;
        },
      });
    }

    if (haUrl && haToken) {
      // Test de connexion
      const testProgress = prompter.progress("Test de connexion à Home Assistant…");
      const ok = await testHomeAssistant(haUrl.trim(), haToken.trim());
      testProgress.stop(
        ok
          ? "✅ Connexion Home Assistant réussie"
          : "⚠️  Connexion échouée — vérifiez l'URL et le token (config sauvegardée quand même)",
      );

      envUpdates.set("HOME_ASSISTANT_URL", haUrl.trim());
      envUpdates.set("HOME_ASSISTANT_TOKEN", haToken.trim());

      summary.haEnabled = true;
      log.info("Home Assistant configuré");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 3 : ELEVENLABS TTS
  // ═══════════════════════════════════════════════════════════════════════════

  if (wants("elevenlabs")) {
    await prompter.note(
      [
        "ElevenLabs offre une voix ultra-naturelle pour Jarvis.",
        "Sans clé ElevenLabs, Jarvis utilisera say (macOS) ou espeak-ng (Linux).",
        "",
        "Obtenez une clé gratuite sur https://elevenlabs.io",
        "",
        "Voix françaises recommandées :",
        "  pNInz6obpgDQGcFmaJgB → Adam (défaut, multilingue)",
        "  N2lVS1w4EtoT3dr4eOWO → Callum (grave, dramatique)",
        "  Répertoire complet : https://elevenlabs.io/voice-library",
        "",
        "Prérequis Linux pour la lecture audio : sudo apt install mpg123",
      ].join("\n"),
      "🔊 ElevenLabs TTS",
    );

    const existingXiKey = existingEnv.get("ELEVENLABS_API_KEY") ?? existingEnv.get("XI_API_KEY") ?? "";

    let xiKey = "";
    if (existingXiKey) {
      const keepExisting = await prompter.confirm({
        message: `Clé ElevenLabs existante (${maskKey(existingXiKey)}). La conserver ?`,
        initialValue: true,
      });
      xiKey = keepExisting ? existingXiKey : "";
    }

    if (!xiKey) {
      xiKey = await prompter.text({
        message: "Clé API ElevenLabs (laisser vide pour utiliser le TTS système)",
        placeholder: "sk_...",
        validate: () => undefined, // Optionnel
      });
    }

    if (xiKey.trim()) {
      // Test de la clé
      const testProgress = prompter.progress("Test de la clé ElevenLabs…");
      const ok = await testElevenLabsKey(xiKey.trim());
      testProgress.stop(ok ? "✅ Clé ElevenLabs valide" : "⚠️  Impossible de vérifier la clé");

      envUpdates.set("ELEVENLABS_API_KEY", xiKey.trim());

      // Voice ID
      const useDefaultVoice = flow === "quickstart" ? true : await prompter.confirm({
        message: "Utiliser la voix Adam par défaut (pNInz6obpgDQGcFmaJgB) ?",
        initialValue: true,
      });

      if (!useDefaultVoice) {
        const voiceId = await prompter.text({
          message: "Voice ID ElevenLabs",
          initialValue: "pNInz6obpgDQGcFmaJgB",
          placeholder: "pNInz6obpgDQGcFmaJgB",
          validate: (v) => {
            if (!v.trim()) return "Voice ID requis";
            return undefined;
          },
        });
        envUpdates.set("ELEVENLABS_VOICE_ID", voiceId.trim());
        envUpdates.set("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2");
      } else {
        envUpdates.set("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB");
        envUpdates.set("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2");
      }

      summary.elevenLabsEnabled = true;
      log.info("ElevenLabs TTS configuré");
    } else {
      await prompter.note(
        [
          "TTS système activé par défaut :",
          "  macOS  → say -v Thomas (voix française)",
          "  Linux  → espeak-ng -v fr+m3",
          "  Windows → PowerShell SAPI",
          "",
          "Vous pourrez ajouter ElevenLabs plus tard via ELEVENLABS_API_KEY dans ~/.openclaw/.env",
        ].join("\n"),
        "TTS système (fallback)",
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE 4 : AUTONOMIE & NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  if (wants("autonomy")) {
    await prompter.note(
      [
        "Le module d'autonomie permet à Jarvis de :",
        "  • Apprendre vos habitudes et préférences",
        "  • Vous suggérer des actions de manière proactive",
        "  • Envoyer des notifications sans que vous ayez à demander",
        "",
        "Il a besoin de savoir comment vous contacter :",
        "  → Votre ID Telegram/Discord/WhatsApp",
        "  → Le canal de notification préféré",
      ].join("\n"),
      "🤖 Autonomie Jarvis",
    );

    // Owner ID
    const existingOwnerId = existingEnv.get("JARVIS_OWNER_ID") ?? "";
    let ownerId = "";

    if (existingOwnerId) {
      const keepExisting = await prompter.confirm({
        message: `Owner ID existant (${existingOwnerId}). Le conserver ?`,
        initialValue: true,
      });
      ownerId = keepExisting ? existingOwnerId : "";
    }

    if (!ownerId) {
      ownerId = await prompter.text({
        message: "Votre ID propriétaire (Telegram ID, Discord ID…)",
        placeholder: "ex: 123456789 (Telegram) ou votre@email.com",
        validate: (v) => (!v.trim() ? "ID requis pour les notifications autonomes" : undefined),
      });
    }

    // Canal de notification
    const notificationChannel =
      flow === "quickstart"
        ? "telegram"
        : await prompter.select<string>({
            message: "Canal de notification préféré",
            options: [
              { value: "telegram", label: "Telegram", hint: "Recommandé" },
              { value: "discord", label: "Discord" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "slack", label: "Slack" },
              { value: "imessage", label: "iMessage (macOS seulement)" },
            ],
            initialValue: "telegram",
          });

    // Niveau d'autonomie
    const autonomyLevel =
      flow === "quickstart"
        ? "suggest"
        : await prompter.select<string>({
            message: "Niveau d'autonomie de Jarvis",
            options: [
              {
                value: "none",
                label: "Aucun",
                hint: "Jarvis n'agit jamais de manière autonome",
              },
              {
                value: "suggest",
                label: "Suggestions seulement (recommandé)",
                hint: "Jarvis propose, vous décidez",
              },
              {
                value: "ask",
                label: "Demande confirmation",
                hint: "Jarvis demande avant d'agir",
              },
              {
                value: "act_with_notice",
                label: "Agit avec notification",
                hint: "Jarvis agit et vous prévient",
              },
              {
                value: "full",
                label: "Pleinement autonome",
                hint: "⚠️  Jarvis agit sans confirmation",
              },
            ],
            initialValue: "suggest",
          });

    if (ownerId.trim()) {
      // Tout dans .env — évite le Zod strict schema d'OpenClaw
      envUpdates.set("JARVIS_OWNER_ID", ownerId.trim());
      envUpdates.set("JARVIS_NOTIFICATION_CHANNEL", notificationChannel);
      envUpdates.set("JARVIS_AUTONOMY_LEVEL", autonomyLevel);
      envUpdates.set("JARVIS_AUTONOMY_ENABLED", "true");

      summary.autonomyEnabled = true;
      summary.ownerConfigured = true;
      log.info(`Autonomie configurée — owner=${ownerId}, channel=${notificationChannel}, level=${autonomyLevel}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉCRITURE DES VARIABLES D'ENV
  // ═══════════════════════════════════════════════════════════════════════════

  if (envUpdates.size > 0) {
    const saveProgress = prompter.progress("Sauvegarde de la configuration Jarvis…");
    try {
      await writeEnvFile(envPath, envUpdates);
      saveProgress.stop(`✅ Configuration sauvegardée dans ${envPath}`);
    } catch (err) {
      saveProgress.stop(`⚠️  Erreur de sauvegarde : ${String(err)}`);
      await prompter.note(
        [
          "Impossible d'écrire le fichier .env automatiquement.",
          "Ajoutez manuellement ces variables dans ~/.openclaw/.env :",
          "",
          ...[...envUpdates.entries()].map(([k, v]) => `${k}=${v}`),
        ].join("\n"),
        "Configuration manuelle requise",
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════════════════════════════════════════

  const summaryLines: string[] = [];
  summaryLines.push(summary.voiceEnabled ? "✅ Module vocal (Mistral STT)" : "○  Module vocal — non activé");
  summaryLines.push(summary.haEnabled ? "✅ Home Assistant (domotique)" : "○  Home Assistant — non activé");
  summaryLines.push(summary.elevenLabsEnabled ? "✅ ElevenLabs TTS (voix naturelle)" : "○  ElevenLabs TTS — TTS système utilisé");
  summaryLines.push(summary.autonomyEnabled ? `✅ Autonomie Jarvis (owner configuré)` : "○  Autonomie — non activée");
  summaryLines.push("");
  summaryLines.push(`Config : ~/.openclaw/.env`);
  summaryLines.push(`Rapport : JARVIS_IMPLEMENTATION_REPORT.md`);

  if (summary.voiceEnabled) {
    summaryLines.push("");
    summaryLines.push("Pour démarrer le module vocal :");
    summaryLines.push("  bash skills/mistral-stt/scripts/test-transcribe.sh");
  }

  await prompter.note(summaryLines.join("\n"), "🤖 Jarvis — Configuration terminée");

  return { nextConfig, summary };
}
