// =====================================================
// Recognition & Rewards System Schema
// Phase: Recognition Engine Core
// =====================================================

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  varchar,
  pgEnum,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';

// =====================================================
// ENUMS
// =====================================================

export const programStatusEnum = pgEnum('program_status', [
  'draft',
  'active',
  'archived',
]);

export const awardKindEnum = pgEnum('award_kind', [
  'milestone',
  'peer',
  'admin',
  'automated',
]);

export const awardStatusEnum = pgEnum('award_status', [
  'pending',
  'approved',
  'issued',
  'rejected',
  'revoked',
]);

export const walletEventTypeEnum = pgEnum('wallet_event_type', [
  'earn',
  'spend',
  'expire',
  'revoke',
  'adjust',
  'refund',
]);

export const walletSourceTypeEnum = pgEnum('wallet_source_type', [
  'award',
  'redemption',
  'admin_adjustment',
  'system',
]);

export const budgetScopeTypeEnum = pgEnum('budget_scope_type', [
  'org',
  'local',
  'department',
  'manager',
]);

export const budgetPeriodEnum = pgEnum('budget_period', [
  'monthly',
  'quarterly',
  'annual',
]);

export const redemptionStatusEnum = pgEnum('redemption_status', [
  'initiated',
  'pending_payment',
  'ordered',
  'fulfilled',
  'cancelled',
  'refunded',
]);

export const redemptionProviderEnum = pgEnum('redemption_provider', [
  'shopify',
]);

export const webhookProviderEnum = pgEnum('webhook_provider', [
  'shopify',
  'paypal',
]);

// =====================================================
// TABLES
// =====================================================

/**
 * Recognition Programs
 * Container for recognition initiatives within an organization
 */
export const recognitionPrograms = pgTable(
  'recognition_programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: programStatusEnum('status').notNull().default('draft'),
    currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdIdx: index('recognition_programs_org_id_idx').on(table.orgId),
  })
);

/**
 * Recognition Award Types
 * Templates for different types of recognition
 */
export const recognitionAwardTypes = pgTable(
  'recognition_award_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    programId: uuid('program_id')
      .notNull()
      .references(() => recognitionPrograms.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    kind: awardKindEnum('kind').notNull(),
    defaultCreditAmount: integer('default_credit_amount').notNull(),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    rulesJson: jsonb('rules_json'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdIdx: index('recognition_award_types_org_id_idx').on(table.orgId),
    programIdIdx: index('recognition_award_types_program_id_idx').on(
      table.programId
    ),
    checkCreditAmount: check(
      'award_type_credit_amount_positive',
      sql`${table.defaultCreditAmount} > 0`
    ),
  })
);

/**
 * Recognition Awards
 * Individual award instances (requests, approvals, issuances)
 */
export const recognitionAwards = pgTable(
  'recognition_awards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    programId: uuid('program_id')
      .notNull()
      .references(() => recognitionPrograms.id, { onDelete: 'cascade' }),
    awardTypeId: uuid('award_type_id')
      .notNull()
      .references(() => recognitionAwardTypes.id, { onDelete: 'restrict' }),
    recipientUserId: varchar('recipient_user_id', { length: 255 }).notNull(), // Clerk user ID
    issuerUserId: varchar('issuer_user_id', { length: 255 }), // Nullable for automated
    reason: text('reason').notNull(),
    status: awardStatusEnum('status').notNull().default('pending'),
    approvedByUserId: varchar('approved_by_user_id', { length: 255 }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    metadataJson: jsonb('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdIdx: index('recognition_awards_org_id_idx').on(table.orgId),
    programIdIdx: index('recognition_awards_program_id_idx').on(
      table.programId
    ),
    recipientIdx: index('recognition_awards_recipient_user_id_idx').on(
      table.recipientUserId
    ),
    statusIdx: index('recognition_awards_status_idx').on(table.status),
  })
);

/**
 * Reward Wallet Ledger
 * Append-only ledger for all credit transactions
 */
export const rewardWalletLedger = pgTable(
  'reward_wallet_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(), // Clerk user ID
    eventType: walletEventTypeEnum('event_type').notNull(),
    amountCredits: integer('amount_credits').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    sourceType: walletSourceTypeEnum('source_type').notNull(),
    sourceId: uuid('source_id'), // FK to awards or redemptions
    memo: text('memo'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgUserIdx: index('reward_wallet_ledger_org_user_idx').on(
      table.orgId,
      table.userId
    ),
    userCreatedIdx: index('reward_wallet_ledger_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    checkBalanceNonNegative: check(
      'wallet_balance_non_negative',
      sql`${table.balanceAfter} >= 0`
    ),
  })
);

