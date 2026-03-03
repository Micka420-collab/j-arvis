/**
 * Vue des patterns comportementaux appris
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { PatternView } from "./types.js";

@customElement("autonomy-patterns-view")
export class AutonomyPatternsView extends LitElement {
  @state() private patterns: PatternView[] = [];
  @state() private filter: "all" | "high-confidence" | "recent" = "all";
  @state() private searchQuery = "";

  static styles = css`
    :host {
      display: block;
    }

    .toolbar {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      align-items: center;
    }

    .search-box {
      flex: 1;
      min-width: 200px;
    }

    .search-box input {
      width: 100%;
      padding: 10px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 0.9rem;
      transition: border-color 0.2s;
    }

    .search-box input:focus {
      outline: none;
      border-color: #667eea;
    }

    .filter-buttons {
      display: flex;
      gap: 8px;
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

    .patterns-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .pattern-card {
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px;
      border-left: 4px solid #667eea;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .pattern-card:hover {
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .pattern-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .pattern-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #333;
      margin: 0;
    }

    .pattern-actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      padding: 6px 12px;
      border: none;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: #667eea;
      color: white;
    }

    .pattern-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: #666;
    }

    .confidence-bar {
      width: 60px;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }

    .confidence-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s;
    }

    .confidence-fill.high {
      background: #4ade80;
    }

    .confidence-fill.medium {
      background: #fbbf24;
    }

    .confidence-fill.low {
      background: #f87171;
    }

    .pattern-description {
      font-size: 0.9rem;
      color: #666;
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .pattern-action {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      background: white;
      border-radius: 8px;
      font-size: 0.85rem;
      color: #333;
    }

    .action-type {
      padding: 4px 8px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .trend-indicator {
      font-size: 1.2rem;
    }

    .trend-up {
      color: #4ade80;
    }

    .trend-down {
      color: #f87171;
    }

    .trend-stable {
      color: #9ca3af;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .empty-state-icon {
      font-size: 4rem;
      margin-bottom: 16px;
    }

    .stats-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
      padding: 16px;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      border-radius: 12px;
    }

    .summary-item {
      text-align: center;
    }

    .summary-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #667eea;
    }

    .summary-label {
      font-size: 0.8rem;
      color: #666;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadPatterns();
  }

  private async loadPatterns() {
    // Simuler le chargement depuis l'API
    // Dans la vraie implémentation, appeler le gateway
    this.patterns = [
      {
        id: "1",
        name: "Allumage lumières salon",
        description: "Allume les lumières du salon vers 19h00",
        confidence: 0.92,
        frequency: 28,
        lastTriggered: "2024-01-15T19:00:00Z",
        action: "domotic/lights/on",
        trend: "up",
      },
      {
        id: "2",
        name: "Mode concentration matin",
        description: "Active le mode concentration de 9h à 12h en semaine",
        confidence: 0.85,
        frequency: 15,
        lastTriggered: "2024-01-15T09:00:00Z",
        action: "system/focus-mode",
        trend: "stable",
      },
      {
        id: "3",
        name: "Température 21°C",
        description: "Ajuste le chauffage à 21°C le soir",
        confidence: 0.78,
        frequency: 12,
        lastTriggered: "2024-01-14T20:30:00Z",
        action: "domotic/temperature/set",
        trend: "up",
      },
      {
        id: "4",
        name: "Musique relaxante",
        description: "Lance de la musique relaxante après le travail",
        confidence: 0.65,
        frequency: 8,
        lastTriggered: "2024-01-13T18:00:00Z",
        action: "media/play/relax",
        trend: "down",
      },
    ];
  }

  render() {
    const filteredPatterns = this.getFilteredPatterns();

    return html`
      <div class="stats-summary">
        <div class="summary-item">
          <div class="summary-value">${this.patterns.length}</div>
          <div class="summary-label">Total Patterns</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">
            ${this.patterns.filter((p) => p.confidence > 0.8).length}
          </div>
          <div class="summary-label">Haute Confiance</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">
            ${this.patterns.reduce((sum, p) => sum + p.frequency, 0)}
          </div>
          <div class="summary-label">Déclenchements</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-box">
          <input
            type="text"
            placeholder="Rechercher un pattern..."
            .value=${this.searchQuery}
            @input=${(e: InputEvent) =>
              (this.searchQuery = (e.target as HTMLInputElement).value)}
          />
        </div>
        <div class="filter-buttons">
          <button
            class="filter-btn ${this.filter === "all" ? "active" : ""}"
            @click=${() => (this.filter = "all")}
          >
            Tous
          </button>
          <button
            class="filter-btn ${this.filter === "high-confidence"
              ? "active"
              : ""}"
            @click=${() => (this.filter = "high-confidence")}
          >
            Haute Confiance
          </button>
          <button
            class="filter-btn ${this.filter === "recent" ? "active" : ""}"
            @click=${() => (this.filter = "recent")}
          >
            Récents
          </button>
        </div>
      </div>

      <div class="patterns-list">
        ${filteredPatterns.length === 0
          ? html`
              <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>Aucun pattern trouvé</p>
              </div>
            `
          : filteredPatterns.map((pattern) => this.renderPattern(pattern))}
      </div>
    `;
  }

  private renderPattern(pattern: PatternView) {
    const confidencePercent = Math.round(pattern.confidence * 100);
    const confidenceClass =
      confidencePercent >= 80 ? "high" : confidencePercent >= 50 ? "medium" : "low";

    const trendIcon =
      pattern.trend === "up" ? "📈" : pattern.trend === "down" ? "📉" : "➡️";
    const trendClass = `trend-${pattern.trend}`;

    return html`
      <div class="pattern-card">
        <div class="pattern-header">
          <h3 class="pattern-title">${pattern.name}</h3>
          <div class="pattern-actions">
            <button class="action-btn" @click=${() => this.editPattern(pattern.id)}>
              ✏️ Modifier
            </button>
            <button class="action-btn" @click=${() => this.deletePattern(pattern.id)}>
              🗑️ Supprimer
            </button>
          </div>
        </div>

        <div class="pattern-meta">
          <div class="meta-item">
            <span>Confiance:</span>
            <div class="confidence-bar">
              <div
                class="confidence-fill ${confidenceClass}"
                style="width: ${confidencePercent}%"
              ></div>
            </div>
            <span>${confidencePercent}%</span>
          </div>
          <div class="meta-item">
            <span>🔄 ${pattern.frequency} fois</span>
          </div>
          <div class="meta-item">
            <span
              >🕐 Dernier: ${this.formatDate(pattern.lastTriggered)}</span
            >
          </div>
          <div class="meta-item">
            <span class="trend-indicator ${trendClass}">${trendIcon}</span>
          </div>
        </div>

        <p class="pattern-description">${pattern.description}</p>

        <div class="pattern-action">
          <span class="action-type">ACTION</span>
          <code>${pattern.action}</code>
        </div>
      </div>
    `;
  }

  private getFilteredPatterns(): PatternView[] {
    let filtered = this.patterns;

    // Filtre par recherche
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    // Filtre par catégorie
    switch (this.filter) {
      case "high-confidence":
        filtered = filtered.filter((p) => p.confidence > 0.8);
        break;
      case "recent":
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(
          (p) => new Date(p.lastTriggered) > weekAgo
        );
        break;
    }

    return filtered;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString("fr-FR");
  }

  private editPattern(id: string) {
    this.dispatchEvent(
      new CustomEvent("edit-pattern", {
        detail: { id },
        bubbles: true,
        composed: true,
      })
    );
  }

  private deletePattern(id: string) {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce pattern ?")) {
      this.patterns = this.patterns.filter((p) => p.id !== id);
      this.dispatchEvent(
        new CustomEvent("delete-pattern", {
          detail: { id },
          bubbles: true,
          composed: true,
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "autonomy-patterns-view": AutonomyPatternsView;
  }
}
