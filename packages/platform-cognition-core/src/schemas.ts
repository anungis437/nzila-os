/**
 * @nzila/platform-cognition-core — Zod schemas
 *
 * Runtime validation for every persisted shape. The store will refuse to
 * write a record that does not parse — this is the boundary that keeps the
 * file-backed store honest.
 *
 * @module @nzila/platform-cognition-core/schemas
 */
import { z } from 'zod'

// ── Subject ─────────────────────────────────────────────────────────────────

export const cognitionSubjectSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().min(1),
  userId: z.string().min(1).optional(),
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
})

// ── Memory ──────────────────────────────────────────────────────────────────

export const memoryKindSchema = z.enum(['episodic', 'semantic', 'preference', 'decision', 'trust'])

export const memorySourceSchema = z.enum([
  'user_action',
  'system_event',
  'inference',
  'manual',
  'imported',
])

export const memoryEventSchema = z.object({
  id: z.string().min(1),
  subject: cognitionSubjectSchema,
  kind: memoryKindSchema,
  source: memorySourceSchema,
  type: z.string().min(1),
  payload: z.record(z.unknown()),
  salience: z.number().min(0),
  tags: z.array(z.string()),
  occurredAt: z.string(),
  recordedAt: z.string(),
  redactedAt: z.string().optional(),
  redactionReason: z.string().optional(),
})

export const preferenceProfileSchema = z.object({
  subject: cognitionSubjectSchema,
  scores: z.record(z.number().min(-1).max(1)),
  sampleSize: z.number().int().min(0),
  computedAt: z.string(),
})

// ── Trajectory ──────────────────────────────────────────────────────────────

export const trajectoryRiskKindSchema = z.enum([
  'churn',
  'escalation',
  'aging',
  'disengagement',
  'progression',
])

export const trajectoryFeaturesSchema = z.object({
  subject: cognitionSubjectSchema,
  windowStart: z.string(),
  windowEnd: z.string(),
  eventCount: z.number().int().min(0),
  distinctTypes: z.number().int().min(0),
  // meanGapDays may be Infinity when n<2; encoded as a finite number or null on round-trip.
  meanGapDays: z.number(),
  frequencySlope: z.number(),
  recencyDays: z.number().min(0),
  negativeSignal: z.number().min(0),
  positiveSignal: z.number().min(0),
  escalationEventCount: z.number().int().min(0),
})

export const trajectoryRiskScoreSchema = z.object({
  subject: cognitionSubjectSchema,
  kind: trajectoryRiskKindSchema,
  probability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  contributions: z.array(
    z.object({
      feature: z.string(),
      value: z.number(),
      weight: z.number(),
      contribution: z.number(),
    }),
  ),
  features: trajectoryFeaturesSchema,
  modelVersion: z.string(),
  scoredAt: z.string(),
})

// ── State ───────────────────────────────────────────────────────────────────

export const stateDimensionSchema = z.enum([
  'confusion',
  'fatigue',
  'frustration',
  'urgency',
  'confidence',
  'disengagement',
])

export const stateInferenceSchema = z.object({
  subject: cognitionSubjectSchema,
  dimensions: z.record(stateDimensionSchema, z.number().min(0).max(1)),
  explanations: z.array(
    z.object({
      dimension: stateDimensionSchema,
      drivers: z.array(
        z.object({
          signal: z.string(),
          contribution: z.number(),
        }),
      ),
    }),
  ),
  inferredAt: z.string(),
  modelVersion: z.string(),
})

// ── Consent ─────────────────────────────────────────────────────────────────

export const consentZoneSchema = z.enum([
  'operational',
  'analytics',
  'personalization',
  'cross_product',
  'training',
])

export const jurisdictionSchema = z.enum(['CA', 'EU', 'US', 'AF', 'OTHER'])

export const consentPolicySchema = z.object({
  subject: cognitionSubjectSchema,
  allowedZones: z.array(consentZoneSchema),
  allowedKinds: z.array(memoryKindSchema),
  retentionDays: z.number().int().min(0),
  excludedTags: z.array(z.string()),
  jurisdiction: jurisdictionSchema,
  recordedAt: z.string(),
  lastConfirmedAt: z.string().optional(),
})
