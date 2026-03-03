/**
 * Dashboard principal du système d'autonomie
 * Composant Lit pour afficher les statistiques et la vue d'ensemble
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AutonomyStats, AutonomyConfig } from "./types.js";

@customElement("autonomy-dashboard")
export class AutonomyDashboard extends LitElement {
  @property({ type: Object }) stats: AutonomyStats = {
    patternsLearned: 0,
    goalsInferred: 0,
    preferencesLearned: 0,
    knowledgeNodes: 0,
    decisionsMade: 0,
    learningProgress: 0,
  };

  @property({ type: Object }) config: AutonomyConfig = {
    enabled: true,
    level: "suggest",
    learningIntervalMinutes: 60,
    decisionIntervalMinutes: 30,
    maxDecisionsPerDay: 20,
  };

  @state() private activeTab: "overview" | "patterns" | "goals" | "knowledge" | "decisions" | "timeline" = "overview";

  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #333;
      background: #f5f5f5;
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 16px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .header h1 {
      margin: 0 0 10px 0;
      font-size: 2rem;
    }

    .header p {
      margin: 0;
      opacity: 0.9;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
      margin-top: 12px;
    }

    .status-badge.enabled {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .status-badge.disabled {
      background: rgba(0, 0, 0, 0.2);
      color: rgba(255, 255, 255, 0.7);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4ade80;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      background: white;
      padding: 8px;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      overflow-x: auto;
    }

    .tab {
      padding: 12px 20px;
      border: none;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: #666;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .tab:hover {
      background: #f3f4f6;
      color: #333;
    }

    .tab.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .content {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      min-height: 400px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      transition: transform 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-4px);
    }

    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 8px;
    }

    .stat-label {
      font-size: 0.9rem;
      color: #666;
      font-weight: 500;
    }

    .level-selector {
      display: flex;
      gap: 12px;
      margin-top: 16px;
      flex-wrap: wrap;
    }

    .level-option {
      padding: 8px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.85rem;
    }

    .level-option:hover {
      border-color: #667eea;
    }

    .level-option.selected {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: transparent;
      color: white;
    }

    .section {
      margin-bottom: 32px;
    }

    .section h2 {
      margin: 0 0 16px 0;
      font-size: 1.25rem;
      color: #333;
    }

    .progress-bar {
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }

    .info-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 12px;
      border-left: 4px solid #667eea;
    }

    .info-card h3 {
      margin: 0 0 8px 0;
      font-size: 1rem;
      color: #333;
    }

    .info-card p {
      margin: 0;
      font-size: 0.9rem;
      color: #666;
      line-height: 1.5;
    }
  `;

  render() {
    return html`
      <div class="container">
        <div class="header">
          <h1>🧠 Système d'Autonomie</h1>
          <p>Visualisation de l'apprentissage et des décisions autonomes</p>
          <div class="status-badge ${this.config.enabled ? "enabled" : "disabled"}">
            ${this.config.enabled
              ? html`<span class="status-dot"></span> Actif`
              : "Désactivé"}
          </div>
        </div>

        <div class="tabs">
          <button
            class="tab ${this.activeTab === "overview" ? "active" : ""}"
            @click=${() => (this.activeTab = "overview")}
          >
            📊 Vue d'ensemble
          </button>
          <button
            class="tab ${this.activeTab === "patterns" ? "active" : ""}"
            @click=${() => (this.activeTab = "patterns")}
          >
            🔍 Patterns
          </button>
          <button
            class="tab ${this.activeTab === "goals" ? "active" : ""}"
            @click=${() => (this.activeTab = "goals")}
          >
            🎯 Objectifs
          </button>
          <button
            class="tab ${this.activeTab === "knowledge" ? "active" : ""}"
            @click=${() => (this.activeTab = "knowledge")}
          >
            🕸️ Connaissances
          </button>
          <button
            class="tab ${this.activeTab === "decisions" ? "active" : ""}"
            @click=${() => (this.activeTab = "decisions")}
          >
            ⚡ Décisions
          </button>
          <button
            class="tab ${this.activeTab === "timeline" ? "active" : ""}"
            @click=${() => (this.activeTab = "timeline")}
          >
            📅 Timeline
          </button>
        </div>

        <div class="content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;
  }

  private renderTabContent() {
    switch (this.activeTab) {
      case "overview":
        return this.renderOverview();
      case "patterns":
        return html`<autonomy-patterns-view></autonomy-patterns-view>`;
      case "goals":
        return html`<autonomy-goals-view></autonomy-goals-view>`;
      case "knowledge":
        return html`<autonomy-knowledge-view></autonomy-knowledge-view>`;
      case "decisions":
        return html`<autonomy-decisions-view></autonomy-decisions-view>`;
      case "timeline":
        return html`<autonomy-timeline-view></autonomy-timeline-view>`;
      default:
        return this.renderOverview();
    }
  }

  private renderOverview() {
    return html`
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${this.stats.patternsLearned}</div>
          <div class="stat-label">Patterns Appris</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.stats.goalsInferred}</div>
          <div class="stat-label">Objectifs Détectés</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.stats.preferencesLearned}</div>
          <div class="stat-label">Préférences</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.stats.knowledgeNodes}</div>
          <div class="stat-label">Nœuds de Connaissance</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.stats.decisionsMade}</div>
          <div class="stat-label">Décisions Prises</div>
        </div>
      </div>

      <div class="section">
        <h2>⚙️ Configuration du Niveau d'Autonomie</h2>
        <div class="level-selector">
          ${["none", "suggest", "ask", "act_with_notice", "full"].map(
            (level) => html`
              <div
                class="level-option ${this.config.level === level
                  ? "selected"
                  : ""}"
                @click=${() => this.onLevelChange(level)}
              >
                ${this.getLevelLabel(level)}
              </div>
            `
          )}
        </div>
      </div>

      <div class="section">
        <h2>📈 Progression de l'Apprentissage</h2>
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: ${this.stats.learningProgress}%"
          ></div>
        </div>
        <p style="margin-top: 8px; color: #666;">
          ${this.stats.learningProgress}% - Jarvis apprend continuellement de vos
          interactions
        </p>
      </div>

      <div class="section">
        <h2>ℹ️ À Propos du Système d'Autonomie</h2>
        <div class="info-grid">
          <div class="info-card">
            <h3>🎯 Apprentissage</h3>
            <p>
              Jarvis analyse vos habitudes et préférences pour anticiper vos
              besoins et suggérer des actions pertinentes.
            </p>
          </div>
          <div class="info-card">
            <h3>🛡️ Éthique</h3>
            <p>
              Toutes les décisions sont vérifiées contre des règles éthiques pour
              garantir votre sécurité et votre autonomie.
            </p>
          </div>
          <div class="info-card">
            <h3>🔒 Confidentialité</h3>
            <p>
              Vos données sont anonymisées et stockées localement. Vous gardez
              le contrôle total de vos informations.
            </p>
          </div>
          <div class="info-card">
            <h3>✋ Contrôle</h3>
            <p>
              Vous pouvez à tout moment ajuster le niveau d'autonomie ou
              désactiver complètement le système.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  private getLevelLabel(level: string): string {
    const labels: Record<string, string> = {
      none: "❌ Aucune",
      suggest: "💡 Suggestions",
      ask: "❓ Demander",
      act_with_notice: "✅ Agir + Notifier",
      full: "🤖 Complète",
    };
    return labels[level] || level;
  }

  private onLevelChange(level: string) {
    this.config = { ...this.config, level: level as AutonomyConfig["level"] };
    this.dispatchEvent(
      new CustomEvent("level-change", {
        detail: { level },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "autonomy-dashboard": AutonomyDashboard;
  }
}
