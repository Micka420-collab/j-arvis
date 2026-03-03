---
name: jarvis-dashboard
description: Dashboard domotique Canvas — interface visuelle temps réel pour le contrôle de la maison.
implementation: src/autonomy/dashboard/jarvis-dashboard.ts
class: JarvisDashboard
singleton: new JarvisDashboard(config)
metadata: { "openclaw": { "emoji": "📊" } }
---

# Dashboard Domotique Canvas — Interface Visuelle

Jarvis peut afficher un dashboard domotique temps réel via le système Canvas/A2UI intégré.

## Concept

Le dashboard Canvas est une interface web pilotée par l'IA qui affiche :

- 🏠 Vue d'ensemble de la maison (par pièce)
- 🌡️ Températures et humidité en temps réel
- 💡 État des lumières (on/off, luminosité, couleur)
- 🪟 État des volets (ouvert/fermé/position)
- 🔒 État sécurité (portes, fenêtres, alarme)
- ⚡ Consommation énergie
- 🎵 Musique en cours (Sonos)
- 📹 Flux caméras (via Home Assistant)

## Activation

```
"Jarvis, ouvre le dashboard"
→ Ouvre l'interface Canvas avec le dashboard domotique

"Jarvis, montre l'état de la maison"
→ Génère une vue synthétique dans le Canvas

"Jarvis, dashboard salon"
→ Dashboard focalisé sur une pièce
```

## Configuration Canvas

Le Canvas est accessible via :

- **macOS app** — Fenêtre Canvas intégrée
- **iOS app** — Vue Canvas dans l'app
- **WebChat** — Interface web dans le navigateur
- **URL directe** — `http://localhost:18789/__openclaw__/canvas/`

## Template HTML du Dashboard

