# 🖥️ Interface de Visualisation de l'Autonomie

Interface utilisateur pour visualiser et gérer le système d'autonomie de Jarvis.

## Composants

### `autonomy-dashboard`
Dashboard principal avec navigation par onglets.

**Attributs:**
- `stats`: Statistiques globales
- `config`: Configuration actuelle

**Événements:**
- `level-change`: Changement de niveau d'autonomie

### `autonomy-patterns-view`
Liste et gestion des patterns comportementaux.

**Fonctionnalités:**
- Recherche textuelle
- Filtres par confiance
- Indicateurs de tendance
- Modification/Suppression

### `autonomy-goals-view`
Visualisation des objectifs avec progression.

**Fonctionnalités:**
- Cartes avec barres de progression
- Statuts visuels
- Actions contextuelles
- Badges auto/manuel

### `autonomy-knowledge-view`
Exploration du graphe de connaissances.

**Fonctionnalités:**
- Mode liste avec filtres
- Mode graphe (placeholder)
- Statistiques par type
- Détails des nœuds

### `autonomy-decisions-view`
Historique des décisions autonomes.

**Fonctionnalités:**
- Taux de succès visuel
- Feedback utilisateur
- Filtres par statut
- Mini-graphique d'activité

### `autonomy-timeline-view`
Chronologie des événements.

**Fonctionnalités:**
- Timeline verticale
- Regroupement par date
- Types d'événements colorés
- Métadonnées contextuelles

## Utilisation

```typescript
import "./autonomy/index.js";

// Utiliser dans HTML
<autonomy-dashboard></autonomy-dashboard>
```

## Styles

Les composants utilisent Lit avec Shadow DOM et styles encapsulés.

```css
/* Personnalisation via CSS parts */
autonomy-dashboard::part(header) {
  background: linear-gradient(135deg, #custom 0%, #colors 100%);
}
```

## Développement

```bash
# Démarrer le serveur de dev
cd ui
npm run dev

# Ouvrir demo.html
open http://localhost:5173/src/ui/autonomy/demo.html
```
