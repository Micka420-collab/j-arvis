/**
 * Vue timeline des événements d'autonomie
 * Chronologie visuelle de l'apprentissage et des décisions
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { TimelineEvent } from "./types.js";

@customElement("autonomy-timeline-view")
export class AutonomyTimelineView extends LitElement {
  @state() private events: TimelineEvent[] = [];
  @state() private filter: "all" | "patterns" | "decisions" | "goals" = "all";

  static styles = css`
    :host {
      display: block;
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

    .timeline {
      position: relative;
      padding-left: 40px;
    }

    .timeline::before {
      content: "";
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, #667eea, #764ba2);
      border-radius: 1px;
    }

    .timeline-item {
      position: relative;
      margin-bottom: 24px;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .timeline-marker {
      position: absolute;
      left: -33px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      border: 3px solid #667eea;
      z-index: 1;
    }

    .timeline-marker.pattern {
      border-color: #3b82f6;
      background: #dbeafe;
    }

    .timeline-marker.decision {
      border-color: #10b981;
      background: #d1fae5;
    }

    .timeline-marker.goal {
      border-color: #f59e0b;
      background: #fef3c7;
    }

    .timeline-marker.feedback {
      border-color: #8b5cf6;
      background: #ede9fe;
    }

    .timeline-content {
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .timeline-title {
      font-weight: 600;
      color: #333;
      margin: 0;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .timeline-time {
      font-size: 0.8rem;
      color: #999;
      white-space: nowrap;
    }

    .timeline-description {
      font-size: 0.9rem;
      color: #666;
      line-height: 1.4;
      margin-bottom: 8px;
    }

    .timeline-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .meta-tag {
      padding: 2px 8px;
      background: #f3f4f6;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #666;
    }

    .date-divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
      color: #999;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .date-divider::before,
    .date-divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }

    .date-divider span {
      padding: 0 16px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .stats-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .summary-card {
      background: white;
      padding: 16px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .summary-icon {
      font-size: 1.5rem;
      margin-bottom: 4px;
    }

    .summary-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: #667eea;
    }

    .summary-label {
      font-size: 0.75rem;
      color: #666;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadEvents();
  }

  private async loadEvents() {
    this.events = [
      {
        id: "1",
        timestamp: "2024-01-15T19:00:00Z",
        type: "decision_made",
        title: "💡 Suggestion: Allumage lumières",
        description: "Jarvis a suggéré d'allumer les lumières basé sur votre habitude à 19h",
        data: { confidence: 0.92 },
      },
      {
        id: "2",
        timestamp: "2024-01-15T14:30:00Z",
        type: "pattern_learned",
        title: "🔍 Nouveau pattern détecté",
        description: "Pattern 'Mode concentration matinal' avec confiance de 85%",
        data: { frequency: 15 },
      },
      {
        id: "3",
        timestamp: "2024-01-15T09:00:00Z",
        type: "decision_made",
        title: "✅ Action autonome exécutée",
        description: "Mode concentration activé automatiquement",
        data: { autonomyLevel: "act_with_notice" },
      },
      {
        id: "4",
        timestamp: "2024-01-14T18:45:00Z",
        type: "goal_inferred",
        title: "🎯 Objectif détecté",
        description: "Nouvel objectif 'Productivité matinale' inféré de vos habitudes",
        data: { priority: 9 },
      },
      {
        id: "5",
        timestamp: "2024-01-14T12:00:00Z",
        type: "feedback_given",
        title: "👎 Feedback reçu",
        description: "Vous avez indiqué que la suggestion de rappel pause n'était pas pertinente",
        data: { decisionId: "4" },
      },
      {
        id: "6",
        timestamp: "2024-01-13T20:30:00Z",
        type: "pattern_learned",
        title: "🔍 Préférence apprise",
        description: "Préférence pour 21°C en soirée enregistrée",
        data: { confidence: 0.78 },
      },
      {
        id: "7",
        timestamp: "2024-01-12T19:00:00Z",
        type: "decision_made",
        title: "💡 Suggestion: Allumage lumières",
        description: "Suggestion approuvée par l'utilisateur",
        data: { feedback: "positive" },
      },
    ];
  }

  render() {
    const filteredEvents = this.getFilteredEvents();
    const stats = this.calculateStats();

    return html`
      <div class="stats-summary">
        <div class="summary-card">
          <div class="summary-icon">🔍</div>
          <div class="summary-value">${stats.patterns}</div>
          <div class="summary-label">Patterns</div>
        </div>
        <div class="summary-card">
          <div class="summary-icon">⚡</div>
          <div class="summary-value">${stats.decisions}</div>
          <div class="summary-label">Décisions</div>
        </div>
        <div class="summary-card">
          <div class="summary-icon">🎯</div>
          <div class="summary-value">${stats.goals}</div>
          <div class="summary-label">Objectifs</div>
        </div>
        <div class="summary-card">
          <div class="summary-icon">👍</div>
          <div class="summary-value">${stats.feedback}</div>
          <div class="summary-label">Feedbacks</div>
        </div>
      </div>

      <div class="toolbar">
        <button
          class="filter-btn ${this.filter === "all" ? "active" : ""}"
          @click=${() => (this.filter = "all")}
        >
          Tous les événements
        </button>
        <button
          class="filter-btn ${this.filter === "patterns" ? "active" : ""}"
          @click=${() => (this.filter = "patterns")}
        >
          🔍 Patterns
        </button>
        <button
          class="filter-btn ${this.filter === "decisions" ? "active" : ""}"
          @click=${() => (this.filter = "decisions")}
        >
          ⚡ Décisions
        </button>
        <button
          class="filter-btn ${this.filter === "goals" ? "active" : ""}"
          @click=${() => (this.filter = "goals")}
        >
          🎯 Objectifs
        </button>
      </div>

      <div class="timeline">
        ${filteredEvents.length === 0
          ? html`
              <div class="empty-state">
                <div style="font-size: 4rem; margin-bottom: 16px;">📅</div>
                <p>Aucun événement trouvé</p>
              </div>
            `
          : this.renderTimeline(filteredEvents)}
      </div>
    `;
  }

  private renderTimeline(events: TimelineEvent[]) {
    const grouped = this.groupByDate(events);

    return html`
      ${grouped.map(
        ([date, dateEvents]) => html`
          <div class="date-divider">
            <span>${this.formatDate(date)}</span>
          </div>
          ${dateEvents.map((event) => this.renderEvent(event))}
        `
      )}
    `;
  }

  private renderEvent(event: TimelineEvent) {
    return html`
      <div class="timeline-item">
        <div class="timeline-marker ${event.type.replace("_", "-")}"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <h4 class="timeline-title">${event.title}</h4>
            <span class="timeline-time">${this.formatTime(event.timestamp)}</span>
          </div>
          <p class="timeline-description">${event.description}</p>
          <div class="timeline-meta">
            ${this.renderEventMeta(event)}
          </div>
        </div>
      </div>
    `;
  }

  private renderEventMeta(event: TimelineEvent) {
    const tags: string[] = [];

    switch (event.type) {
      case "pattern_learned":
        if (event.data?.confidence) {
          tags.push(`Confiance: ${Math.round((event.data.confidence as number) * 100)}%`);
        }
        if (event.data?.frequency) {
          tags.push(`${event.data.frequency} occurrences`);
        }
        break;
      case "decision_made":
        if (event.data?.autonomyLevel) {
          tags.push(`Niveau: ${event.data.autonomyLevel}`);
        }
        if (event.data?.feedback) {
          tags.push(`Feedback: ${event.data.feedback}`);
        }
        break;
      case "goal_inferred":
        if (event.data?.priority) {
          tags.push(`Priorité: ${event.data.priority}/10`);
        }
        break;
    }

    return tags.map((tag) => html`<span class="meta-tag">${tag}</span>`);
  }

  private getFilteredEvents(): TimelineEvent[] {
    if (this.filter === "all") return this.events;
    return this.events.filter((e) => e.type.includes(this.filter));
  }

  private groupByDate(events: TimelineEvent[]): [string, TimelineEvent[]][] {
    const groups = new Map<string, TimelineEvent[]>();

    for (const event of events) {
      const date = event.timestamp.split("T")[0];
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(event);
    }

    return Array.from(groups.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }

  private calculateStats() {
    return {
      patterns: this.events.filter((e) => e.type === "pattern_learned").length,
      decisions: this.events.filter((e) => e.type === "decision_made").length,
      goals: this.events.filter((e) => e.type === "goal_inferred").length,
      feedback: this.events.filter((e) => e.type === "feedback_given").length,
    };
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split("T")[0]) return "Aujourd'hui";
    if (dateStr === yesterday.toISOString().split("T")[0]) return "Hier";

    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "autonomy-timeline-view": AutonomyTimelineView;
  }
}
