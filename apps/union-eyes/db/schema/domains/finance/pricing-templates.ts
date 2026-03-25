/**
 * Pricing Templates Schema
 *
 * Configurable commercial plan templates for CUPE-style pilots,
 * rollouts, and full deployments. Rates are data-driven and
 * editable via admin tooling, never hardcoded.
 *
 * Tables:
 *  - pricing_templates          — master template definitions
 *  - pricing_template_modules   — per-module pricing in each template
 *
 * @domain platform-economics
 * @layer 1 — Platform Billing
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, boolean, jsonb, index,
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS
// ============================================================================

export const templateStatusEnum = pgEnum('pricing_template_status', [
  'active',
  'inactive',
  'archived',
]);

export const billingCadenceEnum = pgEnum('billing_cadence', [
  'monthly',
  'quarterly',
  'annual',
]);

export const templateTierEnum = pgEnum('template_tier', [
  'pilot',
  'shared_rollout',
  'full_deployment',
  'mid_sized_union',
  'membership_association',
  'custom',
]);

// ============================================================================
// PRICING TEMPLATES
// ============================================================================

export const pricingTemplates = pgTable('pricing_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  tier: templateTierEnum('tier').notNull(),
  status: templateStatusEnum('status').notNull().default('active'),

  // Base pricing
  basePlatformFeeCad: decimal('base_platform_fee_cad', { precision: 14, scale: 2 }).notNull(),
  perLocalFeeCad: decimal('per_local_fee_cad', { precision: 14, scale: 2 }).default('0.00'),
  perDivisionFeeCad: decimal('per_division_fee_cad', { precision: 14, scale: 2 }).default('0.00'),
  perAdminSeatFeeCad: decimal('per_admin_seat_fee_cad', { precision: 14, scale: 2 }).default('0.00'),
  perModuleFeeCad: decimal('per_module_fee_cad', { precision: 14, scale: 2 }).default('0.00'),

  // Transaction fee defaults
  transactionFeeRate: decimal('transaction_fee_rate', { precision: 8, scale: 6 }).default('0.000000'),
  transactionFlatFeeCad: decimal('transaction_flat_fee_cad', { precision: 14, scale: 2 }).default('0.00'),

  // One-time fees
  onboardingFeeCad: decimal('onboarding_fee_cad', { precision: 14, scale: 2 }).default('0.00'),
  supportFeeCad: decimal('support_fee_cad', { precision: 14, scale: 2 }).default('0.00'),

  // Discount / subsidy
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0.00'),
  subsidyCad: decimal('subsidy_cad', { precision: 14, scale: 2 }).default('0.00'),

  // Template constraints
  billingCadence: billingCadenceEnum('billing_cadence').notNull().default('monthly'),
  maxCoveredLocals: integer('max_covered_locals'),
  maxCoveredDivisions: integer('max_covered_divisions'),
  includedModules: integer('included_modules').default(0),
  trialDays: integer('trial_days').default(0),
  contractTermMonths: integer('contract_term_months').default(12),

  // Flags
  feeWaiverActive: boolean('fee_waiver_active').notNull().default(false),
  allocationEnabled: boolean('allocation_enabled').notNull().default(false),
  pilotMode: boolean('pilot_mode').notNull().default(false),

  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  tierIdx: index('pricing_templates_tier_idx').on(t.tier),
  statusIdx: index('pricing_templates_status_idx').on(t.status),
}));

// ============================================================================
// PRICING TEMPLATE MODULES
// ============================================================================

export const pricingTemplateModules = pgTable('pricing_template_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => pricingTemplates.id, { onDelete: 'cascade' }),
  moduleKey: varchar('module_key', { length: 100 }).notNull(),
  moduleName: varchar('module_name', { length: 255 }).notNull(),
  included: boolean('included').notNull().default(false),
  additionalFeeCad: decimal('additional_fee_cad', { precision: 14, scale: 2 }).default('0.00'),
  usageLimit: integer('usage_limit'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  templateIdx: index('pricing_template_modules_template_idx').on(t.templateId),
  moduleIdx: index('pricing_template_modules_module_idx').on(t.moduleKey),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PricingTemplate = typeof pricingTemplates.$inferSelect;
export type NewPricingTemplate = typeof pricingTemplates.$inferInsert;
export type PricingTemplateModule = typeof pricingTemplateModules.$inferSelect;
export type NewPricingTemplateModule = typeof pricingTemplateModules.$inferInsert;
