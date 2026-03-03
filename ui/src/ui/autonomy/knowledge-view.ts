/**
 * Vue du graphe de connaissances
 * Visualisation interactive des nœuds et relations
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { KnowledgeNodeView } from "./types.js";

@customElement("autonomy-knowledge-view")
export class AutonomyKnowledgeView extends LitElement {
  @state() private nodes: KnowledgeNodeView[] = [];
  @state() private selectedNode: string | null = null;
  @state() private viewMode: "graph" | "list" = "list";
  @state() private filterType: string = "all";

  static styles = css`
    :host {
      display: block;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .view-toggle {
      display: flex;
      gap: 8px;
    }

    .toggle-btn {
      padding: 8px 16px;
      border: 2px solid #e5e7eb;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .toggle-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: transparent;
      color: white;
    }

    .type-filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .type-filter {
      padding: 6px 12px;
      border: 2px solid #e5e7eb;
      background: white;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }

    .type-filter:hover,
    .type-filter.active {
      border-color: #667eea;
      background: #eef2ff;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .stat-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .stat-icon {
      font-size: 1.5rem;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-count {
      font-size: 1.25rem;
      font-weight: 700;
      color: #667eea;
    }

    .stat-name {
      font-size: 0.75rem;
      color: #666;
    }

    .nodes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .node-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
    }

    .node-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    }

    .node-card.selected {
      border-color: #667eea;
    }

    .node-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .node-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    }

    .node-icon.preference {
      background: #dbeafe;
    }

    .node-icon.habit {
      background: #dcfce7;
    }

    .node-icon.fact {
      background: #fef3c7;
    }

    .node-icon.relationship {
      background: #fce7f3;
    }

    .node-icon.goal {
      background: #e0e7ff;
    }

    .node-icon.constraint {
      background: #fee2e2;
    }

    .node-title {
      font-weight: 600;
      color: #333;
      margin: 0;
      font-size: 0.95rem;
    }

    .node-type {
      font-size: 0.75rem;
      color: #666;
      text-transform: capitalize;
    }

    .node-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .confidence-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #f3f4f6;
      border-radius: 20px;
      font-size: 0.8rem;
    }

    .confidence-bar {
      width: 40px;
      height: 4px;
      background: #e5e7eb;
      border-radius: 2px;
      overflow: hidden;
    }

    .confidence-fill {
      height: 100%;
      border-radius: 2px;
    }

    .connections-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #eef2ff;
      border-radius: 20px;
      font-size: 0.8rem;
      color: #667eea;
    }

    .node-detail {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.85rem;
    }

    .detail-label {
      color: #666;
    }

    .detail-value {
      color: #333;
      font-weight: 500;
    }

    .graph-container {
      background: #f9fafb;
      border-radius: 16px;
      padding: 24px;
      min-height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .graph-placeholder {
      text-align: center;
      color: #666;
    }

    .graph-placeholder-icon {
      font-size: 4rem;
      margin-bottom: 16px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadNodes();
  }

  private async loadNodes() {
    this.nodes = [
      {
        id: "1",
        type: "habit",
        label: "Allume lumières 19h",
        confidence: 0.92,
        connections: 3,
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "2",
        type: "preference",
        label: "Température 21°C",
        confidence: 0.85,
        connections: 2,
        createdAt: "2024-01-05T00:00:00Z",
      },
      {
        id: "3",
        type: "fact",
        label: "Heure coucher ~23h",
        confidence: 0.78,
        connections: 4,
        createdAt: "2024-01-08T00:00:00Z",
      },
      {
        id: "4",
        type: "goal",
        label: "Confort optimal",
        confidence: 0.88,
        connections: 5,
        createdAt: "2024-01-10T00:00:00Z",
      },
      {
        id: "5",
        type: "preference",
        label: "Musique classique",
        confidence: 0.72,
        connections: 1,
        createdAt: "2024-01-12T00:00:00Z",
      },
      {
        id: "6",
        type: "constraint",
        label: "Ne pas déranger 9h-12h",
        confidence: 0.95,
        connections: 2,
        createdAt: "2024-01-15T00:00:00Z",
      },
    ];
  }

  render() {
    const filteredNodes = this.getFilteredNodes();
    const stats = this.calculateStats();

    return html`
      <div class="toolbar">
        <div class="view-toggle">
          <button
            class="toggle-btn ${this.viewMode === "list" ? "active" : ""}"
            @click=${() => (this.viewMode = "list")}
          >
            📋 Liste
          </button>
          <button
            class="toggle-btn ${this.viewMode === "graph" ? "active" : ""}"
            @click=${() => (this.viewMode = "graph")}
          >
            🕸️ Graphe
          </button>
        </div>

        <div class="type-filters">
          <button
            class="type-filter ${this.filterType === "all" ? "active" : ""}"
            @click=${() => (this.filterType = "all")}
          >
            Tous
          </button>
          ${["preference", "habit", "fact", "goal", "constraint"].map(
            (type) => html`
              <button
                class="type-filter ${this.filterType === type ? "active" : ""}"
                @click=${() => (this.filterType = type)}
              >
                ${this.getTypeIcon(type)} ${type}
              </button>
            `
          )}
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-pill">
          <span class="stat-icon">🧠</span>
          <div class="stat-info">
            <span class="stat-count">${stats.total}</span>
            <span class="stat-name">Total</span>
          </div>
        </div>
        ${Object.entries(stats.byType).map(
          ([type, count]) => html`
            <div class="stat-pill">
              <span class="stat-icon">${this.getTypeIcon(type)}</span>
              <div class="stat-info">
                <span class="stat-count">${count}</span>
                <span class="stat-name">${type}s</span>
              </div>
            </div>
          `
        )}
      </div>

      ${this.viewMode === "graph"
        ? this.renderGraphView()
        : this.renderListView(filteredNodes)}
    `;
  }

  private renderListView(nodes: KnowledgeNodeView[]) {
    if (nodes.length === 0) {
      return html`
        <div class="empty-state">
          <div style="font-size: 4rem; margin-bottom: 16px;">🕸️</div>
          <p>Aucun nœud trouvé</p>
        </div>
      `;
    }

    return html`
      <div class="nodes-grid">
        ${nodes.map((node) => this.renderNode(node))}
      </div>
    `;
  }

  private renderNode(node: KnowledgeNodeView) {
    const isSelected = this.selectedNode === node.id;
    const confidencePercent = Math.round(node.confidence * 100);
    const confidenceColor =
      confidencePercent >= 80 ? "#4ade80" : confidencePercent >= 50 ? "#fbbf24" : "#f87171";

    return html`
      <div
        class="node-card ${isSelected ? "selected" : ""}"
        @click=${() => this.toggleNodeSelection(node.id)}
      >
        <div class="node-header">
          <div class="node-icon ${node.type}">${this.getTypeIcon(node.type)}</div>
          <div>
            <h4 class="node-title">${node.label}</h4>
            <span class="node-type">${node.type}</span>
          </div>
        </div>

        <div class="node-meta">
          <div class="confidence-badge">
            <div class="confidence-bar">
              <div
                class="confidence-fill"
                style="width: ${confidencePercent}%; background: ${confidenceColor}"
              ></div>
            </div>
            <span>${confidencePercent}%</span>
          </div>
          <div class="connections-badge">
            <span>🔗</span>
            <span>${node.connections}</span>
          </div>
        </div>

        ${isSelected
          ? html`
              <div class="node-detail">
                <div class="detail-row">
                  <span class="detail-label">Créé le:</span>
                  <span class="detail-value">
                    ${new Date(node.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">ID:</span>
                  <span class="detail-value" style="font-size: 0.75rem; font-family: monospace;">
                    ${node.id}
                  </span>
                </div>
              </div>
            `
          : null}
      </div>
    `;
  }

  private renderGraphView() {
    return html`
      <div class="graph-container">
        <div class="graph-placeholder">
          <div class="graph-placeholder-icon">🕸️</div>
          <h3>Visualisation du Graphe</h3>
          <p>La visualisation interactive du graphe de connaissances sera disponible prochainement.</p>
          <p style="margin-top: 16px; font-size: 0.85rem; color: #999;">
            Nœuds: ${this.nodes.length} | Connexions: ${this.nodes.reduce((sum, n) => sum + n.connections, 0)}
          </p>
        </div>
      </div>
    `;
  }

  private getFilteredNodes(): KnowledgeNodeView[] {
    if (this.filterType === "all") return this.nodes;
    return this.nodes.filter((n) => n.type === this.filterType);
  }

  private calculateStats() {
    const byType: Record<string, number> = {};
    for (const node of this.nodes) {
      byType[node.type] = (byType[node.type] || 0) + 1;
    }
    return {
      total: this.nodes.length,
      byType,
    };
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      preference: "⚙️",
      habit: "🔄",
      fact: "📋",
      relationship: "🔗",
      goal: "🎯",
      constraint: "⚠️",
    };
    return icons[type] || "🧠";
  }

  private toggleNodeSelection(id: string) {
    this.selectedNode = this.selectedNode === id ? null : id;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "autonomy-knowledge-view": AutonomyKnowledgeView;
  }
}
