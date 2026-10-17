/**
 * Award Templates Schema
 * Stores award templates for recognition and rewards system.
 */

import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { rewardWalletLedger } from './rewards';

// Compatibility export: award and wallet callers share the current credit ledger.
export { rewardWalletLedger } from './rewards';

export const awardCategoryEnum = {
  PERFORMANCE: 'performance',
  TEAMWORK: 'teamwork',
  INNOVATION: 'innovation',
  LEADERSHIP: 'leadership',
  CUSTOMER_SERVICE: 'customer-service',
  SAFETY: 'safety',
  MILESTONE: 'milestone',
  RECOGNITION: 'recognition',
  OTHER: 'other',
} as const;

export const awardTypeEnum = {
  POINTS: 'points',
  BADGE: 'badge',
  CERTIFICATE: 'certificate',
  GIFT_CARD: 'gift_card',
  EXTRA_TIME_OFF: 'extra_time_off',
  PUBLIC_RECOGNITION: 'public_recognition',
} as const;

export const awardStatusEnum = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DRAFT: 'draft',
} as const;

export const awardTemplates = pgTable("award_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  message: text("message").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  pointsValue: integer("points_value").default(0),
  monetaryValue: integer("monetary_value").default(0),
  currency: varchar("currency", { length: 3 }).default('CAD'),
  badgeName: varchar("badge_name", { length: 100 }),
  badgeIcon: varchar("badge_icon", { length: 500 }),
  badgeColor: varchar("badge_color", { length: 20 }),
  tags: jsonb("tags").$type<string[]>(),
  useCount: integer("use_count").default(0),
  maxUses: integer("max_uses"),
  perUserLimit: integer("per_user_limit"),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  organizationId: varchar("organization_id", { length: 255 }),
  requiresApproval: boolean("requires_approval").default(false),
  approverRoles: jsonb("approver_roles").$type<string[]>(),
  totalAwarded: integer("total_awarded").default(0),
  totalValueAwarded: integer("total_value_awarded").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
}, (table) => [
  index("idx_award_template_category").on(table.category),
  index("idx_award_template_status").on(table.status),
  index("idx_award_template_org").on(table.organizationId),
]);

export const awardHistory = pgTable("award_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").references(() => awardTemplates.id).notNull(),
  recipientId: varchar("recipient_id", { length: 255 }).notNull(),
  recipientName: varchar("recipient_name", { length: 255 }).notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  pointsAwarded: integer("points_awarded").default(0),
  monetaryValue: integer("monetary_value").default(0),
  badgeAwarded: boolean("badge_awarded").default(false),
  giverId: varchar("giver_id", { length: 255 }).notNull(),
  giverName: varchar("giver_name", { length: 255 }).notNull(),
  reason: text("reason"),
  visibility: varchar("visibility", { length: 20 }).default('public'),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  redemptionNotes: text("redemption_notes"),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_award_history_recipient").on(table.recipientId),
  index("idx_award_history_giver").on(table.giverId),
  index("idx_award_history_template").on(table.templateId),
]);

export const budgetPool = pgTable("budget_pool", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  totalBudget: integer("total_budget").notNull(),
  allocatedBudget: integer("allocated_budget").notNull().default(0),
  spentBudget: integer("spent_budget").notNull().default(0),
  fiscalYear: integer("fiscal_year").notNull(),
  quarter: integer("quarter"),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  managerId: varchar("manager_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_budget_pool_org").on(table.organizationId),
  index("idx_budget_pool_fiscal").on(table.fiscalYear),
]);

export const budgetReservations = pgTable("budget_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").references(() => budgetPool.id).notNull(),
  reservedAmount: integer("reserved_amount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  referenceType: varchar("reference_type", { length: 50 }).notNull(),
  referenceId: varchar("reference_id", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_budget_res_pool").on(table.poolId),
  index("idx_budget_res_status").on(table.status),
]);

export type AwardCategory = typeof awardCategoryEnum[keyof typeof awardCategoryEnum];
export type AwardType = typeof awardTypeEnum[keyof typeof awardTypeEnum];
export type AwardStatus = typeof awardStatusEnum[keyof typeof awardStatusEnum];
export type AwardTemplate = typeof awardTemplates.$inferSelect;
export type AwardHistoryRecord = typeof awardHistory.$inferSelect;
export type RewardWallet = typeof rewardWalletLedger.$inferSelect;
export type BudgetPool = typeof budgetPool.$inferSelect;
