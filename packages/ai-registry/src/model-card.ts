/**
 * Standardized Model Cards
 *
 * Extends the UnionEyes ModelCard pattern to be a platform-wide standard.
 * Every AI/ML model in Nzila must have a model card before deployment.
 *
 * References:
 * - apps/union-eyes/lib/ai/transparency.ts (existing ModelCard)
 * - governance/ai/AI_MODEL_MANAGEMENT.md
 * - governance/ai/AI_SAFETY_PROTOCOLS.md
 */

import { z } from 'zod';

// ── Schemas ──────────────────────────────────────────────────────────────────

const ModelLimitationSchema = z.object({
  category: z.enum([
    'accuracy',
    'bias',
    'coverage',
    'latency',
    'cost',
    'data-quality',
    'adversarial',
    'out-of-distribution',
  ]),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  mitigation: z.string().optional(),
});

const SafetyMeasureSchema = z.object({
  measure: z.string(),
  type: z.enum([
    'input-filtering',
    'output-validation',
    'pii-redaction',
    'content-safety',
    'rate-limiting',
    'budget-cap',
    'human-review',
    'circuit-breaker',
  ]),
  enforced: z.boolean(),
  enforcementLayer: z.enum(['sdk', 'gateway', 'policy', 'infrastructure']),
});

const GovernanceInfoSchema = z.object({
  humanOversight: z.boolean(),
  auditLogging: z.boolean(),
  appealAvailable: z.boolean(),
  dataRetentionDays: z.number().positive(),
  escalationPolicy: z.string().optional(),
  complianceFrameworks: z.array(z.string()).default([]),
});

const EvaluationMetricsSchema = z.object({
  accuracy: z.number().min(0).max(1).optional(),
  precision: z.number().min(0).max(1).optional(),
  recall: z.number().min(0).max(1).optional(),
  f1Score: z.number().min(0).max(1).optional(),
  latencyP50Ms: z.number().positive().optional(),
  latencyP99Ms: z.number().positive().optional(),
  costPerRequest: z.number().positive().optional(),
  evaluationDatasetSize: z.number().positive().optional(),
  lastEvaluated: z.string().datetime().optional(),
});

export const ModelCardSchema = z.object({
  // Identity
  modelId: z.string(),
  displayName: z.string(),
  version: z.string(),
  provider: z.enum(['openai', 'azure-openai', 'anthropic', 'internal', 'third-party']),
  modality: z.enum(['text', 'embedding', 'vision', 'audio', 'multimodal', 'classification', 'regression', 'anomaly-detection']),

  // Purpose
  purpose: z.string(),
  intendedUse: z.string(),
  outOfScopeUse: z.array(z.string()),

  // Risk & Classification
  riskTier: z.enum(['low', 'medium', 'high', 'critical']),
  dataClassification: z.enum(['public', 'internal', 'sensitive', 'regulated']),

  // Technical
  trainingData: z.string().optional(),
  architecture: z.string().optional(),
  inputFormat: z.string(),
  outputFormat: z.string(),

  // Evaluation
  metrics: EvaluationMetricsSchema.optional(),

  // Limitations & Safety
  limitations: z.array(ModelLimitationSchema),
  safetyMeasures: z.array(SafetyMeasureSchema),

  // Governance
  governance: GovernanceInfoSchema,

  // Ownership
  owner: z.string(),
  team: z.string(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),

  // Lifecycle
  status: z.enum(['draft', 'review', 'approved', 'deployed', 'deprecated', 'retired']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ModelCard = z.infer<typeof ModelCardSchema>;
export type ModelLimitation = z.infer<typeof ModelLimitationSchema>;
export type SafetyMeasure = z.infer<typeof SafetyMeasureSchema>;
export type GovernanceInfo = z.infer<typeof GovernanceInfoSchema>;

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a validated model card. Enforces all required fields
 * and validates consistency (e.g., high-risk models MUST have human oversight).
 */
export function createModelCard(input: z.input<typeof ModelCardSchema>): ModelCard {
  const card = ModelCardSchema.parse(input);

  // Governance invariants
  if (card.riskTier === 'high' || card.riskTier === 'critical') {
    if (!card.governance.humanOversight) {
      throw new Error(
        `Model ${card.modelId}: high/critical risk models MUST have humanOversight=true`,
      );
    }
    if (!card.governance.auditLogging) {
      throw new Error(
        `Model ${card.modelId}: high/critical risk models MUST have auditLogging=true`,
      );
    }
  }

  // Sensitive/regulated data requires PII redaction
  if (card.dataClassification === 'sensitive' || card.dataClassification === 'regulated') {
    const hasPiiRedaction = card.safetyMeasures.some((m) => m.type === 'pii-redaction' && m.enforced);
    if (!hasPiiRedaction) {
      throw new Error(
        `Model ${card.modelId}: sensitive/regulated data requires enforced PII redaction`,
      );
    }
  }

  return card;
}
