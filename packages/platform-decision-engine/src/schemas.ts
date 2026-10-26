/**
 * @nzila/platform-decision-engine — Zod schemas
 *
 * Runtime validation for all Decision Layer types.
 *
 * @module @nzila/platform-decision-engine/schemas
 */
import { z } from 'zod'

// ── Enum Schemas ────────────────────────────────────────────────────────────

export const decisionCategorySchema = z.enum([
  'STAFFING', 'RISK', 'FINANCIAL', 'GOVERNANCE', 'COMPLIANCE',
  'OPERATIONS', 'PARTNER', 'CUSTOMER', 'DEPLOYMENT', 'OTHER',
])

export const decisionSeveritySchema = z.enum([
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL',
])

export const decisionStatusSchema = z.enum([
  'GENERATED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED',
  'DEFERRED', 'EXECUTED', 'EXPIRED', 'CLOSED',
])

export const decisionTypeSchema = z.enum([
  'RECOMMENDATION', 'ESCALATION', 'REVIEW_REQUEST', 'PRIORITIZATION',
])

export const decisionSourceSchema = z.enum([
  'rules', 'anomaly_engine', 'intelligence_engine', 'agent_workflow', 'hybrid',
])

export const evidenceRefTypeSchema = z.enum([
  'event', 'insight', 'anomaly', 'metric', 'policy', 'snapshot', 'change', 'artifact',
])

export const feedbackActionSchema = z.enum([
  'APPROVE', 'REJECT', 'DEFER', 'EXECUTE', 'COMMENT',
])

export const auditEventTypeSchema = z.enum([
  'decision_generated', 'decision_viewed', 'decision_approved',
  'decision_rejected', 'decision_deferred', 'decision_executed',
  'decision_expired', 'decision_feedback_recorded',
])

// ── Composite Schemas ───────────────────────────────────────────────────────

export const evidenceRefSchema = z.object({
  type: evidenceRefTypeSchema,
  ref_id: z.string(),
  summary: z.string().optional(),
})

export const decisionGeneratedBySchema = z.object({
  source: decisionSourceSchema,
  engine_version: z.string(),
  model_version: z.string().optional(),
})

export const policyContextSchema = z.object({
  execution_allowed: z.boolean(),
  reasons: z.array(z.string()),
})

export const environmentContextSchema = z.object({
  environment: z.enum(['LOCAL', 'PREVIEW', 'STAGING', 'PRODUCTION']),
  protected_environment: z.boolean(),
})

export const decisionOutcomeSchema = z.object({
  accepted: z.boolean(),
  rejected: z.boolean(),
  deferred: z.boolean(),
  executed: z.boolean(),
  execution_notes: z.string().optional(),
})

// ── Decision Record Schema ──────────────────────────────────────────────────

export const decisionRecordSchema = z.object({
  decision_id: z.string(),
  org_id: z.string(),
  category: decisionCategorySchema,
  type: decisionTypeSchema,
  severity: decisionSeveritySchema,
  title: z.string(),
  summary: z.string(),
  explanation: z.string(),
  confidence_score: z.number().min(0).max(1),
  generated_by: decisionGeneratedBySchema,
  evidence_refs: z.array(evidenceRefSchema),
  recommended_actions: z.array(z.string()),
  required_approvals: z.array(z.string()),
  review_required: z.boolean(),
  policy_context: policyContextSchema,
  environment_context: environmentContextSchema,
  status: decisionStatusSchema,
  generated_at: z.string(),
  expires_at: z.string().optional(),
  reviewed_by: z.array(z.string()).optional(),
  review_notes: z.array(z.string()).optional(),
  outcome: decisionOutcomeSchema.optional(),
})

// ── Feedback Schema ─────────────────────────────────────────────────────────

export const decisionFeedbackSchema = z.object({
  decision_id: z.string(),
  actor: z.string(),
  action: feedbackActionSchema,
  notes: z.string().optional(),
  created_at: z.string(),
})

// ── Audit Entry Schema ──────────────────────────────────────────────────────

export const decisionAuditEntrySchema = z.object({
  decision_id: z.string(),
  event_type: auditEventTypeSchema,
  actor: z.string(),
  timestamp: z.string(),
  detail: z.string().optional(),
})

// ── Decision Summary Schema ─────────────────────────────────────────────────

export const decisionSummarySchema = z.object({
  total: z.number(),
  by_severity: z.record(decisionSeveritySchema, z.number()),
  by_category: z.record(decisionCategorySchema, z.number()),
  by_status: z.record(decisionStatusSchema, z.number()),
  pending_review: z.number(),
  critical_open: z.number(),
})

// ── Export Pack Schema ──────────────────────────────────────────────────────

export const decisionExportPackSchema = z.object({
  decision_record: decisionRecordSchema,
  evidence_refs: z.array(evidenceRefSchema),
  policy_context: policyContextSchema,
  governance_status_snapshot: z.record(z.string(), z.unknown()).optional(),
  change_status_snapshot: z.record(z.string(), z.unknown()).optional(),
  output_hash: z.string(),
  exported_at: z.string(),
})
