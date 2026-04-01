/**
 * Pension Integration Schema
 *
 * Database schema for external pension system data.
 * Supports OTPP, CPP/QPP, provincial pension plans, and custom providers.
 * Tables:
 * - external_pension_plans: Pension plans from external systems
 * - external_pension_members: Member enrollments in pension plans
 * - external_pension_contributions: Contribution records
 * - external_pension_service_credits: Credited service history
 * - external_pension_estimates: Projected pension benefit estimates
 * - external_pension_beneficiaries: Named beneficiaries
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  date,
  boolean,
  integer,
  index,
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

// ============================================================================
// Enums
// ============================================================================

export const pensionProviderEnum = pgEnum('pension_provider', [
  'OTPP',
  'CPP_QPP',
  'OMERS',
  'HOOPP',
  'LAPP',
  'PSPP',
  'BCMPP',
  'SHEPP',
  'CSSB',
  'CUSTOM',
]);

export const externalPensionPlanTypeEnum = pgEnum('pension_plan_type', [
  'defined_benefit',
  'defined_contribution',
  'hybrid',
  'target_benefit',
  'multi_employer',
]);

export const externalPensionMemberStatusEnum = pgEnum('pension_member_status', [
  'active',
  'deferred',
  'retired',
  'disabled',
  'terminated',
  'deceased',
  'suspended',
]);

export const contributionTypeEnum = pgEnum('pension_contribution_type', [
  'employee_regular',
  'employer_regular',
  'employee_voluntary',
  'employee_buyback',
  'transfer_in',
  'adjustment',
]);

// ============================================================================
// External Pension Plans
// ============================================================================

export const externalPensionPlans = pgTable(
  'external_pension_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: pensionProviderEnum('external_provider').notNull(),

    // Plan data
    planName: varchar('plan_name', { length: 500 }).notNull(),
    planType: externalPensionPlanTypeEnum('plan_type').notNull(),
    planNumber: varchar('plan_number', { length: 100 }),
    jurisdiction: varchar('jurisdiction', { length: 100 }), // ON, QC, BC, AB, federal
    regulatoryBody: varchar('regulatory_body', { length: 255 }),
    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),
    employeeContributionRate: numeric('employee_contribution_rate', { precision: 6, scale: 4 }),
    employerContributionRate: numeric('employer_contribution_rate', { precision: 6, scale: 4 }),
    vestingPeriodMonths: integer('vesting_period_months'),
    normalRetirementAge: integer('normal_retirement_age'),
    earlyRetirementAge: integer('early_retirement_age'),
    status: varchar('status', { length: 50 }).notNull(),

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_pension_plans_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    planNumberIdx: index('ext_pension_plans_number_idx').on(table.planNumber),
    statusIdx: index('ext_pension_plans_status_idx').on(table.status),
    jurisdictionIdx: index('ext_pension_plans_jurisdiction_idx').on(table.jurisdiction),
    uniqueExternal: unique('ext_pension_plans_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// External Pension Members
// ============================================================================

export const externalPensionMembers = pgTable(
  'external_pension_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: pensionProviderEnum('external_provider').notNull(),

    // Member data
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    employeeName: varchar('employee_name', { length: 500 }),
    planId: varchar('plan_id', { length: 255 }).notNull(),
    membershipNumber: varchar('membership_number', { length: 100 }),
    memberStatus: externalPensionMemberStatusEnum('member_status').notNull(),
    enrollmentDate: date('enrollment_date').notNull(),
    vestingDate: date('vesting_date'),
    terminationDate: date('termination_date'),
    creditedService: numeric('credited_service', { precision: 8, scale: 4 }), // in years
    eligibleService: numeric('eligible_service', { precision: 8, scale: 4 }),
    pensionableSalary: numeric('pensionable_salary', { precision: 14, scale: 2 }),
    dateOfBirth: date('date_of_birth'),
    expectedRetirementDate: date('expected_retirement_date'),

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_pension_members_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    employeeIdx: index('ext_pension_members_employee_idx').on(table.employeeId),
    planIdx: index('ext_pension_members_plan_idx').on(table.planId),
    statusIdx: index('ext_pension_members_status_idx').on(table.memberStatus),
    uniqueExternal: unique('ext_pension_members_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// External Pension Contributions
// ============================================================================

export const externalPensionContributions = pgTable(
  'external_pension_contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: pensionProviderEnum('external_provider').notNull(),

    // Contribution data
    memberId: varchar('member_id', { length: 255 }).notNull(),
    planId: varchar('plan_id', { length: 255 }).notNull(),
    contributionType: contributionTypeEnum('contribution_type').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    employeeAmount: numeric('employee_amount', { precision: 12, scale: 2 }),
    employerAmount: numeric('employer_amount', { precision: 12, scale: 2 }),
    pensionableEarnings: numeric('pensionable_earnings', { precision: 14, scale: 2 }),
    serviceCredit: numeric('service_credit', { precision: 6, scale: 4 }), // fraction of year
    payPeriod: varchar('pay_period', { length: 50 }),
    status: varchar('status', { length: 50 }).notNull(),

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_pension_contrib_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    memberIdx: index('ext_pension_contrib_member_idx').on(table.memberId),
    planIdx: index('ext_pension_contrib_plan_idx').on(table.planId),
    periodIdx: index('ext_pension_contrib_period_idx').on(table.periodStart, table.periodEnd),
    typeIdx: index('ext_pension_contrib_type_idx').on(table.contributionType),
    uniqueExternal: unique('ext_pension_contrib_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// External Pension Service Credits
// ============================================================================

export const externalPensionServiceCredits = pgTable(
  'external_pension_service_credits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: pensionProviderEnum('external_provider').notNull(),

    // Service credit data
    memberId: varchar('member_id', { length: 255 }).notNull(),
    planId: varchar('plan_id', { length: 255 }).notNull(),
    creditType: varchar('credit_type', { length: 100 }).notNull(), // regular, buyback, transfer, maternity, etc.
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    creditedYears: numeric('credited_years', { precision: 8, scale: 4 }).notNull(),
    costOfBuyback: numeric('cost_of_buyback', { precision: 14, scale: 2 }),
    approved: boolean('approved'),
    approvalDate: date('approval_date'),

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_pension_svc_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    memberIdx: index('ext_pension_svc_member_idx').on(table.memberId),
    planIdx: index('ext_pension_svc_plan_idx').on(table.planId),
    creditTypeIdx: index('ext_pension_svc_type_idx').on(table.creditType),
    uniqueExternal: unique('ext_pension_svc_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// External Pension Estimates
// ============================================================================

export const externalPensionEstimates = pgTable(
  'external_pension_estimates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: pensionProviderEnum('external_provider').notNull(),

    // Estimate data
    memberId: varchar('member_id', { length: 255 }).notNull(),
    planId: varchar('plan_id', { length: 255 }).notNull(),
    estimateDate: date('estimate_date').notNull(),
    retirementAge: integer('retirement_age').notNull(),
    expectedRetirementDate: date('expected_retirement_date').notNull(),
    creditedServiceAtRetirement: numeric('credited_service_at_retirement', { precision: 8, scale: 4 }),
    annualPension: numeric('annual_pension', { precision: 14, scale: 2 }),
    monthlyPension: numeric('monthly_pension', { precision: 14, scale: 2 }),
    bridgeBenefit: numeric('bridge_benefit', { precision: 14, scale: 2 }),
    survivorBenefit: numeric('survivor_benefit', { precision: 14, scale: 2 }),
    commutedValue: numeric('commuted_value', { precision: 18, scale: 2 }),
    inflationAdjusted: boolean('inflation_adjusted'),

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_pension_est_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    memberIdx: index('ext_pension_est_member_idx').on(table.memberId),
    planIdx: index('ext_pension_est_plan_idx').on(table.planId),
    retirementAgeIdx: index('ext_pension_est_ret_age_idx').on(table.retirementAge),
    uniqueExternal: unique('ext_pension_est_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// External Pension Beneficiaries
// ============================================================================

export const externalPensionBeneficiaries = pgTable(
  'external_pension_beneficiaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: pensionProviderEnum('external_provider').notNull(),

    // Beneficiary data
    memberId: varchar('member_id', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    relationship: varchar('relationship', { length: 100 }).notNull(),
    allocationPercent: numeric('allocation_percent', { precision: 5, scale: 2 }).notNull(),
    dateOfBirth: date('date_of_birth'),
    beneficiaryType: varchar('beneficiary_type', { length: 50 }).notNull(), // primary, contingent
    status: varchar('status', { length: 50 }).notNull(),
    effectiveDate: date('effective_date'),

    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('ext_pension_ben_org_provider_idx').on(
      table.organizationId,
      table.externalProvider,
    ),
    memberIdx: index('ext_pension_ben_member_idx').on(table.memberId),
    statusIdx: index('ext_pension_ben_status_idx').on(table.status),
    uniqueExternal: unique('ext_pension_ben_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId,
    ),
  }),
);

// ============================================================================
// Type Exports
// ============================================================================

export type ExternalPensionPlan = typeof externalPensionPlans.$inferSelect;
export type NewExternalPensionPlan = typeof externalPensionPlans.$inferInsert;
export type ExternalPensionMember = typeof externalPensionMembers.$inferSelect;
export type NewExternalPensionMember = typeof externalPensionMembers.$inferInsert;
export type ExternalPensionContribution = typeof externalPensionContributions.$inferSelect;
export type NewExternalPensionContribution = typeof externalPensionContributions.$inferInsert;
export type ExternalPensionServiceCredit = typeof externalPensionServiceCredits.$inferSelect;
export type NewExternalPensionServiceCredit = typeof externalPensionServiceCredits.$inferInsert;
export type ExternalPensionEstimate = typeof externalPensionEstimates.$inferSelect;
export type NewExternalPensionEstimate = typeof externalPensionEstimates.$inferInsert;
export type ExternalPensionBeneficiary = typeof externalPensionBeneficiaries.$inferSelect;
export type NewExternalPensionBeneficiary = typeof externalPensionBeneficiaries.$inferInsert;
