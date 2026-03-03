/**
 * Vue des objectifs détectés et actifs
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { GoalView } from "./types.js";

@customElement("autonomy-goals-view")
export class AutonomyGoalsView extends LitElement {
  @state() private goals: GoalView[] = [];
  @state() private filter: "all" | "active" | "completed" | "learned" = "all";

  static styles = css`
    :host {
      display: block;
    }

    .toolbar {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
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

    .goals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .goal-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s, box-shadow 0.2s;
      border: 2px solid transparent;
    }

    .goal-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .goal-card.active {
      border-color: #667eea;
    }

    .goal-card.completed {
      opacity: 0.7;
      background: #f0fdf4;
    }

    .goal-card.paused {
      opacity: 0.6;
      background: #fef3c7;
    }

    .goal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .goal-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #333;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .goal-badge {
      font-size: 0.75rem;
      padding: 4px 8px;
      border-radius: 12px;
      font-weight: 500;
    }

    .goal-badge.learned {
      background: #dbeafe;
      color: #1e40af;
    }

    .goal-badge.manual {
      background: #e5e7eb;
      color: #374151;
    }

    .goal-status {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .goal-status.active {
      background: #dcfce7;
      color: #166534;
    }

    .goal-status.completed {
      background: #dbeafe;
      color: #1e40af;
    }

    .goal-status.paused {
      background: #fef3c7;
      color: #92400e;
    }

    .goal-description {
      font-size: 0.9rem;
      color: #666;
      line-height: 1.5;
      margin-bottom: 16px;
    }

    .goal-meta {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .meta-tag {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #f3f4f6;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #666;
    }

    .progress-section {
      margin-bottom: 16px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.85rem;
    }

    .progress-label {
      color: #666;
    }

    .progress-value {
      font-weight: 600;
      color: #667eea;
    }

    .progress-bar {
      height: 10px;
      background: #e5e7eb;
      border-radius: 5px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.5s ease;
    }

    .progress-fill.low {
      background: linear-gradient(90deg, #f87171, #fca5a5);
    }

    .progress-fill.medium {
      background: linear-gradient(90deg, #fbbf24, #fcd34d);
    }

    .progress-fill.high {
      background: linear-gradient(90deg, #4ade80, #86efac);
    }

    .goal-actions {
      display: flex;
      gap: 8px;
    }

    .goal-btn {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .goal-btn.primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .goal-btn.primary:hover {
      opacity: 0.9;
    }

    .goal-btn.secondary {
      background: #f3f4f6;
      color: #666;
    }

    .goal-btn.secondary:hover {
      background: #e5e7eb;
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

    .category-icon {
      font-size: 1.5rem;
    }

    .stats-bar {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
      padding: 16px;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      border-radius: 12px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-number {
      font-size: 1.5rem;
      font-weight: 700;
      color: #667eea;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #666;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadGoals();
  }

  private async loadGoals() {
    // Simuler le chargement
    this.goals = [
      {
        id: "1",
        title: "Confort thermique optimal",
        description: "Maintenir une température agréable à la maison",
        category: "home",
        priority: 7,
        progress: 75,
        status: "active",
        learned: true,
        subGoals: 3,
      },
      {
        id: "2",
        title: "Productivité matinale",
        description: "Optimiser l'environnement de travail le matin",
        category: "productivity",
        priority: 9,
        progress: 60,
        status: "active",
        learned: true,
        subGoals: 4,
      },
      {
        id: "3",
        title: "Réduction consommation énergie",
        description: "Réduire la consommation électrique de 20%",
        category: "home",
        priority: 8,
        progress: 100,
        status: "completed",
        learned: false,
        subGoals: 5,
      },
      {
        id: "4",
        title: "Sessions de focus régulières",
        description: "Maintenir des sessions de travail concentré",
        category: "productivity",
        priority: 6,
        progress: 30,
        status: "paused",
        learned: true,
        subGoals: 2,
      },
    ];
  }

  render() {
    const filteredGoals = this.getFilteredGoals();
    const stats = this.calculateStats();

    return html`
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-number">${stats.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${stats.active}</div>
          <div class="stat-label">Actifs</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${stats.completed}</div>
          <div class="stat-label">Complétés</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${stats.learned}</div>
          <div class="stat-label">Auto-détectés</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="filter-buttons">
          <button
            class="filter-btn ${this.filter === "all" ? "active" : ""}"
            @click=${() => (this.filter = "all")}
          >
            Tous
          </button>
          <button
            class="filter-btn ${this.filter === "active" ? "active" : ""}"
            @click=${() => (this.filter = "active")}
          >
            Actifs
          </button>
          <button
            class="filter-btn ${this.filter === "completed" ? "active" : ""}"
            @click=${() => (this.filter = "completed")}
          >
            Complétés
          </button>
          <button
            class="filter-btn ${this.filter === "learned" ? "active" : ""}"
            @click=${() => (this.filter = "learned")}
          >
            Auto-détectés
          </button>
        </div>
      </div>

      <div class="goals-grid">
        ${filteredGoals.length === 0
          ? html`
              <div class="empty-state">
                <div class="empty-state-icon">🎯</div>
                <p>Aucun objectif trouvé</p>
              </div>
            `
          : filteredGoals.map((goal) => this.renderGoal(goal))}
      </div>
    `;
  }

  private renderGoal(goal: GoalView) {
    const categoryIcons: Record<string, string> = {
      health: "💪",
      productivity: "⚡",
      learning: "📚",
      social: "👥",
      home: "🏠",
      finance: "💰",
      personal_growth: "🌱",
      inferred: "🔮",
    };

    const progressClass =
      goal.progress < 30 ? "low" : goal.progress < 70 ? "medium" : "high";

    return html`
      <div class="goal-card ${goal.status}">
        <div class="goal-header">
          <h3 class="goal-title">
            <span class="category-icon">${categoryIcons[goal.category] || "🎯"}</span>
            ${goal.title}
            ${goal.learned
              ? html`<span class="goal-badge learned">🤖 Auto</span>`
              : html`<span class="goal-badge manual">👤 Manuel</span>`}
          </h3>
          <span class="goal-status ${goal.status}">${goal.status}</span>
        </div>

        <p class="goal-description">${goal.description}</p>

        <div class="goal-meta">
          <div class="meta-tag">
            <span>⭐ Priorité: ${goal.priority}/10</span>
          </div>
          <div class="meta-tag">
            <span>📋 ${goal.subGoals} sous-objectifs</span>
          </div>
        </div>

        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-label">Progression</span>
            <span class="progress-value">${goal.progress}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill ${progressClass}"
              style="width: ${goal.progress}%"
            ></div>
          </div>
        </div>

        <div class="goal-actions">
          ${goal.status === "active"
            ? html`
                <button class="goal-btn secondary" @click=${() => this.pauseGoal(goal.id)}>
                  ⏸️ Pause
                </button>
                <button class="goal-btn primary" @click=${() => this.updateProgress(goal.id)}>
                  Mettre à jour
                </button>
              `
            : goal.status === "paused"
            ? html`
                <button class="goal-btn secondary" @click=${() => this.resumeGoal(goal.id)}>
                  ▶️ Reprendre
                </button>
                <button class="goal-btn primary" @click=${() => this.completeGoal(goal.id)}>
                  ✅ Terminer
                </button>
              `
            : html`
                <button class="goal-btn secondary" @click=${() => this.restartGoal(goal.id)}>
                  🔄 Recommencer
                </button>
                <button class="goal-btn primary" @click=${() => this.viewDetails(goal.id)}>
                  👁️ Détails
                </button>
              `}
        </div>
      </div>
    `;
  }

  private getFilteredGoals(): GoalView[] {
    switch (this.filter) {
      case "active":
        return this.goals.filter((g) => g.status === "active");
      case "completed":
        return this.goals.filter((g) => g.status === "completed");
      case "learned":
        return this.goals.filter((g) => g.learned);
      default:
        return this.goals;
    }
  }

  private calculateStats() {
    return {
      total: this.goals.length,
      active: this.goals.filter((g) => g.status === "active").length,
      completed: this.goals.filter((g) => g.status === "completed").length,
      learned: this.goals.filter((g) => g.learned).length,
    };
  }

  private pauseGoal(id: string) {
    this.updateGoalStatus(id, "paused");
  }

  private resumeGoal(id: string) {
    this.updateGoalStatus(id, "active");
  }

  private completeGoal(id: string) {
    const goal = this.goals.find((g) => g.id === id);
    if (goal) {
      goal.status = "completed";
      goal.progress = 100;
      this.requestUpdate();
    }
  }

  private restartGoal(id: string) {
    const goal = this.goals.find((g) => g.id === id);
    if (goal) {
      goal.status = "active";
      goal.progress = 0;
      this.requestUpdate();
    }
  }

  private updateProgress(id: string) {
    const progress = prompt("Nouvelle progression (%):", "50");
    if (progress !== null) {
      const goal = this.goals.find((g) => g.id === id);
      if (goal) {
        goal.progress = Math.min(100, Math.max(0, parseInt(progress) || 0));
        this.requestUpdate();
      }
    }
  }

  private viewDetails(id: string) {
    this.dispatchEvent(
      new CustomEvent("view-goal", {
        detail: { id },
        bubbles: true,
        composed: true,
      })
    );
  }

  private updateGoalStatus(id: string, status: GoalView["status"]) {
    const goal = this.goals.find((g) => g.id === id);
    if (goal) {
      goal.status = status;
      this.requestUpdate();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "autonomy-goals-view": AutonomyGoalsView;
  }
}
