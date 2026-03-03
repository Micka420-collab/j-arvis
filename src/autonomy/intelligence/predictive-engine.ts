/**
 * Moteur Prédictif
 * Utilise des algorithmes de séries temporelles pour prédire les besoins futurs
 * Implémente des modèles simples de prédiction sans dépendances externes lourdes
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("autonomy:predictive");

export type TimeSeriesPoint = {
  timestamp: Date;
  value: number;
  label?: string;
};

export type PredictionResult = {
  predictedValue: number;
  confidence: number;
  trend: "increasing" | "decreasing" | "stable";
  nextOccurrence?: Date;
  anomaly?: boolean;
};

export type SeasonalPattern = {
  type: "hourly" | "daily" | "weekly" | "monthly";
  peakHours: number[];
  confidence: number;
};

export class PredictiveEngine {
  private history: Map<string, TimeSeriesPoint[]> = new Map();
  private maxHistorySize = 1000;
  private patterns: Map<string, SeasonalPattern> = new Map();

  /**
   * Enregistre un point de données temporel
   */
  recordEvent(
    category: string,
    value: number = 1,
    label?: string,
    timestamp: Date = new Date()
  ): void {
    if (!this.history.has(category)) {
      this.history.set(category, []);
    }

    const series = this.history.get(category)!;
    series.push({ timestamp, value, label });

    // Limiter la taille
    if (series.length > this.maxHistorySize) {
      series.shift();
    }

    // Analyser les patterns périodiquement
    if (series.length % 10 === 0) {
      this.analyzeSeasonality(category);
    }
  }

  /**
   * Prédit la prochaine valeur pour une catégorie
   */
  predictNext(category: string, horizonMinutes: number = 30): PredictionResult {
    const series = this.history.get(category);

    if (!series || series.length < 5) {
      return {
        predictedValue: 0,
        confidence: 0,
        trend: "stable",
      };
    }

    // Moyenne mobile pondérée (plus récent = plus important)
    const recent = series.slice(-10);
    const weights = recent.map((_, i) => i + 1);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const weightedAvg =
      recent.reduce((sum, p, i) => sum + p.value * weights[i], 0) / weightSum;

    // Calcul de la tendance
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstAvg =
      firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

    let trend: PredictionResult["trend"] = "stable";
    if (secondAvg > firstAvg * 1.1) trend = "increasing";
    else if (secondAvg < firstAvg * 0.9) trend = "decreasing";

    // Calcul de la confiance basée sur la variance
    const mean = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
    const variance =
      recent.reduce((sum, p) => sum + Math.pow(p.value - mean, 2), 0) /
      recent.length;
    const stdDev = Math.sqrt(variance);
    const confidence = Math.max(0, 1 - stdDev / (mean || 1)) * 0.8 + 0.2;

    // Prédiction avec tendance
    const trendFactor = trend === "increasing" ? 1.1 : trend === "decreasing" ? 0.9 : 1;
    const predictedValue = weightedAvg * trendFactor;

    // Prédiction du prochain moment
    const nextOccurrence = this.predictNextOccurrence(category);

    // Détection d'anomalie
    const anomaly = this.isAnomaly(category, predictedValue);

    return {
      predictedValue,
      confidence,
      trend,
      nextOccurrence,
      anomaly,
    };
  }

  /**
   * Prédit le meilleur moment pour une action
   */
  predictBestTime(
    category: string,
    timeWindowHours: number = 24
  ): Array<{
    time: Date;
    probability: number;
    reason: string;
  }> {
    const series = this.history.get(category);
    if (!series || series.length < 10) {
      return [];
    }

    const slots: Map<number, number[]> = new Map();

    // Grouper par heure
    for (const point of series) {
      const hour = point.timestamp.getHours();
      if (!slots.has(hour)) {
        slots.set(hour, []);
      }
      slots.get(hour)!.push(point.value);
    }

    // Calculer les probabilités
    const probabilities: Array<{ time: Date; probability: number; reason: string }> = [];
    const now = new Date();

    for (let h = 0; h < 24; h++) {
      const hourValues = slots.get(h);
      if (hourValues && hourValues.length > 0) {
        const avg = hourValues.reduce((a, b) => a + b, 0) / hourValues.length;
        const frequency = hourValues.length / series.length;
        const probability = Math.min(1, avg * frequency * 10);

        if (probability > 0.3) {
          const time = new Date(now);
          time.setHours(h, 0, 0, 0);
          if (time <= now) {
            time.setDate(time.getDate() + 1);
          }

          probabilities.push({
            time,
            probability,
            reason: `${hourValues.length} occurrences historiques à ${h}h`,
          });
        }
      }
    }

    return probabilities
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5);
  }

  /**
   * Détecte les anomalies dans le comportement
   */
  detectAnomalies(): Array<{
    category: string;
    timestamp: Date;
    expectedValue: number;
    actualValue: number;
    deviation: number;
  }> {
    const anomalies: Array<{
      category: string;
      timestamp: Date;
      expectedValue: number;
      actualValue: number;
      deviation: number;
    }> = [];

    for (const [category, series] of this.history) {
      if (series.length < 10) continue;

      // Calculer moyenne et écart-type
      const values = series.map((p) => p.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Points > 2 sigma = anomalies
      const threshold = 2 * stdDev;
      for (const point of series.slice(-5)) {
        const deviation = Math.abs(point.value - mean);
        if (deviation > threshold) {
          anomalies.push({
            category,
            timestamp: point.timestamp,
            expectedValue: mean,
            actualValue: point.value,
            deviation: deviation / stdDev,
          });
        }
      }
    }

    return anomalies.sort((a, b) => b.deviation - a.deviation);
  }

  /**
   * Analyse les patterns saisonniers
   */
  private analyzeSeasonality(category: string): void {
    const series = this.history.get(category);
    if (!series || series.length < 20) return;

    // Analyse horaire
    const hourlyCounts = new Array(24).fill(0);
    for (const point of series) {
      hourlyCounts[point.timestamp.getHours()]++;
    }

    // Trouver les pics
    const avg = hourlyCounts.reduce((a, b) => a + b, 0) / 24;
    const peakHours = hourlyCounts
      .map((count, hour) => ({ count, hour }))
      .filter((h) => h.count > avg * 1.5)
      .map((h) => h.hour);

    if (peakHours.length > 0) {
      this.patterns.set(category, {
        type: "hourly",
        peakHours,
        confidence: Math.min(1, series.length / 50),
      });
    }
  }

  /**
   * Prédit quand aura lieu le prochain événement
   */
  private predictNextOccurrence(category: string): Date | undefined {
    const pattern = this.patterns.get(category);
    if (!pattern || pattern.peakHours.length === 0) {
      return undefined;
    }

    const now = new Date();
    const currentHour = now.getHours();

    // Trouver la prochaine heure de pic
    const nextPeak = pattern.peakHours.find((h) => h > currentHour);
    const predictedHour = nextPeak ?? pattern.peakHours[0];

    const nextDate = new Date(now);
    nextDate.setHours(predictedHour, 0, 0, 0);

    if (!nextPeak) {
      nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
  }

  /**
   * Vérifie si une valeur est anormale
   */
  private isAnomaly(category: string, value: number): boolean {
    const series = this.history.get(category);
    if (!series || series.length < 10) return false;

    const values = series.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    return Math.abs(value - mean) > 2 * stdDev;
  }

  /**
   * Obtient les statistiques d'une catégorie
   */
  getStats(category: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    last24h: number;
    trend: string;
  } | null {
    const series = this.history.get(category);
    if (!series || series.length === 0) return null;

    const values = series.map((p) => p.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24h = series.filter((p) => p.timestamp > oneDayAgo).length;

    const prediction = this.predictNext(category);

    return {
      count: series.length,
      average: avg,
      min: Math.min(...values),
      max: Math.max(...values),
      last24h,
      trend: prediction.trend,
    };
  }

  /**
   * Exporte les données pour analyse externe
   */
  exportData(): Record<string, TimeSeriesPoint[]> {
    const exported: Record<string, TimeSeriesPoint[]> = {};
    for (const [category, series] of this.history) {
      exported[category] = [...series];
    }
    return exported;
  }

  /**
   * Importe des données historiques
   */
  importData(data: Record<string, TimeSeriesPoint[]>): void {
    for (const [category, series] of Object.entries(data)) {
      this.history.set(
        category,
        series.map((p) => ({
          ...p,
          timestamp: new Date(p.timestamp),
        }))
      );
    }
  }
}
