---
name: jarvis-habits
description: Jarvis apprend vos habitudes et propose des automatisations personnalisées.
implementation: src/autonomy/habits/habits-tracker.ts
class: HabitsTracker
singleton: getHabitsTracker()
metadata: { "openclaw": { "emoji": "🧠" } }
---

# Apprentissage des Habitudes — IA Adaptative

Jarvis observe vos patterns d'utilisation et propose des automatisations intelligentes basées sur vos habitudes.

## Concept

Jarvis utilise sa mémoire (`MEMORY.md` et `memory/*.md`) pour :

1. **Observer** — Enregistrer les actions récurrentes
2. **Détecter** — Identifier les patterns (horaires, séquences, conditions)
3. **Proposer** — Suggérer des automatisations
4. **Implémenter** — Créer des cron jobs ou des routines automatiquement

## Configuration

Ajoutez dans `~/.openclaw/openclaw.json` :

```json5
{
  jarvis: {
    habits: {
      enabled: true,
      // Nombre minimum de répétitions avant de proposer une automatisation
      minOccurrences: 3,
      // Fenêtre d'observation (jours)
      observationWindowDays: 14,
      // Proposer les automatisations plutôt que les créer directement
      askBeforeAutomating: true,
    },
  },
}
```

## Fichier mémoire des habitudes

Jarvis maintient un fichier `memory/habits.md` dans son workspace :

```markdown
# Habitudes Observées

## Patterns confirmés

- **Lumières salon 19h** : Depuis 2 semaines, les lumières du salon sont allumées à ~19h en semaine (8/10 jours)
  → Automatisation créée : cron "0 19 \* \* 1-5"

- **Chauffage baissé 23h** : Le chauffage passe à 18°C vers 23h tous les soirs (12/14 jours)
  → Automatisation créée : cron "0 23 \* \* \*"

## Patterns en observation

- **Volets fermés 20h30** : Observé 2/5 soirs — en attente de confirmation
- **Musique cuisine matin** : Spotify lancé dans la cuisine 3 matins cette semaine

## Propositions en attente

- [ ] Fermer les volets automatiquement à 20h30 ?
- [ ] Lancer une playlist matinale dans la cuisine à 7h15 ?
```

## Commandes

```
"Jarvis, quelles sont mes habitudes ?"
→ Affiche les patterns détectés et les propositions en attente

"Jarvis, automatise les lumières du salon à 19h"
→ Crée un cron job pour allumer les lumières tous les soirs à 19h

"Jarvis, arrête l'automatisation des volets"
→ Désactive un cron job spécifique

"Jarvis, qu'est-ce que tu as appris cette semaine ?"
→ Résumé des nouveaux patterns détectés

"Jarvis, propose des automatisations"
→ Analyse les patterns et propose de nouvelles routines
```

## Implémentation

### Prompt système recommandé (AGENTS.md / TOOLS.md)

Ajoutez dans votre workspace `AGENTS.md` :

```markdown
## Apprentissage des habitudes

Tu dois observer et apprendre les habitudes de l'utilisateur :

1. À chaque interaction domotique, note mentalement l'heure et l'action dans memory/habits.md
2. Après 3+ répétitions d'un même pattern, propose une automatisation
3. Utilise le format : "J'ai remarqué que vous [action] vers [heure] depuis [durée]. Voulez-vous que j'automatise ça ?"
4. Si l'utilisateur accepte, crée un cron job approprié
5. Si l'utilisateur refuse, note le refus et ne repropose pas avant 30 jours

Patterns à surveiller :

- Horaires récurrents (lumières, chauffage, volets)
- Séquences d'actions (allumer TV → baisser lumières → fermer volets)
- Conditions météo (fermer volets quand il fait chaud)
- Jours de la semaine vs weekend
```

### Cron de vérification hebdomadaire

```json5
{
  cron: {
    jobs: [
      {
        name: "jarvis-habit-analysis",
        schedule: "0 20 * * 0", // Dimanche à 20h
        message: "Analyse mes habitudes domotiques de la semaine. Lis memory/habits.md, vérifie les patterns en observation, et propose de nouvelles automatisations si des patterns sont confirmés (3+ occurrences). Met à jour le fichier habits.md.",
      },
    ],
  },
}
```

## Types de patterns détectés

| Type             | Exemple                | Auto-détection        |
| ---------------- | ---------------------- | --------------------- |
| **Horaire fixe** | Lumières à 19h         | ✅ Facile             |
| **Séquence**     | TV → Lumières → Volets | ✅ Moyen              |
| **Conditionnel** | Volets si T° > 25°C    | ⚠️ Nécessite capteurs |
| **Jour/Weekend** | Musique weekend matin  | ✅ Facile             |
| **Saisonnier**   | Chauffage en hiver     | ⚠️ Long terme         |

## Notes

- L'apprentissage utilise la mémoire workspace — pas de tracking externe
- Les automatisations proposées sont toujours soumises à approbation (sauf si `askBeforeAutomating: false`)
- Les habitudes sont stockées dans `~/.openclaw/memory/habits.json` — modifiable manuellement
- La suppression du fichier habits.json réinitialise l'apprentissage

---

## TypeScript Integration (Jarvis)

```typescript
import { getHabitsTracker } from "../../autonomy/habits/index.js";

const tracker = getHabitsTracker({
  minOccurrences: 3,
  observationWindowDays: 14,
  askBeforeAutomating: true,
});

await tracker.init();

// Enregistrer une action domotique
await tracker.recordAction("allume lumières salon", ["light.salon"]);
await tracker.recordAction("règle thermostat 21°C", ["climate.salon"]);

// Obtenir le résumé des habitudes
console.log(tracker.getSummary());

// Propositions en attente
const proposals = tracker.getProposals();

// Accepter / refuser une proposition
await tracker.acceptProposal("allume lumières salon");
await tracker.rejectProposal("règle thermostat 21°C");
```

Les patterns sont persistés dans `~/.openclaw/memory/habits.json` et rechargés au démarrage.