/**
 * Reward Budget Envelopes
 * Time-bound credit pools for controlling recognition spending
 */
export const rewardBudgetEnvelopes = pgTable(
  'reward_budget_envelopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    programId: uuid('program_id')
      .notNull()
      .references(() => recognitionPrograms.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    scopeType: budgetScopeTypeEnum('scope_type').notNull(),
    scopeRefId: varchar('scope_ref_id', { length: 255 }), // Future: departments, managers
    period: budgetPeriodEnum('period').notNull(),
    amountLimit: integer('amount_limit').notNull(),
    amountUsed: integer('amount_used').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdIdx: index('reward_budget_envelopes_org_id_idx').on(table.orgId),
    programIdIdx: index('reward_budget_envelopes_program_id_idx').on(
      table.programId
    ),
    checkLimitPositive: check(
      'budget_limit_positive',
      sql`${table.amountLimit} > 0`
    ),
    checkUsedValid: check(
      'budget_used_valid',
      sql`${table.amountUsed} >= 0 AND ${table.amountUsed} <= ${table.amountLimit}`
    ),
    checkDates: check(
      'budget_dates_valid',
      sql`${table.endsAt} > ${table.startsAt}`
    ),
  })
);

/**
 * Reward Redemptions
 * Tracks member redemption requests and Shopify order lifecycle
 */
export const rewardRedemptions = pgTable(
  'reward_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(), // Clerk user ID
    programId: uuid('program_id')
      .notNull()
      .references(() => recognitionPrograms.id, { onDelete: 'restrict' }),
    creditsSpent: integer('credits_spent').notNull(),
    status: redemptionStatusEnum('status').notNull().default('initiated'),
    provider: redemptionProviderEnum('provider').notNull(),
    providerOrderId: varchar('provider_order_id', { length: 255 }),
    providerCheckoutId: varchar('provider_checkout_id', { length: 255 }),
    providerPayloadJson: jsonb('provider_payload_json'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdIdx: index('reward_redemptions_org_id_idx').on(table.orgId),
    userIdIdx: index('reward_redemptions_user_id_idx').on(table.userId),
    providerOrderIdx: index('reward_redemptions_provider_order_idx').on(
      table.providerOrderId
    ),
    checkCreditsPositive: check(
      'redemption_credits_positive',
      sql`${table.creditsSpent} > 0`
    ),
  })
);

/**
 * Shopify Config
 * Per-organization Shopify integration settings
 */
export const shopifyConfig = pgTable('shopify_config', {
  orgId: uuid('org_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  shopDomain: varchar('shop_domain', { length: 255 }).notNull(),
  storefrontTokenSecretRef: varchar('storefront_token_secret_ref', {
    length: 255,
  }).notNull(),
  adminTokenSecretRef: varchar('admin_token_secret_ref', { length: 255 }),
  allowedCollections: jsonb('allowed_collections').notNull().default(sql`'[]'::jsonb`),
  webhookSecretRef: varchar('webhook_secret_ref', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Webhook Receipts
 * Idempotency tracking for external webhooks
 */
export const webhookReceipts = pgTable(
  'webhook_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: webhookProviderEnum('provider').notNull(),
    webhookId: varchar('webhook_id', { length: 255 }).notNull().unique(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payloadJson: jsonb('payload_json').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    providerWebhookIdx: index('webhook_receipts_provider_webhook_idx').on(
      table.provider,
      table.webhookId
    ),
  })
);

/**
 * Automation Rules
 * Trigger automated awards based on conditions
 */
export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Rule definition
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    triggerType: varchar('trigger_type', { length: 50 }).notNull(), // 'anniversary', 'milestone', 'metric', 'scheduled'
    
    // Conditions (flexible JSON for different trigger types)
    conditions: jsonb('conditions'), // e.g., { metric: 'performance', operator: 'gte', value: 90 }
    
    // Action (award to create when triggered)
    awardTypeId: uuid('award_type_id')
      .notNull()
      .references(() => recognitionAwardTypes.id, { onDelete: 'cascade' }),
    creditAmount: integer('credit_amount').notNull().default(0), // Override award type credits if set
    
    // Schedule (for scheduled/cron-based triggers)
    schedule: varchar('schedule', { length: 255 }), // Cron expression or 'monthly', 'quarterly', etc.
    
    // Status
    isActive: boolean('is_active').notNull().default(true),
    lastTriggeredAt: timestamp('last_triggered_at'),
    triggerCount: integer('trigger_count').notNull().default(0),
    
    // Audit
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: varchar('created_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
  },
  (t) => ({
    orgIdx: index('automation_rules_org_idx').on(t.orgId),
    triggerIdx: index('automation_rules_trigger_idx').on(t.triggerType),
    activeIdx: index('automation_rules_active_idx').on(t.isActive),
    awardTypeIdx: index('automation_rules_award_type_idx').on(t.awardTypeId),
  })
);

// =====================================================
// RELATIONS
// =====================================================

export const recognitionProgramsRelations = relations(
  recognitionPrograms,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [recognitionPrograms.orgId],
      references: [organizations.id],
    }),
    awardTypes: many(recognitionAwardTypes),
    awards: many(recognitionAwards),
    budgetEnvelopes: many(rewardBudgetEnvelopes),
    redemptions: many(rewardRedemptions),
  })
);

