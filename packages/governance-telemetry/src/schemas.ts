/**
 * @nzila/governance-telemetry — Schemas
 *
 * Zod schemas for governance event envelopes. Schemas are versioned;
 * the registry below maps event types to their payload schemas.
 *
 * @module @nzila/governance-telemetry/schemas
 */
import { z } from 'zod'

import type { GovernanceEventEnvelope, GovernanceEventType } from './types'

export const ENVELOPE_SCHEMA_VERSION = '1.0.0' as const

// ── Primitive schemas ───────────────────────────────────────────────────────

export const governanceSeveritySchema = z.enum(['info', 'warning', 'critical'])

export const governanceDecisionSchema = z.enum([
  'allow',
  'deny',
  'require_approval',
  'require_review',
])

export const governanceProductSchema = z.enum([
  'union-eyes',
  'faircase',
  'executive-os',
  'veridian',
  'platform',
])

export const governanceEnvironmentClassSchema = z.enum([
  'production',
  'pilot',
  'staging',
  'demo',
  'development',
])

export const governanceScopeSchema = z
  .object({
    product: governanceProductSchema,
    environment: z.string().min(1),
    environmentClass: governanceEnvironmentClassSchema,
    orgScope: z.string().min(1).optional(),
    pilotScope: z.string().min(1).optional(),
  })
  .strict()

export const governanceSubjectKindSchema = z.enum([
  'route',
  'surface',
  'workflow',
  'queue',
  'invocation',
  'release',
  'environment',
  'capability',
  'config',
])

export const governanceSubjectSchema = z
  .object({
    kind: governanceSubjectKindSchema,
    id: z.string().min(1),
    label: z.string().min(1).optional(),
  })
  .strict()

export const doctrineCitationSchema = z
  .object({
    document: z.string().min(1),
    section: z.string().min(1).optional(),
    policyId: z.string().min(1).optional(),
  })
  .strict()

export const governanceEventTypeSchema = z.enum([
  'doctrine_violation',
  'governance_warning',
  'continuity_risk_detected',
  'executive_cognitive_overload_risk',
  'deployment_legitimacy_failure',
  'pilot_boundary_violation',
  'governance_safe_ai_violation',
  'continuity_posture_changed',
  'governance_friction_detected',
  'calmness_degradation_signal',
  'pacing_violation',
  'density_threshold_exceeded',
  'escalation_concentration_detected',
  'ai_explainability_failure',
  'governance_safe_ai_warning',
  'human_oversight_violation',
  'opaque_recommendation_detected',
  'unknown_release_state',
  'environment_drift_detected',
  'deployment_identity_failure',
  'migration_parity_failure',
  'isolation_violation',
  'environment_identity_verified',
  'governance_review_recorded',
  'governance_decision_emitted',
  'assurance_posture_updated',
  'modernization_pace_violation',
  'irreversible_change_detected',
]) satisfies z.ZodType<GovernanceEventType>

// ── Envelope schema ────────────────────────────────────────────────────────

const isoTimestamp = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'must be ISO-8601' })

const ulidLike = z
  .string()
  .min(8)
  .max(64)
  .refine((s) => !/[\s]/.test(s), { message: 'must not contain whitespace' })

/**
 * Anti-surveillance guardrail.
 *
 * Reject obvious individual-identifier keys in payloads. This is a structural
 * safety net, not a complete defense — domain-specific schemas are responsible
 * for additional discipline.
 */
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'userId',
  'user_id',
  'employeeId',
  'employee_id',
  'email',
  'phone',
  'ip',
  'ipAddress',
  'sessionId',
  'session_id',
])

const governancePayloadSchema = z
  .record(z.unknown())
  .refine(
    (payload) => {
      for (const key of Object.keys(payload)) {
        if (FORBIDDEN_PAYLOAD_KEYS.has(key)) return false
      }
      return true
    },
    {
      message:
        'governance payload contains an individual-resolving key; use aggregation-safe scope keys',
    },
  )

export const governanceEventEnvelopeSchema = z
  .object({
    id: ulidLike,
    schemaVersion: z.string().min(1),
    type: governanceEventTypeSchema,
    severity: governanceSeveritySchema,
    scope: governanceScopeSchema,
    subject: governanceSubjectSchema,
    doctrineCitations: z.array(doctrineCitationSchema).min(1).optional(),
    decision: governanceDecisionSchema.optional(),
    releaseId: z.string().min(1),
    emittedAt: isoTimestamp,
    payload: governancePayloadSchema,
    correlationKey: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (env) =>
      env.severity === 'info' ||
      (env.doctrineCitations !== undefined && env.doctrineCitations.length > 0),
    {
      message: 'doctrine citation required for severity >= "warning"',
      path: ['doctrineCitations'],
    },
  ) satisfies z.ZodType<GovernanceEventEnvelope>

// ── Validation helper ──────────────────────────────────────────────────────

export function validateGovernanceEvent(event: unknown): GovernanceEventEnvelope {
  return governanceEventEnvelopeSchema.parse(event)
}

export function safeValidateGovernanceEvent(
  event: unknown,
): { success: true; data: GovernanceEventEnvelope } | { success: false; error: z.ZodError } {
  const result = governanceEventEnvelopeSchema.safeParse(event)
  if (result.success) return { success: true, data: result.data }
  return { success: false, error: result.error }
}
