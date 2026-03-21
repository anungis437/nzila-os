/**
 * AI Risk Classification Engine
 *
 * Multi-factor risk scoring for AI/ML models aligned with:
 * - NIST AI RMF risk categories
 * - Existing actionsPolicy.ts risk tiers
 * - SOC 2 Type II control requirements
 */

import { z } from 'zod';

// ── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
  factor: string;
  weight: number; // 0-1
  score: number;  // 0-100
  justification: string;
}

export interface RiskClassification {
  modelId: string;
  overallScore: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  requiredControls: string[];
  classifiedAt: string;
  classifiedBy: string;
}

export const RiskClassificationSchema = z.object({
  modelId: z.string(),
  overallScore: z.number().min(0).max(100),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  factors: z.array(z.object({
    factor: z.string(),
    weight: z.number().min(0).max(1),
    score: z.number().min(0).max(100),
    justification: z.string(),
  })),
  requiredControls: z.array(z.string()),
  classifiedAt: z.string().datetime(),
  classifiedBy: z.string(),
});

// ── Thresholds ───────────────────────────────────────────────────────────────

export const RISK_THRESHOLDS = {
  low: { min: 0, max: 25 },
  medium: { min: 25, max: 50 },
  high: { min: 50, max: 75 },
  critical: { min: 75, max: 100 },
} as const;

// ── Required Controls by Risk Level ──────────────────────────────────────────

const REQUIRED_CONTROLS: Record<RiskLevel, string[]> = {
  low: [
    'audit-logging',
    'input-validation',
  ],
  medium: [
    'audit-logging',
    'input-validation',
    'pii-redaction',
    'budget-caps',
    'output-monitoring',
  ],
  high: [
    'audit-logging',
    'input-validation',
    'pii-redaction',
    'budget-caps',
    'output-monitoring',
    'human-review',
    'content-safety-filter',
    'model-card-required',
    'quarterly-review',
  ],
  critical: [
    'audit-logging',
    'input-validation',
    'pii-redaction',
    'budget-caps',
    'output-monitoring',
    'human-review',
    'content-safety-filter',
    'model-card-required',
    'quarterly-review',
    'dual-approval',
    'real-time-monitoring',
    'incident-response-plan',
    'red-team-testing',
    'bias-assessment',
  ],
};

// ── Classification Engine ────────────────────────────────────────────────────

interface ClassificationInput {
  modelId: string;
  classifiedBy: string;

  // Factor inputs (each 0-100)
  autonomyLevel: number;       // How much autonomous decision-making
  dataClassification: number;  // 0=public, 33=internal, 66=sensitive, 100=regulated
  impactScope: number;         // Number of users/orgs affected
  reversibility: number;       // 0=fully reversible, 100=irreversible
  transparency: number;        // 0=fully interpretable, 100=black box
  biasRisk: number;            // Demographic bias risk
  safetyImpact: number;        // Physical/financial safety impact
}

/**
 * Classify an AI/ML model's risk level using weighted multi-factor scoring.
 */
export function classifyRisk(input: ClassificationInput): RiskClassification {
  const factors: RiskFactor[] = [
    {
      factor: 'Autonomy Level',
      weight: 0.20,
      score: input.autonomyLevel,
      justification: `Autonomy score: ${input.autonomyLevel}/100`,
    },
    {
      factor: 'Data Classification',
      weight: 0.20,
      score: input.dataClassification,
      justification: `Data classification score: ${input.dataClassification}/100`,
    },
    {
      factor: 'Impact Scope',
      weight: 0.15,
      score: input.impactScope,
      justification: `Impact scope score: ${input.impactScope}/100`,
    },
    {
      factor: 'Reversibility',
      weight: 0.10,
      score: input.reversibility,
      justification: `Reversibility score: ${input.reversibility}/100`,
    },
    {
      factor: 'Transparency',
      weight: 0.10,
      score: input.transparency,
      justification: `Transparency score: ${input.transparency}/100`,
    },
    {
      factor: 'Bias Risk',
      weight: 0.10,
      score: input.biasRisk,
      justification: `Bias risk score: ${input.biasRisk}/100`,
    },
    {
      factor: 'Safety Impact',
      weight: 0.15,
      score: input.safetyImpact,
      justification: `Safety impact score: ${input.safetyImpact}/100`,
    },
  ];

  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.weight * f.score, 0),
  );

  let riskLevel: RiskLevel;
  if (overallScore >= RISK_THRESHOLDS.critical.min) {
    riskLevel = 'critical';
  } else if (overallScore >= RISK_THRESHOLDS.high.min) {
    riskLevel = 'high';
  } else if (overallScore >= RISK_THRESHOLDS.medium.min) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    modelId: input.modelId,
    overallScore,
    riskLevel,
    factors,
    requiredControls: REQUIRED_CONTROLS[riskLevel],
    classifiedAt: new Date().toISOString(),
    classifiedBy: input.classifiedBy,
  };
}
