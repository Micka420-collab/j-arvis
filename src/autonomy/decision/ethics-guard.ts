/**
 * Garde-fou éthique pour les décisions autonomes
 * Vérifie que les décisions respectent les principes éthiques et de sécurité
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type {
  Decision,
  EthicsCheck,
  EthicsRule,
  EthicsViolation,
  Risk,
} from "../types.js";

const log = createSubsystemLogger("autonomy:ethics");

export type EthicsGuardConfig = {
  strictMode: boolean;
  requireApprovalForHighRisk: boolean;
  maxFinancialImpact: number; // en euros
  userConsentRequired: string[];
};

const DEFAULT_CONFIG: EthicsGuardConfig = {
  strictMode: false,
  requireApprovalForHighRisk: true,
  maxFinancialImpact: 50,
  userConsentRequired: ["data_sharing", "financial", "privacy"],
};

export class EthicsGuard {
  private config: EthicsGuardConfig;
  private rules: EthicsRule[];

  constructor(config: Partial<EthicsGuardConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = this.initializeRules();
    log.info("EthicsGuard initialized");
  }

  /**
   * Vérifie une décision contre toutes les règles éthiques
   */
  checkDecision(decision: Decision): EthicsCheck {
    const violations: EthicsViolation[] = [];

    for (const rule of this.rules) {
      const passed = rule.check(decision);
      if (!passed) {
        violations.push({
          ruleId: rule.id,
          severity: rule.priority,
          description: `Failed rule: ${rule.name} - ${rule.description}`,
          recommendation: this.getRecommendation(rule, decision),
        });
      }
    }

    // Vérifications spécifiques
    const riskViolations = this.checkRiskProfile(decision);
    violations.push(...riskViolations);

    const privacyViolations = this.checkPrivacy(decision);
    violations.push(...privacyViolations);

    const safetyViolations = this.checkSafety(decision);
    violations.push(...safetyViolations);

    // Déterminer si une révision humaine est nécessaire
    const requiresHumanReview =
      violations.some((v) => v.severity === "critical") ||
      (this.config.requireApprovalForHighRisk && this.hasHighRisk(decision));

    const passed =
      violations.length === 0 ||
      (!this.config.strictMode &&
        !violations.some((v) => v.severity === "critical"));

    return {
      decisionId: decision.id,
      checks: this.rules,
      passed,
      violations,
      requiresHumanReview,
    };
  }

  /**
   * Évalue le niveau de risque d'une décision
   */
  assessRiskLevel(decision: Decision): "low" | "medium" | "high" | "critical" {
    let riskScore = 0;

    // Facteurs de risque
    const { selectedOption, context } = decision;

    // 1. Risques explicites
    for (const risk of selectedOption.risks) {
      riskScore += risk.probability * this.impactMultiplier(risk.impact);
    }

    // 2. Urgence
    const urgencyMultiplier = { low: 0.5, medium: 1, high: 1.5, critical: 2 };
    riskScore *= urgencyMultiplier[context.urgency];

    // 3. Autonomie
    const autonomyMultiplier = {
      none: 0.5,
      suggest: 0.7,
      ask: 0.8,
      act_with_notice: 1,
      full: 1.2,
    };
    riskScore *= autonomyMultiplier[decision.autonomyLevel];

    // 4. Impact irréversible
    if (this.isIrreversible(selectedOption)) {
      riskScore *= 1.5;
    }

    // Classifier
    if (riskScore >= 1.5) return "critical";
    if (riskScore >= 1.0) return "high";
    if (riskScore >= 0.5) return "medium";
    return "low";
  }

  /**
   * Ajoute une règle éthique personnalisée
   */
  addRule(rule: EthicsRule): void {
    this.rules.push(rule);
    log.info(`Added ethics rule: ${rule.name}`);
  }

  /**
   * Supprime une règle
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  /**
   * Liste toutes les règles
   */
  getRules(): EthicsRule[] {
    return [...this.rules];
  }

  /**
   * Vérifie si une action est sûre
   */
  isSafeAction(action: string, parameters: Record<string, unknown>): boolean {
    // Liste d'actions dangereuses
    const dangerousPatterns = [
      /delete.*all/i,
      /format.*disk/i,
      /rm\s+-rf/i,
      /drop.*database/i,
      /transfer.*all.*funds/i,
      /disable.*security/i,
    ];

    const actionStr = `${action} ${JSON.stringify(parameters)}`;
    return !dangerousPatterns.some((pattern) => pattern.test(actionStr));
  }

  /**
   * Génère une explication de la décision éthique
   */
  generateEthicsExplanation(check: EthicsCheck): string {
    const parts: string[] = [];

    if (check.passed) {
      parts.push("✅ Cette décision respecte tous les critères éthiques.");
    } else {
      parts.push("⚠️ Cette décision présente des considérations éthiques:");
      for (const violation of check.violations) {
        parts.push(`  - ${violation.description}`);
        parts.push(`    Recommandation: ${violation.recommendation}`);
      }
    }

    if (check.requiresHumanReview) {
      parts.push("👤 Une validation humaine est requise avant exécution.");
    }

    return parts.join("\n");
  }

  // ============================================================================
  // Règles éthiques par défaut
  // ============================================================================

  private initializeRules(): EthicsRule[] {
    return [
      {
        id: "non_maleficence",
        name: "Non-malfaisance",
        description: "Ne pas causer de préjudice à l'utilisateur",
        priority: "critical",
        check: (decision) => {
          // Vérifier qu'aucun risque critique n'est présent
          return !decision.selectedOption.risks.some(
            (r) => r.impact === "severe" && r.probability > 0.3
          );
        },
      },
      {
        id: "user_autonomy",
        name: "Autonomie de l'utilisateur",
        description: "Respecter la liberté de choix de l'utilisateur",
        priority: "high",
        check: (decision) => {
          // Les décisions à haut risque ne doivent pas être en mode "full" autonomie
          if (this.hasHighRisk(decision) && decision.autonomyLevel === "full") {
            return false;
          }
          return true;
        },
      },
      {
        id: "transparency",
        name: "Transparence",
        description: "Les décisions doivent être explicables",
        priority: "medium",
        check: (decision) => {
          // Vérifier qu'il y a une justification
          return (
            decision.reasoning.length > 10 &&
            decision.selectedOption.expectedOutcome.length > 0
          );
        },
      },
      {
        id: "privacy_protection",
        name: "Protection de la vie privée",
        description: "Ne pas exposer de données personnelles",
        priority: "high",
        check: (decision) => {
          // Vérifier que la décision ne partage pas de données sensibles
          const params = JSON.stringify(decision.selectedOption.parameters);
          return !this.containsSensitiveData(params);
        },
      },
      {
        id: "fairness",
        name: "Équité",
        description: "Les décisions doivent être justes et non discriminatoires",
        priority: "high",
        check: (decision) => {
          // Vérifier qu'il n'y a pas de biais apparents
          return true; // Implémentation simplifiée
        },
      },
      {
        id: "accountability",
        name: "Responsabilité",
        description: "Les décisions doivent être traçables",
        priority: "medium",
        check: (decision) => {
          // Vérifier que la décision a un ID et un timestamp
          return !!decision.id && !!decision.timestamp;
        },
      },
    ];
  }

  // ============================================================================
  // Méthodes de vérification spécifiques
  // ============================================================================

  private checkRiskProfile(decision: Decision): EthicsViolation[] {
    const violations: EthicsViolation[] = [];
    const { selectedOption } = decision;

    // Vérifier les risques cumulés
    const totalRisk = selectedOption.risks.reduce((sum, r) => {
      return sum + r.probability * this.impactMultiplier(r.impact);
    }, 0);

    if (totalRisk > 2.0) {
      violations.push({
        ruleId: "cumulative_risk",
        severity: "high",
        description: "Risque cumulé trop élevé",
        recommendation: "Réduire le scope de l'action ou demander confirmation",
      });
    }

    // Vérifier les actions irréversibles
    if (this.isIrreversible(selectedOption) && decision.autonomyLevel !== "ask") {
      violations.push({
        ruleId: "irreversible_action",
        severity: "high",
        description: "Action potentiellement irréversible sans confirmation",
        recommendation: "Passer en mode 'ask' pour les actions irréversibles",
      });
    }

    return violations;
  }

  private checkPrivacy(decision: Decision): EthicsViolation[] {
    const violations: EthicsViolation[] = [];
    const params = JSON.stringify(decision.selectedOption.parameters);

    // Vérifier les données sensibles
    if (this.containsSensitiveData(params)) {
      violations.push({
        ruleId: "privacy_exposure",
        severity: "high",
        description: "Données sensibles potentiellement exposées",
        recommendation: "Anonymiser les données ou limiter le partage",
      });
    }

    // Vérifier les consentements
    for (const consent of this.config.userConsentRequired) {
      if (params.includes(consent) && decision.autonomyLevel === "full") {
        violations.push({
          ruleId: `consent_${consent}`,
          severity: "medium",
          description: `Action concernant ${consent} sans consentement explicite`,
          recommendation: "Obtenir le consentement de l'utilisateur",
        });
      }
    }

    return violations;
  }

  private checkSafety(decision: Decision): EthicsViolation[] {
    const violations: EthicsViolation[] = [];
    const { selectedOption } = decision;

    // Vérifier les commandes système dangereuses
    if (!this.isSafeAction(selectedOption.action, selectedOption.parameters)) {
      violations.push({
        ruleId: "safety_critical",
        severity: "critical",
        description: "Action potentiellement dangereuse pour le système",
        recommendation: "Bloquer l'action et notifier l'administrateur",
      });
    }

    // Vérifier les impacts financiers
    const financialImpact = this.estimateFinancialImpact(selectedOption);
    if (financialImpact > this.config.maxFinancialImpact) {
      violations.push({
        ruleId: "financial_limit",
        severity: "high",
        description: `Impact financier (${financialImpact}€) dépasse la limite`,
        recommendation: "Demander approbation explicite",
      });
    }

    return violations;
  }

  // ============================================================================
  // Méthodes utilitaires
  // ============================================================================

  private hasHighRisk(decision: Decision): boolean {
    return decision.selectedOption.risks.some(
      (r) => r.impact === "high" || r.impact === "severe"
    );
  }

  private impactMultiplier(impact: Risk["impact"]): number {
    const multipliers = { low: 0.25, medium: 0.5, high: 0.75, severe: 1.0 };
    return multipliers[impact];
  }

  private isIrreversible(option: Decision["selectedOption"]): boolean {
    const irreversibleActions = [
      "delete",
      "remove",
      "erase",
      "format",
      "reset",
      "revoke",
      "cancel_subscription",
    ];
    return irreversibleActions.some((action) =>
      option.action.toLowerCase().includes(action)
    );
  }

  private containsSensitiveData(text: string): boolean {
    const sensitivePatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Carte bancaire
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /password["']?\s*[:=]\s*["'][^"']+/i, // Mot de passe
      /token["']?\s*[:=]\s*["'][^"']+/i, // Token
    ];

    return sensitivePatterns.some((pattern) => pattern.test(text));
  }

  private estimateFinancialImpact(option: Decision["selectedOption"]): number {
    // Estimation simplifiée
    const params = JSON.stringify(option.parameters);
    const amountMatch = params.match(/amount["']?\s*[:=]\s*(\d+(?:\.\d+)?)/);
    if (amountMatch) {
      return parseFloat(amountMatch[1]);
    }
    return 0;
  }

  private getRecommendation(rule: EthicsRule, decision: Decision): string {
    const recommendations: Record<string, string> = {
      non_maleficence: "Réévaluer les risques et ajouter des mesures de protection",
      user_autonomy: "Passer en mode 'ask' ou 'suggest' au lieu de 'full'",
      transparency: "Fournir une explication détaillée de la décision",
      privacy_protection: "Anonymiser les données ou demander consentement explicite",
      fairness: "Réviser les critères de décision pour éviter les biais",
      accountability: "Journaliser la décision avec plus de détails",
    };

    return recommendations[rule.id] || "Réviser la décision";
  }
}
