---
name: jarvis-notifications
description: Système de notifications intelligentes pour la domotique — alertes sécurité, température, énergie.
implementation: src/autonomy/notifications/smart-notifier.ts
class: SmartNotifier
singleton: getSmartNotifier()
metadata: { "openclaw": { "emoji": "🚨" } }
---

# Notifications Intelligentes — Alertes Domotique

Jarvis surveille votre maison et envoie des alertes sur WhatsApp, Telegram, Discord, ou tout canal configuré.

## Configuration

Ajoutez dans `~/.openclaw/openclaw.json` :

```json5
{
  // Notifications domotique
  jarvis: {
    notifications: {
      enabled: true,
      // Canal par défaut pour les alertes (WhatsApp, Telegram, Discord, etc.)
      defaultChannel: "whatsapp",
      // Numéro/ID de destination
      defaultRecipient: "+33612345678",

      // Types d'alertes activées
      alerts: {
        // 🚨 Sécurité
        motion: {
          enabled: true,
          // Ne notifier que quand mode absent est actif
          onlyWhenAway: true,
          // Cooldown entre les alertes (minutes)
          cooldownMinutes: 5,
          // Entités Home Assistant à surveiller
          entities: [
            "binary_sensor.mouvement_entree",
            "binary_sensor.mouvement_jardin",
          ],
        },

        // 🌡️ Température
        temperature: {
          enabled: true,
          // Seuils d'alerte
          minTemp: 15, // Alerte si < 15°C
          maxTemp: 30, // Alerte si > 30°C
          entities: ["sensor.temperature_salon", "sensor.temperature_chambre"],
        },

        // 🔓 Portes/Fenêtres
        openings: {
          enabled: true,
          // Alerter si ouvert plus de X minutes
          maxOpenMinutes: 30,
          entities: [
            "binary_sensor.porte_entree",
            "binary_sensor.fenetre_salon",
          ],
        },

        // ⚡ Énergie
        energy: {
          enabled: true,
          // Seuil de consommation anormale (watts)
          maxWatts: 3000,
          entities: ["sensor.consommation_totale"],
        },

        // 💧 Fuite d'eau
        water: {
          enabled: true,
          entities: ["binary_sensor.fuite_cuisine", "binary_sensor.fuite_sdb"],
        },

        // 🔥 Fumée/CO2
        smoke: {
          enabled: true,
          // Priorité maximale — toujours notifier
          alwaysNotify: true,
          entities: ["binary_sensor.detecteur_fumee"],
        },
      },
    },
  },
}
```

## Utilisation avec Cron

Configurez des vérifications périodiques via le système cron intégré :

```json5
{
  cron: {
    jobs: [
      {
        // Vérifier les capteurs toutes les 5 minutes
        name: "jarvis-security-check",
        schedule: "*/5 * * * *",
        message: "Vérifie l'état de tous les capteurs de sécurité (mouvement, portes, fenêtres, fumée). Si quelque chose est anormal et que le mode absent est actif, envoie une alerte sur WhatsApp.",
      },
      {
        // Rapport de température toutes les heures
        name: "jarvis-temp-check",
        schedule: "0 * * * *",
        message: "Vérifie les températures de toutes les pièces. Si une température est anormale (< 15°C ou > 30°C), envoie une alerte.",
      },
      {
        // Rapport énergie quotidien
        name: "jarvis-energy-report",
        schedule: "0 22 * * *",
        message: "Génère un rapport de consommation électrique de la journée et envoie-le sur Telegram.",
      },
      {
        // Vérification portes/fenêtres le soir
        name: "jarvis-night-check",
        schedule: "0 23 * * *",
        message: "Vérifie que toutes les portes et fenêtres sont fermées. Si ce n'est pas le cas, envoie une alerte et propose de les fermer.",
      },
    ],
  },
}
```

## Commandes manuelles

```
"Jarvis, état de la sécurité"
→ Vérifie tous les capteurs et rapporte l'état

"Jarvis, active le mode absent"
→ Active les détections de mouvement et les alertes

"Jarvis, envoie-moi une alerte si la porte reste ouverte"
→ Surveillance ponctuelle

"Jarvis, rapport énergie de la semaine"
→ Résumé de consommation

"Jarvis, température de toutes les pièces"
→ État instantané des capteurs
```

## Implémentation via Home Assistant

Les notifications utilisent l'API Home Assistant pour consulter les capteurs :

```bash
# Vérifier un capteur de mouvement
curl -s -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  "$HOME_ASSISTANT_URL/api/states/binary_sensor.mouvement_entree" | jq '.state'
# Résultat : "on" (mouvement détecté) ou "off"

# Vérifier température
curl -s -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  "$HOME_ASSISTANT_URL/api/states/sensor.temperature_salon" | jq '.state'
# Résultat : "21.5"

# Vérifier une porte
curl -s -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  "$HOME_ASSISTANT_URL/api/states/binary_sensor.porte_entree" | jq '.state'
# Résultat : "on" (ouverte) ou "off" (fermée)
```

## Envoi d'alertes

Jarvis envoie les alertes via la commande CLI intégrée :

```bash
# Envoyer une alerte WhatsApp
jarvis message send --to "+33612345678" --message "🚨 Mouvement détecté à l'entrée ! (23:45)"

# Envoyer sur Telegram
jarvis message send --channel telegram --to "chat_id" --message "🌡️ Température salon : 32°C — seuil dépassé !"

# Envoyer sur Discord
jarvis message send --channel discord --to "channel_id" --message "🔓 Porte d'entrée ouverte depuis 45 minutes"
```

## Notes

- Les notifications nécessitent Home Assistant (ou MQTT) pour lire les capteurs
- Le canal de notification doit être configuré et connecté dans Jarvis
- Le mode absent peut être géré via une entité Home Assistant `input_boolean.mode_absent`
- Les alertes fumée/CO2 ignorent le cooldown et le mode — elles notifient toujours

---

## TypeScript Integration (Jarvis)

```typescript
import { getSmartNotifier } from "../../autonomy/notifications/index.js";

const notifier = getSmartNotifier({
  pollIntervalSeconds: 60,
  awayEntity: "input_boolean.mode_absent",
  alerts: {
    motion: {
      enabled: true,
      onlyWhenAway: true,
      cooldownMinutes: 5,
      entities: ["binary_sensor.mouvement_entree", "binary_sensor.mouvement_jardin"],
    },
    temperature: {
      enabled: true,
      minTemp: 15,
      maxTemp: 30,
      entities: ["sensor.temperature_salon", "sensor.temperature_chambre"],
    },
    openings: {
      enabled: true,
      maxOpenMinutes: 30,
      entities: ["binary_sensor.porte_entree", "binary_sensor.fenetre_salon"],
    },
    smoke: {
      enabled: true,
      alwaysNotify: true,
      entities: ["binary_sensor.detecteur_fumee"],
    },
  },
});

// Démarrer le polling
notifier.start();

// Rapport instantané
const report = await notifier.getSecurityReport();

// Mode absent manuel
notifier.setAwayMode(true);

// Historique des alertes récentes
const recent = notifier.getRecentAlerts(10);
```

### Variables d'environnement requises

- `HOME_ASSISTANT_URL` — ex: `http://homeassistant.local:8123`
- `HOME_ASSISTANT_TOKEN` — token long-lived HA
- `JARVIS_OWNER_ID` — ID du destinataire des notifications