Jarvis peut pousser ce template dans le Canvas via `canvas.push` :

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Jarvis — Dashboard Domotique</title>
    <style>
      :root {
        --bg: #0a0a1a;
        --card: #12122a;
        --accent: #00d4ff;
        --success: #00ff88;
        --warning: #ffaa00;
        --danger: #ff4444;
        --text: #e0e0ff;
        --text-dim: #6060a0;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family:
          "SF Pro Display",
          -apple-system,
          sans-serif;
        background: var(--bg);
        color: var(--text);
        min-height: 100vh;
        padding: 20px;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
        padding: 20px;
      }
      .header h1 {
        font-size: 2em;
        background: linear-gradient(135deg, var(--accent), #7c3aed);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 5px;
      }
      .header .subtitle {
        color: var(--text-dim);
        font-size: 0.9em;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
        max-width: 1400px;
        margin: 0 auto;
      }
      .card {
        background: var(--card);
        border-radius: 16px;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        transition: all 0.3s ease;
      }
      .card:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(0, 212, 255, 0.1);
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      .card-title {
        font-size: 1.1em;
        font-weight: 600;
      }
      .card-icon {
        font-size: 1.5em;
      }
      .metric {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      }
      .metric:last-child {
        border-bottom: none;
      }
      .metric-label {
        color: var(--text-dim);
        font-size: 0.85em;
      }
      .metric-value {
        font-weight: 600;
        font-size: 1.1em;
      }
      .status-on {
        color: var(--success);
      }
      .status-off {
        color: var(--text-dim);
      }
      .status-warning {
        color: var(--warning);
      }
      .status-danger {
        color: var(--danger);
      }
      .temp-display {
        font-size: 2.5em;
        font-weight: 700;
        text-align: center;
        padding: 15px;
        background: linear-gradient(135deg, var(--accent), #7c3aed);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .energy-bar {
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        margin-top: 10px;
        overflow: hidden;
      }
      .energy-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.5s ease;
      }
      .security-status {
        text-align: center;
        padding: 20px;
      }
      .security-icon {
        font-size: 3em;
        margin-bottom: 10px;
      }
      .btn {
        display: inline-block;
        padding: 8px 16px;
        border-radius: 8px;
        border: 1px solid var(--accent);
        color: var(--accent);
        background: transparent;
        cursor: pointer;
        font-size: 0.85em;
        transition: all 0.2s;
      }
      .btn:hover {
        background: var(--accent);
        color: var(--bg);
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>🤖 Jarvis Dashboard</h1>
      <div class="subtitle">
        Maison connectée — Mise à jour : <span id="time"></span>
      </div>
    </div>

    <div class="grid">
      <!-- Salon -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🛋️ Salon</span>
          <span class="card-icon">💡</span>
        </div>
        <div class="temp-display" id="temp-salon">21.5°C</div>
        <div class="metric">
          <span class="metric-label">Lumières</span>
          <span class="metric-value status-on" id="light-salon"
            >● ON (70%)</span
          >
        </div>
        <div class="metric">
          <span class="metric-label">Volets</span>
          <span class="metric-value" id="cover-salon">Ouverts</span>
        </div>
        <div class="metric">
          <span class="metric-label">Humidité</span>
          <span class="metric-value" id="humidity-salon">45%</span>
        </div>
      </div>

      <!-- Chambre -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🛏️ Chambre</span>
          <span class="card-icon">🌙</span>
        </div>
        <div class="temp-display" id="temp-chambre">19.8°C</div>
        <div class="metric">
          <span class="metric-label">Lumières</span>
          <span class="metric-value status-off" id="light-chambre">○ OFF</span>
        </div>
        <div class="metric">
          <span class="metric-label">Volets</span>
          <span class="metric-value" id="cover-chambre">Fermés</span>
        </div>
      </div>

      <!-- Cuisine -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🍳 Cuisine</span>
          <span class="card-icon">💡</span>
        </div>
        <div class="temp-display" id="temp-cuisine">22.1°C</div>
        <div class="metric">
          <span class="metric-label">Lumières</span>
          <span class="metric-value status-on" id="light-cuisine"
            >● ON (100%)</span
          >
        </div>
        <div class="metric">
          <span class="metric-label">Humidité</span>
          <span class="metric-value" id="humidity-cuisine">52%</span>
        </div>
      </div>

      <!-- Sécurité -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🔒 Sécurité</span>
          <span class="card-icon">🛡️</span>
        </div>
        <div class="security-status">
          <div class="security-icon" id="security-icon">✅</div>
          <div class="metric-value status-on" id="security-status">
            Tout sécurisé
          </div>
        </div>
        <div class="metric">
          <span class="metric-label">Porte entrée</span>
          <span class="metric-value status-on" id="door-front"
            >🔒 Verrouillée</span
          >
        </div>
        <div class="metric">
          <span class="metric-label">Fenêtres</span>
          <span class="metric-value status-on" id="windows"
            >Toutes fermées</span
          >
        </div>
        <div class="metric">
          <span class="metric-label">Alarme</span>
          <span class="metric-value status-off" id="alarm">Désactivée</span>
        </div>
      </div>

      <!-- Énergie -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">⚡ Énergie</span>
          <span class="card-icon">📊</span>
        </div>
        <div class="metric">
          <span class="metric-label">Conso actuelle</span>
          <span class="metric-value" id="energy-current">847 W</span>
        </div>
        <div class="energy-bar">
          <div
            class="energy-fill"
            id="energy-bar"
            style="width: 28%; background: var(--success);"
          ></div>
        </div>
        <div class="metric">
          <span class="metric-label">Aujourd'hui</span>
          <span class="metric-value" id="energy-today">12.4 kWh</span>
        </div>
        <div class="metric">
          <span class="metric-label">Ce mois</span>
          <span class="metric-value" id="energy-month">287 kWh</span>
        </div>
      </div>

      <!-- Musique -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🎵 Musique</span>
          <span class="card-icon">🔊</span>
        </div>
        <div class="metric">
          <span class="metric-label">En cours</span>
          <span class="metric-value" id="music-track">—</span>
        </div>
        <div class="metric">
          <span class="metric-label">Pièce</span>
          <span class="metric-value" id="music-room">—</span>
        </div>
        <div class="metric">
          <span class="metric-label">Volume</span>
          <span class="metric-value" id="music-volume">—</span>
        </div>
      </div>
    </div>

    <script>
      // Mise à jour de l'heure
      function updateTime() {
        document.getElementById("time").textContent = new Date().toLocaleString(
          "fr-FR",
          {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          },
        );
      }
      setInterval(updateTime, 1000);
      updateTime();
    </script>
  </body>
</html>
```

## Commande Canvas

Jarvis pousse le dashboard via l'outil canvas intégré :

```
"Jarvis, affiche le dashboard"
→ Jarvis récupère les données via Home Assistant
→ Met à jour les valeurs dans le template HTML
→ Pousse via canvas.push
```

## Personnalisation

Vous pouvez demander à Jarvis de personnaliser le dashboard :

```
"Jarvis, ajoute une carte pour le garage"
"Jarvis, enlève la carte musique"
"Jarvis, change les couleurs du dashboard en bleu foncé"
"Jarvis, ajoute un graphique de consommation sur 7 jours"
```

## Notes

- Le Canvas nécessite le macOS app, iOS app, ou WebChat
- Les données sont récupérées via Home Assistant / MQTT
- Le dashboard se rafraîchit manuellement (demandez "Jarvis, refresh dashboard")
- Personnalisable via des commandes naturelles en français
