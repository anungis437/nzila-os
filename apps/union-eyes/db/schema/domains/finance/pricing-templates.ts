/**
 * Pricing Templates Schema
 *
 * Configurable commercial plan templates for CUPE-style pilots,
 * rollouts, and full deployments. Rates are data-driven and
 * editable via admin tooling, never hardcoded.
 *
 * Tables:
 *  - pricing_templates            — master template definitions
 *  - pricing_template_modules     — per-module pricing in each template
 *  - pricing_discount_rules       — stackable discount rules (volume, contract, etc.)
 *  - pricing_regional_deployments — per-region deployment cost model
 *
 * @domain platform-economics
 * @layer 1 — Platform Billing
 */

import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, decimal,
  integer, boolean, jsonb, index, unique,
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

/** GTM (go-to-market) tiers aligned with commercial pricing model. */
export const gtmTierEnum = pgEnum('gtm_tier', [
  'starter',
  'professional',
  'premium',
  'enterprise',
]);

/** Discount rule types for stackable commercial discounts. */
export const discountTypeEnum = pgEnum('discount_type', [
  'volume',
  'contract_term',
  'early_adopter',
  'partner_referral',
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

  // ── GTM alignment ──────────────────────────────────────────────────────
  /** Commercial-facing tier (Starter/Professional/Premium/Enterprise). */
  gtmTier: gtmTierEnum('gtm_tier'),
  /** Per-member monthly fee in CAD (core GTM pricing lever). */
  perMemberFeeCad: decimal('per_member_fee_cad', { precision: 14, scale: 4 }).default('0.0000'),
  /** Minimum member count for this tier band (inclusive). */
  memberBandMin: integer('member_band_min'),
  /** Maximum member count for this tier band (inclusive, null = unlimited). */
  memberBandMax: integer('member_band_max'),
  /** Annual price escalator percentage for multi-year contracts. */
  annualEscalatorPercent: decimal('annual_escalator_percent', { precision: 5, scale: 2 }).default('0.00'),
  /** Per-region one-time implementation fee in CAD. */
  implementationFeePerRegionCad: decimal('implementation_fee_per_region_cad', { precision: 14, scale: 2 }).default('0.00'),
  /** Variable cost per member per month (internal cost modelling). */
  variableCostPerMemberCad: decimal('variable_cost_per_member_cad', { precision: 14, scale: 4 }).default('0.0000'),

  // ── Base pricing (existing) ────────────────────────────────────────────
  /** National license base fee (annual platform fee). */
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

  /** Features included at this tier (serialised list for display). */
  featuresIncluded: text('features_included'),

  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (t) => ({
  tierIdx: index('pricing_templates_tier_idx').on(t.tier),
  statusIdx: index('pricing_templates_status_idx').on(t.status),
  gtmTierIdx: index('pricing_templates_gtm_tier_idx').on(t.gtmTier),
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
// PRICING DISCOUNT RULES
// ============================================================================

/**
 * Stackable discount rules attached to a pricing template.
 * Multiple rules can apply simultaneously (e.g. volume + contract term).
 * The pricing calculator evaluates all active rules for a given quote.
 */
export const pricingDiscountRules = pgTable('pricing_discount_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => pricingTemplates.id, { onDelete: 'cascade' }),
  discountType: discountTypeEnum('discount_type').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  /** Discount rate as a percentage (e.g. 10.00 = 10%). */
  ratePercent: decimal('rate_percent', { precision: 5, scale: 2 }).notNull(),
  /** Whether discount applies to per-member fees, base fee, or total. */
  appliesTo: varchar('applies_to', { length: 50 }).notNull().default('per_member'),
  /** Minimum member count to qualify (volume discounts). */
  memberThreshold: integer('member_threshold'),
  /** Minimum contract term in months to qualify (contract term discounts). */
  contractTermMinMonths: integer('contract_term_min_months'),
  /** Priority for evaluation order (lower = first). */
  priority: integer('priority').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  templateIdx: index('pricing_discount_rules_template_idx').on(t.templateId),
  typeIdx: index('pricing_discount_rules_type_idx').on(t.discountType),
}));

// ============================================================================
// PRICING REGIONAL DEPLOYMENTS
// ============================================================================

/**
 * Per-region deployment cost model for national rollouts.
 * Tracks one-time implementation + annual recurring costs per province/region.
 */
export const pricingRegionalDeployments = pgTable('pricing_regional_deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => pricingTemplates.id, { onDelete: 'cascade' }),
  regionCode: varchar('region_code', { length: 10 }).notNull(),
  regionName: varchar('region_name', { length: 255 }).notNull(),
  estimatedLocals: integer('estimated_locals').default(0),
  implementationFeeCad: decimal('implementation_fee_cad', { precision: 14, scale: 2 }).notNull(),
  annualSupportFeeCad: decimal('annual_support_fee_cad', { precision: 14, scale: 2 }).notNull(),
  annualHostingAddOnCad: decimal('annual_hosting_add_on_cad', { precision: 14, scale: 2 }).default('0.00'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  templateIdx: index('pricing_regional_deployments_template_idx').on(t.templateId),
  regionIdx: index('pricing_regional_deployments_region_idx').on(t.regionCode),
  uniqueTemplateRegion: unique('pricing_regional_deployments_unique').on(t.templateId, t.regionCode),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PricingTemplate = typeof pricingTemplates.$inferSelect;
export type NewPricingTemplate = typeof pricingTemplates.$inferInsert;
export type PricingTemplateModule = typeof pricingTemplateModules.$inferSelect;
export type NewPricingTemplateModule = typeof pricingTemplateModules.$inferInsert;
export type PricingDiscountRule = typeof pricingDiscountRules.$inferSelect;
export type NewPricingDiscountRule = typeof pricingDiscountRules.$inferInsert;
export type PricingRegionalDeployment = typeof pricingRegionalDeployments.$inferSelect;
export type NewPricingRegionalDeployment = typeof pricingRegionalDeployments.$inferInsert;

// GTM tier type re-export for use in calculator
export type GtmTier = 'starter' | 'professional' | 'premium' | 'enterprise';
