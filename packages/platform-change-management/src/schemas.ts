/**
 * @nzila/platform-change-management — Zod schemas
 *
 * Runtime validation schemas for all Change Enablement types.
 * All timestamps must be ISO UTC.
 *
 * @module @nzila/platform-change-management/schemas
 */
import { z } from 'zod'

// ── Enum schemas ────────────────────────────────────────────────────────────

export const changeTypeSchema = z.enum(['STANDARD', 'NORMAL', 'EMERGENCY'])

export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

export const changeStatusSchema = z.enum([
  'PROPOSED',
  'UNDER_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'IMPLEMENTING',
  'COMPLETED',
  'FAILED',
  'ROLLED_BACK',
  'CLOSED',
])

export const approvalStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED'])

export const environmentSchema = z.enum(['STAGING', 'PROD'])

export const approvalRoleSchema = z.enum([
  'service_owner',
  'change_manager',
  'security_approver',
  'platform_owner',
  'staging_mission_owner',
])

export const pirOutcomeSchema = z.enum([
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'ROLLED_BACK',
])

// ── ISO timestamp string ────────────────────────────────────────────────────

const isoTimestampSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Must be a valid ISO 8601 timestamp' },
)

// ── Post Implementation Review ──────────────────────────────────────────────

export const postImplementationReviewSchema = z.object({
  outcome: pirOutcomeSchema,
  incidents_triggered: z.boolean(),
  incident_refs: z.array(z.string()),
  observations: z.string(),
})

// ── Change Record ───────────────────────────────────────────────────────────

export const changeRecordSchema = z.object({
  change_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  service: z.string().min(1),
  environment: environmentSchema,
  change_type: changeTypeSchema,
  risk_level: riskLevelSchema,
  impact_summary: z.string().min(1),
  requested_by: z.string().min(1),
  approvers_required: z.array(z.string()),
  approved_by: z.array(z.string()),
  approval_status: approvalStatusSchema,
  staging_authorization: z.object({
    mission: z.string(),
    owner_github_login: z.string(),
    owner_instruction_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    owner_instruction_ref: z.string(),
    delegate: z.object({ name: z.string(), authenticated_github_login: z.string(), azure_identity: z.string() }).strict(),
    resources: z.object({
      subscription_id: z.string(), tenant_id: z.string(), container_app: z.string(),
      container_app_resource_group: z.string(), postgres_server: z.string(),
      postgres_resource_group: z.string(), database: z.string(), key_vault: z.string(),
      clone_name_prefix: z.string(), region: z.string(),
    }).strict(),
    production_authorized: z.literal(false),
    security_proof_required: z.literal(true),
    signed_release_required: z.literal(true),
  }).strict().optional(),
  implementation_window_start: isoTimestampSchema,
  implementation_window_end: isoTimestampSchema,
  rollback_plan: z.string().min(1),
  test_evidence_refs: z.array(z.string()),
  linked_prs: z.array(z.string()),
  linked_commits: z.array(z.string()),
  linked_build_attestation: z.string().optional(),
  status: changeStatusSchema,
  created_at: isoTimestampSchema,
  updated_at: isoTimestampSchema,
  completed_at: isoTimestampSchema.optional(),
  post_implementation_review: postImplementationReviewSchema.optional(),
})

// ── Freeze Period ───────────────────────────────────────────────────────────

export const freezePeriodSchema = z.object({
  name: z.string().min(1),
  start: isoTimestampSchema,
  end: isoTimestampSchema,
  environments: z.array(environmentSchema),
})

// ── Calendar Policy ─────────────────────────────────────────────────────────

export const calendarPolicySchema = z.object({
  freeze_periods: z.array(freezePeriodSchema),
  restricted_hours: z
    .object({
      weekdays_only: z.boolean().optional(),
      start_hour: z.number().min(0).max(23).optional(),
      end_hour: z.number().min(0).max(23).optional(),
    })
    .optional(),
})

// ── Validation Result ───────────────────────────────────────────────────────

export const changeValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  change_id: z.string().optional(),
})
