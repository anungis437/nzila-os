/**
 * Pension Schema
 * Database schema for pension plans, members, benefits, contributions, and T4A records
 */
import { pgTable, text, uuid, numeric, timestamp, integer, jsonb, varchar, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const pensionPlanTypeEnum = pgEnum('pension_plan_type', [
  'defined_benefit',
  'defined_contribution',
  'hybrid',
  'target_benefit',
]);

export const pensionPlanStatusEnum = pgEnum('pension_plan_status', [
  'active',
  'frozen',
  'terminated',
  'pending_approval',
]);

export const pensionMemberStatusEnum = pgEnum('pension_membership_status', [
  'active',
  'inactive',
  'retired',
  'deferred',
  'terminated',
]);

export const vestingStatusEnum = pgEnum('vesting_status', [
  'not_vested',
  'partially_vested',
  'fully_vested',
]);

export const benefitClaimStatusEnum = pgEnum('benefit_claim_status', [
  'pending',
  'under_review',
  'approved',
  'denied',
  'paid',
]);

export const contributionPaymentStatusEnum = pgEnum('contribution_payment_status', [
  'pending',
  'received',
  'overdue',
  'partial',
]);

export const t4aStatusEnum = pgEnum('t4a_status', [
  'draft',
  'generated',
  'filed',
  'amended',
]);

// ─── Pension Plans ──────────────────────────────────────────────────────────────

export const pensionPlans = pgTable('pension_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  planName: varchar('plan_name', { length: 255 }).notNull(),
  planType: varchar('plan_type', { length: 50 }).notNull().default('defined_benefit'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  activeMembers: integer('active_members').notNull().default(0),
  totalAssets: numeric('total_assets', { precision: 15, scale: 2 }).notNull().default('0'),
  fundingStatus: numeric('funding_status', { precision: 5, scale: 2 }).notNull().default('100'),
  description: text('description'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Pension Members ────────────────────────────────────────────────────────────

export const pensionMembers = pgTable('pension_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  planId: uuid('plan_id').notNull(),
  userId: uuid('user_id'),
  name: varchar('name', { length: 255 }).notNull(),
  planName: varchar('plan_name', { length: 255 }).notNull(),
  enrollmentDate: timestamp('enrollment_date', { withTimezone: true }).notNull().defaultNow(),
  membershipStatus: varchar('membership_status', { length: 50 }).notNull().default('active'),
  yearsOfService: numeric('years_of_service', { precision: 5, scale: 1 }).notNull().default('0'),
  vestingStatus: varchar('vesting_status', { length: 50 }).notNull().default('not_vested'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Pension Contributions ──────────────────────────────────────────────────────

export const pensionContributions = pgTable('pension_contributions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  memberId: uuid('member_id').notNull(),
  memberName: varchar('member_name', { length: 255 }).notNull(),
  period: varchar('period', { length: 20 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentStatus: varchar('payment_status', { length: 50 }).notNull().default('pending'),
  paymentDate: timestamp('payment_date', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Benefit Claims ─────────────────────────────────────────────────────────────

export const pensionBenefitClaims = pgTable('pension_benefit_claims', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  memberId: uuid('member_id').notNull(),
  memberName: varchar('member_name', { length: 255 }).notNull(),
  claimType: varchar('claim_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  submittedDate: timestamp('submitted_date', { withTimezone: true }).notNull().defaultNow(),
  processedDate: timestamp('processed_date', { withTimezone: true }),
  notes: text('notes'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── T4A Records ────────────────────────────────────────────────────────────────

export const pensionT4aRecords = pgTable('pension_t4a_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  memberId: uuid('member_id').notNull(),
  memberName: varchar('member_name', { length: 255 }).notNull(),
  taxYear: integer('tax_year').notNull(),
  pensionIncome: numeric('pension_income', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  generatedDate: timestamp('generated_date', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Pension Trustees ───────────────────────────────────────────────────────────

export const pensionTrustees = pgTable('pension_trustees', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  userId: uuid('user_id'),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 100 }).notNull().default('trustee'),
  appointedDate: timestamp('appointed_date', { withTimezone: true }).notNull().defaultNow(),
  termEndDate: timestamp('term_end_date', { withTimezone: true }),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Trustee Meetings ───────────────────────────────────────────────────────────

export const pensionTrusteeMeetings = pgTable('pension_trustee_meetings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  scheduledDate: timestamp('scheduled_date', { withTimezone: true }).notNull(),
  location: varchar('location', { length: 255 }),
  agenda: text('agenda'),
  minutes: text('minutes'),
  status: varchar('status', { length: 50 }).notNull().default('scheduled'),
  attendees: jsonb('attendees').default([]),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pensionTrusteeMandates = pgTable('pension_trustee_mandates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  planId: uuid('plan_id'),
  actorUserId: varchar('actor_user_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  appointmentReference: varchar('appointment_reference', { length: 255 }).notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: varchar('revoked_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  actorScopeIdx: index('pension_trustee_mandates_actor_scope_idx').on(t.organizationId, t.actorUserId, t.planId, t.action),
}));

export const pensionTrusteeDecisions = pgTable('pension_trustee_decisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  planId: uuid('plan_id').notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: uuid('resource_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  firstTrusteeUserId: varchar('first_trustee_user_id', { length: 255 }).notNull(),
  secondTrusteeUserId: varchar('second_trustee_user_id', { length: 255 }),
  evidenceDigest: varchar('evidence_digest', { length: 64 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  resourceActionUq: uniqueIndex('pension_trustee_decisions_resource_action_uniq').on(t.resourceType, t.resourceId),
  orgStatusIdx: index('pension_trustee_decisions_org_status_idx').on(t.organizationId, t.status),
}));

export const pensionBenefitClaimEvidence = pgTable('pension_benefit_claim_evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  claimId: uuid('claim_id').notNull(),
  evidenceType: varchar('evidence_type', { length: 50 }).notNull(),
  evidenceReference: varchar('evidence_reference', { length: 500 }).notNull(),
  evidenceDigest: varchar('evidence_digest', { length: 64 }).notNull(),
  verifiedBy: varchar('verified_by', { length: 255 }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ claimIdx: index('pension_benefit_claim_evidence_claim_idx').on(t.claimId) }));

export const pensionBenefitSettlementHandoffs = pgTable('pension_benefit_settlement_handoffs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  claimId: uuid('claim_id').notNull(),
  decisionId: uuid('decision_id').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('prepared'),
  providerMandateReference: varchar('provider_mandate_reference', { length: 255 }),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  claimUq: uniqueIndex('pension_benefit_settlement_handoffs_claim_uniq').on(t.claimId),
  idempotencyUq: uniqueIndex('pension_benefit_settlement_handoffs_key_uniq').on(t.organizationId, t.idempotencyKey),
}));
