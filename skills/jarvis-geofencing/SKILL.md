---
name: jarvis-geofencing
description: Actions automatiques basées sur la localisation — arrivée et départ du domicile.
implementation: src/autonomy/geofencing/geofencing-manager.ts
class: GeofencingManager
singleton: getGeofencingManager()
metadata: { "openclaw": { "emoji": "📍" } }
---

# Géofencing — Actions Automatiques Arrivée/Départ

Jarvis détecte quand vous arrivez ou partez de chez vous via le node iOS/Android et déclenche automatiquement des actions domotiques.

## Configuration

### Via openclaw.json

```json5
{
  jarvis: {
    geofencing: {
      enabled: true,
      // Coordonnées du domicile
      home: {
        latitude: 48.8566,
        longitude: 2.3522,
        // Rayon en mètres
        radius: 200,
      },

      // Actions à l'arrivée
      onArrive: {
        message: "Je suis arrivé à la maison. Active la routine d'arrivée : allume les lumières du couloir, règle le chauffage à 21°C, et lance ma playlist d'accueil sur le Sonos du salon.",
        // Délai avant exécution (secondes) — pour éviter les faux positifs
        delaySeconds: 30,
      },

      // Actions au départ
      onDepart: {
        message: "Je quitte la maison. Active la routine départ : éteins toutes les lumières, baisse le chauffage à 17°C, ferme les volets, active le mode absent et la simulation de présence.",
        delaySeconds: 60,
      },
    },
  },
}
```

### Via Home Assistant (recommandé)

Si vous utilisez Home Assistant, le géofencing peut être géré directement :

```json5
{
  jarvis: {
    geofencing: {
      enabled: true,
      // Utiliser l'entité device_tracker de Home Assistant
      provider: "home-assistant",
      trackerEntity: "device_tracker.iphone_de_mick",
      zoneEntity: "zone.home",
    },
  },
}
```

## Routines suggérées

### 🏠 Routine Arrivée

```
Quand Jarvis détecte l'arrivée :
1. Allumer lumières couloir (50%)
2. Régler chauffage à 21°C
3. Ouvrir volets (si jour)
4. Lancer playlist "Welcome Home" sur Sonos
5. Désactiver le mode absent
6. Dire le résumé : "Bienvenue. Température : 20°C. 3 notifications. Aucun événement de sécurité."
```

### 🚗 Routine Départ

```
Quand Jarvis détecte le départ :
1. Éteindre toutes les lumières
2. Baisser chauffage à 17°C (économie)
3. Fermer tous les volets
4. Vérifier que portes/fenêtres sont fermées
5. Activer mode absent (détection mouvement)
6. Activer simulation de présence (lumières aléatoires le soir)
7. Confirmer : "Maison sécurisée. Mode absent activé. Bonne journée, Monsieur."
```

## Implémentation via le node mobile

Le node iOS/Android envoie la position via `location.get` :

```bash
# Le gateway interroge le node pour la position
# (automatiquement via le système de nodes intégré)

# Vérifier la position manuellement
jarvis node invoke --node "iphone" --action "location.get"
```

## Configuration via Cron (alternative sans GPS)

Si vous n'avez pas de node mobile, utilisez des horaires fixes :

```json5
{
  cron: {
    jobs: [
      {
        name: "routine-matin",
        schedule: "0 7 * * 1-5", // Lun-Ven à 7h
        message: "Routine matin : ouvre les volets, allume les lumières de la cuisine à 70%, règle le chauffage à 21°C, et donne-moi le briefing météo du jour.",
      },
      {
        name: "routine-depart-travail",
        schedule: "0 8 30 * * 1-5", // Lun-Ven à 8h30
        message: "Routine départ travail : éteins toutes les lumières, baisse le chauffage à 17°C, ferme les volets partiellement, active le mode absent.",
      },
      {
        name: "routine-retour",
        schedule: "0 18 * * 1-5", // Lun-Ven à 18h
        message: "Routine retour : allume les lumières du salon à 60%, règle le chauffage à 21°C, ouvre les volets si il fait encore jour.",
      },
      {
        name: "routine-nuit",
        schedule: "0 23 * * *", // Tous les jours à 23h
        message: "Routine nuit : éteins toutes les lumières sauf veilleuse couloir (5%), ferme tous les volets, baisse le chauffage à 18°C, vérifie que toutes les portes sont fermées, et verrouille la porte d'entrée.",
      },
      {
        name: "routine-weekend-matin",
        schedule: "0 9 * * 0,6", // Samedi-Dimanche à 9h
        message: "Routine weekend matin : ouvre les volets doucement, allume les lumières à 30% en ton chaud, mets une ambiance relaxante sur le Sonos.",
      },
    ],
  },
}
```

## Notes

- Le géofencing via node mobile nécessite l'app iOS/Android connectée au gateway
- Le délai (30-60s) évite les faux positifs quand vous passez près de chez vous
- La simulation de présence allume/éteint des lumières aléatoirement le soir
- Combinez géofencing + notifications pour recevoir un résumé à l'arrivée

---

## TypeScript Integration (Jarvis)

```typescript
import { getGeofencingManager } from "../../autonomy/geofencing/index.js";

const geo = getGeofencingManager({
  provider: "home-assistant",
  trackerEntity: "device_tracker.iphone_de_mick",
  onArrive: { message: "Allume les lumières du couloir.", delaySeconds: 30 },
  onDepart: { message: "Éteins tout et active le mode absent.", delaySeconds: 60 },
});

// Écouter les événements
geo.on("arrive", (event) => console.log("Arrivée détectée", event));
geo.on("depart", (event) => console.log("Départ détecté", event));

// Démarrer le polling
geo.start();

// Mode GPS : pousser une position manuellement
geo.updateGpsPosition({ latitude: 48.8566, longitude: 2.3522 });

// État courant
console.log(geo.getState()); // "home" | "away" | "unknown"
```

### Variables d'environnement requises

- `HOME_ASSISTANT_URL` — ex: `http://homeassistant.local:8123`
- `HOME_ASSISTANT_TOKEN` — token long-lived HA
