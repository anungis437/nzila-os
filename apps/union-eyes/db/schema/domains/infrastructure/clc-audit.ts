/**
 * CLC Sync and Audit Schema
 * Purpose: Track CLC API organization synchronization operations, webhook events, and chart of accounts
 * Compliance: CLC data integration and audit trails for organization sync operations
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  json,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';

/**
 * CLC Organization Sync Log Table
 * Tracks per-organization synchronization operations between local system and CLC national database
 * Note: This is different from clcSyncLog in clc-partnership-schema which tracks partnership data sync
 */
export const clcOrganizationSyncLog = pgTable(
  'clc_organization_sync_log',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id'), // Nullable for batch sync operations
    affiliateCode: varchar('affiliate_code', { length: 50 }).notNull(),
    action: varchar('action', { length: 20 }).notNull(), // 'created', 'updated', 'skipped', 'failed'
    changes: text('changes'), // Semicolon-separated list of changed fields
    conflicts: json('conflicts').$type<Array<{
      field: string;
      localValue: any;
      clcValue: any;
      resolution: 'clc_wins' | 'local_wins' | 'manual_review';
      reason: string;
    }>>(), // JSON array of conflict resolutions
    duration: integer('duration').notNull(), // Milliseconds
    error: text('error'), // Error message if failed
    syncedAt: timestamp('synced_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    syncedBy: varchar('synced_by', { length: 255 }), // User ID if manual sync, null for automated
  },
  (table) => ({
    idxOrgSyncLogOrg: index('idx_org_sync_log_org').on(table.organizationId),
    idxOrgSyncLogAffiliate: index('idx_org_sync_log_affiliate').on(table.affiliateCode),
    idxOrgSyncLogDate: index('idx_org_sync_log_date').on(table.syncedAt),
    idxOrgSyncLogAction: index('idx_org_sync_log_action').on(table.action),
    clcOrgSyncLogOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'clc_organization_sync_log_organization_id_fkey',
    }),
  })
);

/**
 * CLC Webhook Log Table
 * Tracks all incoming webhook events from CLC national system
 */
export const clcWebhookLog = pgTable(
  'clc_webhook_log',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    webhookId: varchar('webhook_id', { length: 100 }).notNull().unique(), // CLC webhook event ID
    type: varchar('type', { length: 50 }).notNull(), // 'organization.created', 'organization.updated', etc.
    affiliateCode: varchar('affiliate_code', { length: 50 }).notNull(),
    payload: json('payload').notNull(), // Full webhook payload
    status: varchar('status', { length: 20 }).notNull(), // 'processed', 'rejected', 'failed'
    message: text('message'), // Status message or error details
    processingDuration: integer('processing_duration'), // Milliseconds
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => ({
    idxWebhookLogType: index('idx_webhook_log_type').on(table.type),
    idxWebhookLogAffiliate: index('idx_webhook_log_affiliate').on(table.affiliateCode),
    idxWebhookLogStatus: index('idx_webhook_log_status').on(table.status),
    idxWebhookLogReceived: index('idx_webhook_log_received').on(table.receivedAt),
  })
);

/**
 * Chart of Accounts Table
 * General ledger chart of accounts for CLC compliance reporting and StatCan LAB-05302 mapping
 */
export const chartOfAccounts = pgTable(
  'chart_of_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    accountCode: varchar('account_code', { length: 50 }).notNull(), // e.g., '4010', '5020'
    accountName: varchar('account_name', { length: 255 }).notNull(), // e.g., 'Per Capita Revenue', 'Office Rent'
    accountType: varchar('account_type', { length: 50 }).notNull(), // 'asset', 'liability', 'revenue', 'expense', 'equity'
    accountCategory: varchar('account_category', { length: 100 }), // 'membership_revenue', 'administrative_expense', etc.
    statcanMapping: varchar('statcan_mapping', { length: 50 }), // StatCan LAB-05302 line number mapping
    clcCategory: varchar('clc_category', { length: 100 }), // CLC reporting category
    isActive: varchar('is_active', { length: 10 }).default('true').notNull(),
    parentAccountId: uuid('parent_account_id'), // For hierarchical chart of accounts
    displayOrder: integer('display_order').default(0),
    description: text('description'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    createdBy: varchar('created_by', { length: 255 }), // User ID
  },
  (table) => ({
    idxChartAccountsOrg: index('idx_chart_accounts_org').on(table.organizationId),
    idxChartAccountsCode: index('idx_chart_accounts_code').on(table.accountCode),
    idxChartAccountsType: index('idx_chart_accounts_type').on(table.accountType),
    idxChartAccountsActive: index('idx_chart_accounts_active').on(table.isActive),
    chartOfAccountsOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'chart_of_accounts_organization_id_fkey',
    }),
    chartOfAccountsParentAccountIdFkey: foreignKey({
      columns: [table.parentAccountId],
      foreignColumns: [table.id],
      name: 'chart_of_accounts_parent_account_id_fkey',
    }),
  })
);

/**
 * CLC Organization Sync Log Relations
 */
export const clcOrganizationSyncLogRelations = relations(clcOrganizationSyncLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [clcOrganizationSyncLog.organizationId],
    references: [organizations.id],
    relationName: 'clcOrganizationSyncLog_organizationId_organizations_id',
  }),
}));

/**
 * Chart of Accounts Relations
 */
export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [chartOfAccounts.organizationId],
    references: [organizations.id],
    relationName: 'chartOfAccounts_organizationId_organizations_id',
  }),
  parentAccount: one(chartOfAccounts, {
    fields: [chartOfAccounts.parentAccountId],
    references: [chartOfAccounts.id],
    relationName: 'chartOfAccounts_parent',
  }),
  childAccounts: many(chartOfAccounts, {
    relationName: 'chartOfAccounts_parent',
  }),
}));

// Type exports for use in services
export type ClcOrganizationSyncLog = typeof clcOrganizationSyncLog.$inferSelect;
export type NewClcOrganizationSyncLog = typeof clcOrganizationSyncLog.$inferInsert;
export type ClcWebhookLog = typeof clcWebhookLog.$inferSelect;
export type NewClcWebhookLog = typeof clcWebhookLog.$inferInsert;
export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type NewChartOfAccount = typeof chartOfAccounts.$inferInsert;