export const recognitionAwardTypesRelations = relations(
  recognitionAwardTypes,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [recognitionAwardTypes.orgId],
      references: [organizations.id],
    }),
    program: one(recognitionPrograms, {
      fields: [recognitionAwardTypes.programId],
      references: [recognitionPrograms.id],
    }),
    awards: many(recognitionAwards),
  })
);

export const recognitionAwardsRelations = relations(
  recognitionAwards,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [recognitionAwards.orgId],
      references: [organizations.id],
    }),
    program: one(recognitionPrograms, {
      fields: [recognitionAwards.programId],
      references: [recognitionPrograms.id],
    }),
    awardType: one(recognitionAwardTypes, {
      fields: [recognitionAwards.awardTypeId],
      references: [recognitionAwardTypes.id],
    }),
  })
);

export const rewardBudgetEnvelopesRelations = relations(
  rewardBudgetEnvelopes,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [rewardBudgetEnvelopes.orgId],
      references: [organizations.id],
    }),
    program: one(recognitionPrograms, {
      fields: [rewardBudgetEnvelopes.programId],
      references: [recognitionPrograms.id],
    }),
  })
);

export const rewardRedemptionsRelations = relations(
  rewardRedemptions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [rewardRedemptions.orgId],
      references: [organizations.id],
    }),
    program: one(recognitionPrograms, {
      fields: [rewardRedemptions.programId],
      references: [recognitionPrograms.id],
    }),
  })
);

export const shopifyConfigRelations = relations(shopifyConfig, ({ one }) => ({
  organization: one(organizations, {
    fields: [shopifyConfig.orgId],
    references: [organizations.id],
  }),
}));

export const automationRulesRelations = relations(
  automationRules,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [automationRules.orgId],
      references: [organizations.id],
    }),
    awardType: one(recognitionAwardTypes, {
      fields: [automationRules.awardTypeId],
      references: [recognitionAwardTypes.id],
    }),
  })
);

// =====================================================
// TYPE EXPORTS
// =====================================================

export type RecognitionProgram = typeof recognitionPrograms.$inferSelect;
export type NewRecognitionProgram = typeof recognitionPrograms.$inferInsert;

export type RecognitionAwardType = typeof recognitionAwardTypes.$inferSelect;
export type NewRecognitionAwardType = typeof recognitionAwardTypes.$inferInsert;

export type RecognitionAward = typeof recognitionAwards.$inferSelect;
export type NewRecognitionAward = typeof recognitionAwards.$inferInsert;

export type RewardWalletLedgerEntry = typeof rewardWalletLedger.$inferSelect;
export type NewRewardWalletLedgerEntry = typeof rewardWalletLedger.$inferInsert;

export type RewardBudgetEnvelope = typeof rewardBudgetEnvelopes.$inferSelect;
export type NewRewardBudgetEnvelope = typeof rewardBudgetEnvelopes.$inferInsert;

export type RewardRedemption = typeof rewardRedemptions.$inferSelect;
export type NewRewardRedemption = typeof rewardRedemptions.$inferInsert;

export type ShopifyConfig = typeof shopifyConfig.$inferSelect;
export type NewShopifyConfig = typeof shopifyConfig.$inferInsert;

export type WebhookReceipt = typeof webhookReceipts.$inferSelect;
export type NewWebhookReceipt = typeof webhookReceipts.$inferInsert;

export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;

