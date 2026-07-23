/**
 * @nzila/ue-cognition/schema — Drizzle schema for the UE Cognition
 * telemetry tables.
 *
 * Phase 0B.2 §12: the six UE Cognition tables live in the `union_eyes`
 * schema (per packages/db/schema-ownership-manifest.json,
 * UNION_EYES_OWNED_EXCLUSIVE) and their `id` column is `text` (not `uuid`)
 * because the runtime writes prefixed identifiers produced by
 * `makeId('crs' | 'wls' | 'mes' | 'pcm' | 'kpi' | 'aud')` in
 * packages/ue-cognition/src/utils.ts.
 *
 * The DDL for these tables lives in
 * packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql. This
 * Drizzle schema is READ-ONLY relative to that migration and must be kept
 * byte-identical in column names and types.
 */
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * Drizzle `pgSchema` handle for the `union_eyes` schema. All UE-owned
 * cognition tables MUST be declared through this handle.
 */
export const unionEyesSchema = pgSchema('union_eyes')

export const ueCaseRiskSnapshots = unionEyesSchema.table('ue_case_risk_snapshots', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  orgId: text('org_id').notNull(), // uuid at DB level; string in TS to match Option D tenant contract
  caseId: text('case_id').notNull(),
  caseKind: text('case_kind').notNull(),
  riskScore: integer('risk_score').notNull(),
  riskProbability: doublePrecision('risk_probability').notNull(),
  riskTier: text('risk_tier').notNull(),
  confidence: doublePrecision('confidence').notNull(),
  recommendedAction: text('recommended_action').notNull(),
  rationale: text('rationale').notNull(),
  topFactors: jsonb('top_factors').notNull(),
  factors: jsonb('factors').notNull(),
  trajectory: jsonb('trajectory').notNull(),
  modelVersion: text('model_version').notNull(),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
})

export const ueWorkloadSnapshots = unionEyesSchema.table('ue_workload_snapshots', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  orgId: text('org_id').notNull(),
  stewardId: text('steward_id').notNull(),
  currentCaseload: integer('current_caseload').notNull(),
  maxCaseload: integer('max_caseload').notNull(),
  utilizationRatio: doublePrecision('utilization_ratio').notNull(),
  atRiskCaseCount: integer('at_risk_case_count').notNull(),
  avgResponseDays: doublePrecision('avg_response_days'),
  status: text('status').notNull(),
  slaRiskScore: doublePrecision('sla_risk_score').notNull(),
  burnoutSignal: doublePrecision('burnout_signal').notNull(),
  recommendedReassignments: jsonb('recommended_reassignments').notNull(),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
})

export const ueEngagementSnapshots = unionEyesSchema.table('ue_engagement_snapshots', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  orgId: text('org_id').notNull(),
  memberId: text('member_id').notNull(),
  engagementScore: integer('engagement_score').notNull(),
  disengagementProbability: doublePrecision('disengagement_probability').notNull(),
  tier: text('tier').notNull(),
  daysSinceLastActivity: doublePrecision('days_since_last_activity').notNull(),
  recentSignals: jsonb('recent_signals').notNull(),
  recommendedChannel: text('recommended_channel').notNull(),
  recommendedTimingHours: doublePrecision('recommended_timing_hours').notNull(),
  modelVersion: text('model_version').notNull(),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
})

export const uePrecedentMatches = unionEyesSchema.table('ue_precedent_matches', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  orgId: text('org_id').notNull(),
  forCaseId: text('for_case_id').notNull(),
  matches: jsonb('matches').notNull(),
  typicalDaysToResolve: doublePrecision('typical_days_to_resolve'),
  typicalSettlementAmount: doublePrecision('typical_settlement_amount'),
  successRate: doublePrecision('success_rate').notNull(),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull().defaultNow(),
})

export const ueKpiSnapshots = unionEyesSchema.table('ue_kpi_snapshots', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  orgId: text('org_id').notNull(),
  windowDays: integer('window_days').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull(),
  modelVersion: text('model_version').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
})

export const ueCognitionAudits = unionEyesSchema.table('ue_cognition_audits', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  orgId: text('org_id').notNull(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  actorId: text('actor_id'),
  resourceId: text('resource_id').notNull(),
  details: jsonb('details').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Convenience flag for tooling that wants to confirm Phase-2 fan-out. */
export const UE_COGNITION_TABLES = [
  ueCaseRiskSnapshots,
  ueWorkloadSnapshots,
  ueEngagementSnapshots,
  uePrecedentMatches,
  ueKpiSnapshots,
  ueCognitionAudits,
] as const

void boolean

