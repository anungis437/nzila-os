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
  pgEnum,
} from 'drizzle-orm/pg-core';

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

