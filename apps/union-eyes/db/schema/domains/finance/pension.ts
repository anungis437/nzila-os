/**
 * Pension Schema
 * Database schema for pension plans, members, benefits, contributions, and T4A records
 */
import { pgTable, text, uuid, numeric, timestamp, integer, jsonb, varchar, pgEnum } from 'drizzle-orm/pg-core';

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
