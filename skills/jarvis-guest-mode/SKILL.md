---
name: jarvis-guest-mode
description: Mode invité — profil restreint pour protéger la vie privée quand vous avez des visiteurs.
implementation: src/autonomy/guest-mode/guest-mode-manager.ts
class: GuestModeManager
singleton: getGuestModeManager()
metadata: { "openclaw": { "emoji": "👤" } }
---

# Mode Invité — Profil Restreint

Quand vous recevez des invités, activez le mode invité pour restreindre les capacités de Jarvis et protéger votre vie privée.

## Concept

Le mode invité :

- ✅ Permet le contrôle basique (lumières, musique, température)
- ❌ Bloque l'accès aux messages personnels
- ❌ Bloque l'exécution de commandes système
- ❌ Bloque l'accès aux fichiers personnels
- ❌ Bloque les informations de sécurité (caméras, serrures, alarme)
- ✅ Répond aux questions générales (météo, heure, culture générale)

## Activation / Désactivation

```
"Jarvis, mode invité"
→ Active le mode invité

"Jarvis, fin du mode invité"
→ Désactive le mode invité (peut nécessiter un code PIN)

"Jarvis, mode invité avec code 1234"
→ Active le mode invité avec un code PIN pour la désactivation
```

## Configuration

Ajoutez dans `~/.openclaw/openclaw.json` :

```json5
{
  jarvis: {
    guestMode: {
      // Code PIN pour désactiver le mode invité (optionnel)
      pin: "1234",

      // Outils autorisés en mode invité
      allowedTools: [
        "light", // Contrôle lumières
        "music", // Contrôle musique (Sonos)
        "temperature", // Lecture température (pas modification)
        "weather", // Météo
        "time", // Heure
      ],

      // Outils bloqués en mode invité
      blockedTools: [
        "bash", // Pas de commandes système
        "browser", // Pas de navigation web
        "read", // Pas de lecture de fichiers
        "write", // Pas d'écriture de fichiers
        "edit", // Pas d'édition de fichiers
        "sessions", // Pas d'accès aux sessions
        "cron", // Pas de modification des automatisations
        "camera", // Pas d'accès caméras
        "lock", // Pas de contrôle serrures
        "alarm", // Pas de contrôle alarme
      ],

      // Pièces accessibles en mode invité
      allowedRooms: ["salon", "cuisine", "salle_de_bain_invites"],

      // Limite de température ajustable
      tempRange: { min: 19, max: 23 },

      // Message d'accueil en mode invité
      welcomeMessage: "Mode invité activé. Je peux contrôler les lumières et la musique des espaces communs. Pour toute autre demande, veuillez contacter le propriétaire.",

      // Réponse quand une action bloquée est demandée
      blockedMessage: "Désolé, cette fonctionnalité n'est pas disponible en mode invité.",

      // Désactivation automatique (heures)
      autoDisableHours: 12,
    },
  },
}
```

## Prompt système en mode invité

Quand le mode invité est activé, Jarvis ajuste son comportement via le prompt :

```markdown
## Mode Invité Actif

Tu es en mode invité. Règles strictes :

1. Tu peux UNIQUEMENT contrôler : lumières, musique, et lire la température
2. Tu ne peux PAS : lire/écrire des fichiers, exécuter des commandes, accéder aux caméras/serrures/alarme
3. Tu ne révèles AUCUNE information personnelle (messages, calendrier, contacts, historique)
4. Si on te demande quelque chose de bloqué, réponds : "Cette fonctionnalité n'est pas disponible en mode invité."
5. Tu restes poli et serviable pour les demandes autorisées
6. Les pièces accessibles sont : salon, cuisine, salle de bain invités
7. Tu ne modifies pas la température en dehors de 19-23°C
```

## Scénarios d'utilisation

### Soirée avec des amis

```
Vous : "Jarvis, mode invité"
Jarvis : "Mode invité activé. Vos invités peuvent contrôler les lumières et la musique du salon et de la cuisine."

Invité : "Jarvis, mets de la musique"
Jarvis : "Que souhaitez-vous écouter ? Je peux lancer une playlist sur le Sonos du salon."

Invité : "Jarvis, montre les caméras"
Jarvis : "Désolé, cette fonctionnalité n'est pas disponible en mode invité."

Invité : "Jarvis, lis les messages WhatsApp"
Jarvis : "Désolé, cette fonctionnalité n'est pas disponible en mode invité."

Vous : "Jarvis, fin du mode invité, code 1234"
Jarvis : "Mode invité désactivé. Accès complet restauré."
```

### Airbnb / Location

```json5
{
  jarvis: {
    guestMode: {
      pin: "9876",
      // Mode plus restrictif pour location
      allowedRooms: ["*"], // Toutes les pièces
      blockedTools: [
        "bash",
        "browser",
        "read",
        "write",
        "edit",
        "sessions",
        "cron",
        "camera",
        "lock",
        "alarm",
        "phone",
        "message",
      ],
      tempRange: { min: 18, max: 25 },
      autoDisableHours: null, // Ne pas désactiver automatiquement
      welcomeMessage: "Bienvenue ! Je suis Jarvis, votre assistant. Je peux contrôler les lumières, la musique et la climatisation. N'hésitez pas à me demander des informations sur le quartier !",
    },
  },
}
```

## Implémentation via Home Assistant

Le mode invité peut aussi être synchronisé avec Home Assistant :

```bash
# Activer le mode invité dans HA
curl -s -X POST -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "input_boolean.mode_invite"}' \
  "$HOME_ASSISTANT_URL/api/services/input_boolean/turn_on"
```

## Notes

- Le mode invité est une couche logicielle — il ne remplace pas la sécurité réseau
- Le code PIN est stocké en clair dans la config — utiliser pour du contrôle basique, pas de la haute sécurité
- Combinable avec le géofencing : auto-activer quand un appareil inconnu se connecte au WiFi
- La désactivation auto (12h par défaut) évite d'oublier le mode invité actif

---

## TypeScript Integration (Jarvis)

```typescript
import { getGuestModeManager } from "../../autonomy/guest-mode/index.js";

const guestMode = getGuestModeManager({
  pin: "1234",
  allowedTools: ["light", "music", "weather"],
  allowedRooms: ["salon", "cuisine"],
  tempRange: { min: 19, max: 23 },
  autoDisableHours: 12,
});

// Activer
const result = guestMode.activate("owner");
console.log(result.message); // Message d'accueil

// Vérifier si un outil est autorisé
if (!guestMode.isToolAllowed("bash")) {
  return guestMode.config.blockedMessage;
}

// Obtenir le prompt système à injecter
const prompt = guestMode.getSystemPromptInjection();

// Désactiver avec PIN
guestMode.deactivate("1234");

// Via commande vocale
const response = guestMode.handleCommand("Jarvis, mode invité", "1234");
```
