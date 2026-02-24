/**
 * Insurance & Benefits Integration Schema
 * 
 * Database schema for external insurance and benefits system data.
 * Supports Sun Life, Manulife, and other insurance/benefits providers.
 * 
 * Tables:
 * - external_benefit_plans: Benefit plans from external systems
 * - external_benefit_enrollments: Employee enrollments
 * - external_benefit_dependents: Covered dependents
 * - external_benefit_coverage: Coverage details
 * - external_insurance_claims: Insurance claims
 * - external_insurance_policies: Insurance policies
 * - external_insurance_beneficiaries: Policy beneficiaries
 * - external_benefit_utilization: Benefit utilization tracking
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  date,
  boolean,
  integer,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

// ============================================================================
// External Benefit Plans
// ============================================================================

export const externalBenefitPlans = pgTable(
  'external_benefit_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(), // SUNLIFE, MANULIFE, etc.
    
    // Plan data
    planName: varchar('plan_name', { length: 500 }).notNull(),
    planType: varchar('plan_type', { length: 100 }).notNull(), // health, dental, vision, life, disability
    coverageLevel: varchar('coverage_level', { length: 100 }), // employee, employee_spouse, family
    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),
    premium: numeric('premium', { precision: 12, scale: 2 }),
    employerContribution: numeric('employer_contribution', { precision: 12, scale: 2 }),
    employeeContribution: numeric('employee_contribution', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 50 }).notNull(), // active, terminated, pending
    
    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('external_benefit_plans_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    externalIdIdx: index('external_benefit_plans_external_id_idx').on(table.externalId),
    statusIdx: index('external_benefit_plans_status_idx').on(table.status),
    planTypeIdx: index('external_benefit_plans_plan_type_idx').on(table.planType),
    effectiveDateIdx: index('external_benefit_plans_effective_date_idx').on(table.effectiveDate),
    uniqueExternal: unique('external_benefit_plans_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

// ============================================================================
// External Benefit Enrollments
// ============================================================================

export const externalBenefitEnrollments = pgTable(
  'external_benefit_enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Enrollment data
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    employeeName: varchar('employee_name', { length: 500 }),
    planId: varchar('plan_id', { length: 255 }).notNull(),
    planName: varchar('plan_name', { length: 500 }),
    coverageLevel: varchar('coverage_level', { length: 100 }),
    enrollmentDate: date('enrollment_date').notNull(),
    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),
    status: varchar('status', { length: 50 }).notNull(), // active, terminated, pending
    premium: numeric('premium', { precision: 12, scale: 2 }),
    employeeContribution: numeric('employee_contribution', { precision: 12, scale: 2 }),
    
    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('external_benefit_enrollments_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    employeeIdx: index('external_benefit_enrollments_employee_idx').on(table.employeeId),
    planIdx: index('external_benefit_enrollments_plan_idx').on(table.planId),
    statusIdx: index('external_benefit_enrollments_status_idx').on(table.status),
    effectiveDateIdx: index('external_benefit_enrollments_effective_date_idx').on(table.effectiveDate),
    uniqueExternal: unique('external_benefit_enrollments_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

// ============================================================================
// External Benefit Dependents
// ============================================================================

export const externalBenefitDependents = pgTable(
  'external_benefit_dependents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Dependent data
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    dateOfBirth: date('date_of_birth'),
    relationship: varchar('relationship', { length: 100 }), // spouse, child, other
    status: varchar('status', { length: 50 }).notNull(), // active, terminated
    
    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('external_benefit_dependents_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    employeeIdx: index('external_benefit_dependents_employee_idx').on(table.employeeId),
    statusIdx: index('external_benefit_dependents_status_idx').on(table.status),
    uniqueExternal: unique('external_benefit_dependents_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

// ============================================================================
// External Benefit Coverage
// ============================================================================

export const externalBenefitCoverage = pgTable(
  'external_benefit_coverage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Coverage data
    enrollmentId: varchar('enrollment_id', { length: 255 }),
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    planId: varchar('plan_id', { length: 255 }).notNull(),
    planType: varchar('plan_type', { length: 100 }),
    coverageAmount: numeric('coverage_amount', { precision: 15, scale: 2 }),
    deductible: numeric('deductible', { precision: 12, scale: 2 }),
    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),
    status: varchar('status', { length: 50 }).notNull(), // active, terminated
    
    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('external_benefit_coverage_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    employeeIdx: index('external_benefit_coverage_employee_idx').on(table.employeeId),
    planIdx: index('external_benefit_coverage_plan_idx').on(table.planId),
    statusIdx: index('external_benefit_coverage_status_idx').on(table.status),
    uniqueExternal: unique('external_benefit_coverage_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

// ============================================================================
// External Insurance Claims
// ============================================================================

export const externalInsuranceClaims = pgTable(
  'external_insurance_claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Claim data
    claimNumber: varchar('claim_number', { length: 255 }).notNull(),
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    employeeName: varchar('employee_name', { length: 500 }),
    policyNumber: varchar('policy_number', { length: 255 }),
    claimType: varchar('claim_type', { length: 100 }), // health, dental, vision, life, disability
    serviceDate: date('service_date'),
    submissionDate: date('submission_date').notNull(),
    processedDate: date('processed_date'),
    claimAmount: numeric('claim_amount', { precision: 12, scale: 2 }).notNull(),
    approvedAmount: numeric('approved_amount', { precision: 12, scale: 2 }),
    paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }),
    deniedAmount: numeric('denied_amount', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 50 }).notNull(), // submitted, processing, approved, denied, paid
    denialReason: text('denial_reason'),
    providerId: varchar('provider_id', { length: 255 }),
    providerName: varchar('provider_name', { length: 500 }),
    
    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('external_insurance_claims_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    claimNumberIdx: index('external_insurance_claims_claim_number_idx').on(table.claimNumber),
    employeeIdx: index('external_insurance_claims_employee_idx').on(table.employeeId),
    statusIdx: index('external_insurance_claims_status_idx').on(table.status),
    submissionDateIdx: index('external_insurance_claims_submission_date_idx').on(table.submissionDate),
    claimTypeIdx: index('external_insurance_claims_claim_type_idx').on(table.claimType),
    uniqueExternal: unique('external_insurance_claims_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

// ============================================================================
// External Insurance Policies
// ============================================================================

export const externalInsurancePolicies = pgTable(
  'external_insurance_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Policy data
    policyNumber: varchar('policy_number', { length: 255 }).notNull(),
    policyType: varchar('policy_type', { length: 100 }), // group_health, group_dental, life, disability
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    effectiveDate: date('effective_date').notNull(),
    terminationDate: date('termination_date'),
    coverageAmount: numeric('coverage_amount', { precision: 15, scale: 2 }),
    premium: numeric('premium', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 50 }).notNull(), // active, terminated, suspended
    
    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('external_insurance_policies_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    policyNumberIdx: index('external_insurance_policies_policy_number_idx').on(table.policyNumber),
    employeeIdx: index('external_insurance_policies_employee_idx').on(table.employeeId),
    statusIdx: index('external_insurance_policies_status_idx').on(table.status),
    uniqueExternal: unique('external_insurance_policies_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

// ============================================================================
// External Insurance Beneficiaries
// ============================================================================

export const externalInsuranceBeneficiaries = pgTable(
  'external_insurance_beneficiaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Beneficiary data
    policyId: varchar('policy_id', { length: 255 }).notNull(),
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    relationship: varchar('relationship', { length: 100 }), // spouse, child, parent, sibling, other
    percentage: integer('percentage').notNull(), // 0-100
    isPrimary: boolean('is_primary').default(false).notNull(),
    status: varchar('status', { length: 50 }).notNull(), // active, removed
    
    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('external_insurance_beneficiaries_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    policyIdx: index('external_insurance_beneficiaries_policy_idx').on(table.policyId),
    employeeIdx: index('external_insurance_beneficiaries_employee_idx').on(table.employeeId),
    statusIdx: index('external_insurance_beneficiaries_status_idx').on(table.status),
    uniqueExternal: unique('external_insurance_beneficiaries_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

// ============================================================================
// External Benefit Utilization
// ============================================================================

export const externalBenefitUtilization = pgTable(
  'external_benefit_utilization',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Utilization data
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    policyId: varchar('policy_id', { length: 255 }),
    benefitType: varchar('benefit_type', { length: 100 }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    maximumBenefit: numeric('maximum_benefit', { precision: 12, scale: 2 }),
    utilized: numeric('utilized', { precision: 12, scale: 2 }),
    remaining: numeric('remaining', { precision: 12, scale: 2 }),
    
    // Metadata
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgProviderIdx: index('external_benefit_utilization_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    employeeIdx: index('external_benefit_utilization_employee_idx').on(table.employeeId),
    policyIdx: index('external_benefit_utilization_policy_idx').on(table.policyId),
    periodIdx: index('external_benefit_utilization_period_idx').on(table.periodStart, table.periodEnd),
    uniqueExternal: unique('external_benefit_utilization_unique').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);
