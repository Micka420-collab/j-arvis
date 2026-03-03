/**
 * Vue des décisions autonomes
 * Historique et statistiques des décisions
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { DecisionView } from "./types.js";

@customElement("autonomy-decisions-view")
export class AutonomyDecisionsView extends LitElement {
  @state() private decisions: DecisionView[] = [];
  @state() private filter: "all" | "executed" | "pending" | "with-feedback" = "all";

  static styles = css`
    :host {
      display: block;
    }

    .stats-overview {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #667eea;
    }

    .stat-label {
      font-size: 0.85rem;
      color: #666;
      margin-top: 4px;
    }

    .success-rate {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .rate-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: conic-gradient(#4ade80 var(--rate), #e5e7eb var(--rate));
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .rate-circle::before {
      content: "";
      width: 60px;
      height: 60px;
      background: white;
      border-radius: 50%;
      position: absolute;
    }

    .rate-text {
      position: relative;
      font-size: 1.25rem;
      font-weight: 700;
      color: #333;
    }

    .toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 8px 16px;
      border: 2px solid #e5e7eb;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .filter-btn:hover {
      border-color: #667eea;
    }

    .filter-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: transparent;
      color: white;
    }

    .decisions-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .decision-item {
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      border-left: 4px solid #667eea;
      transition: all 0.2s;
    }

    .decision-item:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .decision-item.executed {
      border-left-color: #4ade80;
    }

    .decision-item.pending {
      border-left-color: #fbbf24;
    }

    .decision-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .decision-action {
      font-weight: 600;
      color: #333;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .decision-time {
      font-size: 0.8rem;
      color: #999;
    }

    .decision-reasoning {
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .decision-meta {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .meta-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #f3f4f6;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #666;
    }

    .confidence-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .confidence-bar {
      width: 50px;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }

    .confidence-fill {
      height: 100%;
      border-radius: 3px;
    }

    .level-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .level-none {
      background: #e5e7eb;
      color: #666;
    }

    .level-suggest {
      background: #dbeafe;
      color: #1e40af;
    }

    .level-ask {
      background: #fef3c7;
      color: #92400e;
    }

    .level-act {
      background: #dcfce7;
      color: #166534;
    }

    .level-full {
      background: #fce7f3;
      color: #9d174d;
    }

    .feedback-buttons {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .feedback-btn {
      padding: 4px 10px;
      border: 1px solid #e5e7eb;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }

    .feedback-btn:hover {
      background: #f3f4f6;
    }

    .feedback-btn.positive {
      border-color: #4ade80;
      color: #166534;
    }

    .feedback-btn.negative {
      border-color: #f87171;
      color: #991b1b;
    }

    .feedback-given {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .feedback-given.positive {
      background: #dcfce7;
      color: #166534;
    }

    .feedback-given.negative {
      background: #fee2e2;
      color: #991b1b;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .chart-container {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }

    .chart-title {
      font-size: 1rem;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
    }

    .mini-chart {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 100px;
    }

    .chart-bar {
      flex: 1;
      background: linear-gradient(to top, #667eea, #764ba2);
      border-radius: 4px 4px 0 0;
      min-height: 10px;
      transition: all 0.3s;
    }

    .chart-bar:hover {
      opacity: 0.8;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadDecisions();
  }

  private async loadDecisions() {
    this.decisions = [
      {
        id: "1",
        timestamp: "2024-01-15T19:00:00Z",
        action: "Allumage lumières salon",
        reasoning: "Pattern détecté: allumage à 19h (confiance 92%)",
        confidence: 0.92,
        autonomyLevel: "suggest",
        executed: false,
        userFeedback: "positive",
      },
      {
        id: "2",
        timestamp: "2024-01-15T09:00:00Z",
        action: "Activation mode concentration",
        reasoning: "Heure de travail habituelle détectée",
        confidence: 0.85,
        autonomyLevel: "act_with_notice",
        executed: true,
      },
      {
        id: "3",
        timestamp: "2024-01-14T20:30:00Z",
        action: "Ajustement température 21°C",
        reasoning: "Préférence utilisateur pour 21°C le soir",
        confidence: 0.78,
        autonomyLevel: "ask",
        executed: false,
      },
      {
        id: "4",
        timestamp: "2024-01-14T12:00:00Z",
        action: "Suggestion rappel pause",
        reasoning: "2h de travail concentré détectées",
        confidence: 0.65,
        autonomyLevel: "suggest",
        executed: false,
        userFeedback: "negative",
      },
    ];
  }

  render() {
    const filteredDecisions = this.getFilteredDecisions();
    const stats = this.calculateStats();

    return html`
      <div class="stats-overview">
        <div class="stat-card">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total Décisions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.executed}</div>
          <div class="stat-label">Exécutées</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.suggested}</div>
          <div class="stat-label">Suggestions</div>
        </div>
        <div class="stat-card">
          <div class="success-rate">
            <div class="rate-circle" style="--rate: ${stats.successRate * 3.6}deg">
              <span class="rate-text">${Math.round(stats.successRate)}%</span>
            </div>
          </div>
          <div class="stat-label">Taux de Succès</div>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-title">📊 Activité des 7 derniers jours</div>
        <div class="mini-chart">
          ${[30, 45, 25, 60, 40, 55, 70].map(
            (h) => html`<div class="chart-bar" style="height: ${h}%"></div>`
          )}
        </div>
      </div>

      <div class="toolbar">
        <button
          class="filter-btn ${this.filter === "all" ? "active" : ""}"
          @click=${() => (this.filter = "all")}
        >
          Toutes
        </button>
        <button
          class="filter-btn ${this.filter === "executed" ? "active" : ""}"
          @click=${() => (this.filter = "executed")}
        >
          Exécutées
        </button>
        <button
          class="filter-btn ${this.filter === "pending" ? "active" : ""}"
          @click=${() => (this.filter = "pending")}
        >
          En attente
        </button>
        <button
          class="filter-btn ${this.filter === "with-feedback" ? "active" : ""}"
          @click=${() => (this.filter = "with-feedback")}
        >
          Avec feedback
        </button>
      </div>

      <div class="decisions-list">
        ${filteredDecisions.length === 0
          ? html`
              <div class="empty-state">
                <div style="font-size: 4rem; margin-bottom: 16px;">⚡</div>
                <p>Aucune décision trouvée</p>
              </div>
            `
          : filteredDecisions.map((d) => this.renderDecision(d))}
      </div>
    `;
  }

  private renderDecision(decision: DecisionView) {
    const confidencePercent = Math.round(decision.confidence * 100);
    const confidenceColor =
      confidencePercent >= 80 ? "#4ade80" : confidencePercent >= 50 ? "#fbbf24" : "#f87171";

    const levelClass = `level-${decision.autonomyLevel.replace("_", "-")}`;
    const levelLabels: Record<string, string> = {
      none: "Aucune",
      suggest: "Suggestion",
      ask: "Demande",
      "act-with-notice": "Actif",
      full: "Complète",
    };

    return html`
      <div class="decision-item ${decision.executed ? "executed" : "pending"}">
        <div class="decision-header">
          <div class="decision-action">
            ${decision.executed ? "✅" : "⏳"}
            ${decision.action}
          </div>
          <div class="decision-time">
            ${this.formatTime(decision.timestamp)}
          </div>
        </div>

        <p class="decision-reasoning">${decision.reasoning}</p>

        <div class="decision-meta">
          <div class="meta-badge confidence-indicator">
            <div class="confidence-bar">
              <div
                class="confidence-fill"
                style="width: ${confidencePercent}%; background: ${confidenceColor}"
              ></div>
            </div>
            <span>${confidencePercent}%</span>
          </div>

          <span class="level-badge ${levelClass}">
            ${levelLabels[decision.autonomyLevel] || decision.autonomyLevel}
          </span>

          ${decision.userFeedback
            ? html`
                <span
                  class="feedback-given ${decision.userFeedback}"
                >
                  ${decision.userFeedback === "positive" ? "👍" : "👎"}
                  ${decision.userFeedback === "positive" ? "Approuvé" : "Rejeté"}
                </span>
              `
            : html`
                <div class="feedback-buttons">
                  <button
                    class="feedback-btn positive"
                    @click=${() => this.giveFeedback(decision.id, "positive")}
                  >
                    👍 Bon
                  </button>
                  <button
                    class="feedback-btn negative"
                    @click=${() => this.giveFeedback(decision.id, "negative")}
                  >
                    👎 Mauvais
                  </button>
                </div>
              `}
        </div>
      </div>
    `;
  }

  private getFilteredDecisions(): DecisionView[] {
    switch (this.filter) {
      case "executed":
        return this.decisions.filter((d) => d.executed);
      case "pending":
        return this.decisions.filter((d) => !d.executed);
      case "with-feedback":
        return this.decisions.filter((d) => d.userFeedback);
      default:
        return this.decisions;
    }
  }

  private calculateStats() {
    const total = this.decisions.length;
    const executed = this.decisions.filter((d) => d.executed).length;
    const suggested = total - executed;
    const withFeedback = this.decisions.filter((d) => d.userFeedback);
    const positiveFeedback = withFeedback.filter(
      (d) => d.userFeedback === "positive"
    ).length;

    return {
      total,
      executed,
      suggested,
      successRate:
        withFeedback.length > 0
          ? (positiveFeedback / withFeedback.length) * 100
          : 0,
    };
  }

  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffHours < 1) return "Il y a quelques minutes";
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private giveFeedback(id: string, feedback: "positive" | "negative") {
    const decision = this.decisions.find((d) => d.id === id);
    if (decision) {
      decision.userFeedback = feedback;
      this.requestUpdate();

      this.dispatchEvent(
        new CustomEvent("feedback-given", {
          detail: { decisionId: id, feedback },
          bubbles: true,
          composed: true,
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "autonomy-decisions-view": AutonomyDecisionsView;
  }
}
