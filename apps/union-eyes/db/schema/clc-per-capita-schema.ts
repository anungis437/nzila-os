/**
 * CLC Per-Capita Remittances Schema
 * Purpose: Track per-capita tax remittances from local unions to CLC
 * Compliance: CLC Constitution Article 6 - Per-Capita Tax Requirements
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  date,
  timestamp,
  text,
  boolean,
  index,
  foreignKey,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';

/**
 * Per-Capita Remittances Table
 * Tracks monthly per-capita tax payments from local unions to parent organizations (CLC)
 */
export const perCapitaRemittances = pgTable(
  'per_capita_remittances',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(), // Submitting organization (alias for fromOrganizationId for compatibility)
    fromOrganizationId: uuid('from_organization_id').notNull(),
    toOrganizationId: uuid('to_organization_id').notNull(),
    remittanceMonth: integer('remittance_month').notNull(),
    remittanceYear: integer('remittance_year').notNull(),
    dueDate: date('due_date').notNull(),
    totalMembers: integer('total_members').notNull(),
    goodStandingMembers: integer('good_standing_members').notNull(),
    remittableMembers: integer('remittable_members').notNull(),
    perCapitaRate: numeric('per_capita_rate', { precision: 10, scale: 2 }).notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('CAD'),
    clcAccountCode: varchar('clc_account_code', { length: 50 }),
    glAccount: varchar('gl_account', { length: 50 }),
    status: varchar('status', { length: 20 }).default('pending'),
    approvalStatus: varchar('approval_status', { length: 20 }).default('draft'),
    submittedDate: timestamp('submitted_date', { withTimezone: true, mode: 'string' }),
    approvedDate: timestamp('approved_date', { withTimezone: true, mode: 'string' }),
    approvedBy: varchar('approved_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
    rejectedDate: timestamp('rejected_date', { withTimezone: true, mode: 'string' }),
    rejectedBy: varchar('rejected_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
    rejectionReason: text('rejection_reason'),
    paidDate: timestamp('paid_date', { withTimezone: true, mode: 'string' }),
    paymentMethod: varchar('payment_method', { length: 50 }),
    paymentReference: varchar('payment_reference', { length: 100 }),
    remittanceFileUrl: text('remittance_file_url'),
    receiptFileUrl: text('receipt_file_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
    createdBy: varchar('created_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
  },
  (table) => ({
    idxRemittancesDueDate: index('idx_remittances_due_date').on(table.dueDate),
    idxRemittancesOrg: index('idx_remittances_org').on(table.organizationId),
    idxRemittancesFromOrg: index('idx_remittances_from_org').on(table.fromOrganizationId),
    idxRemittancesToOrg: index('idx_remittances_to_org').on(table.toOrganizationId),
    perCapitaRemittancesOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'per_capita_remittances_organization_id_fkey',
    }),
    perCapitaRemittancesFromOrganizationIdFkey: foreignKey({
      columns: [table.fromOrganizationId],
      foreignColumns: [organizations.id],
      name: 'per_capita_remittances_from_organization_id_fkey',
    }),
    perCapitaRemittancesToOrganizationIdFkey: foreignKey({
      columns: [table.toOrganizationId],
      foreignColumns: [organizations.id],
      name: 'per_capita_remittances_to_organization_id_fkey',
    }),
    uniqueOrgRemittancePeriod: unique('unique_org_remittance_period').on(
      table.fromOrganizationId,
      table.toOrganizationId,
      table.remittanceMonth,
      table.remittanceYear
    ),
  })
);

/**
 * Per-Capita Remittances Relations
 */
export const perCapitaRemittancesRelations = relations(perCapitaRemittances, ({ one }) => ({
  fromOrganization: one(organizations, {
    fields: [perCapitaRemittances.fromOrganizationId],
    references: [organizations.id],
    relationName: 'perCapitaRemittances_fromOrganizationId_organizations_id',
  }),
  toOrganization: one(organizations, {
    fields: [perCapitaRemittances.toOrganizationId],
    references: [organizations.id],
    relationName: 'perCapitaRemittances_toOrganizationId_organizations_id',
  }),
}));

/**
 * @deprecated ⚠️ DO NOT USE - USE chartOfAccounts INSTEAD
 * 
 * CLC Chart of Accounts Table - DEPRECATED
 * 
 * ❌ THIS TABLE IS EMPTY (0 rows)
 * ✅ USE: import { chartOfAccounts } from '@/db/schema/domains/finance/accounting'
 * 
 * The canonical chart of accounts is in domains/finance/accounting.ts
 * This table was created for CLC-specific accounts but has been superseded
 * by the unified chartOfAccounts table which contains:
 *   - CLC standard accounts (30 rows with is_clc_standard = true)
 *   - Organization-specific accounts (multi-org)
 *   - Full hierarchy and ERP integration support
 * 
 * Migration plan: This definition will be removed in v3.0
 * See: CHART_OF_ACCOUNTS_DUPLICATION_ANALYSIS.md for details
 */
export const clcChartOfAccounts = pgTable(
  'clc_chart_of_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    accountCode: varchar('account_code', { length: 50 }).notNull(),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    accountType: varchar('account_type', { length: 50 }).notNull(),
    parentAccountCode: varchar('parent_account_code', { length: 50 }),
    isActive: boolean('is_active').default(true),
    description: text('description'),
    financialStatementLine: varchar('financial_statement_line', { length: 100 }),
    statisticsCanadaCode: varchar('statistics_canada_code', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => ({
    idxClcAccountsCode: index('idx_clc_accounts_code').on(table.accountCode),
    idxClcAccountsParent: index('idx_clc_accounts_parent').on(table.parentAccountCode),
    idxClcAccountsType: index('idx_clc_accounts_type').on(table.accountType),
    uniqueAccountCode: unique('clc_chart_of_accounts_account_code_key').on(table.accountCode),
  })
);

/**
 * Remittance Approvals Table
 * Tracks approval workflow for per-capita remittances
 */
export const remittanceApprovals = pgTable(
  'remittance_approvals',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    remittanceId: uuid('remittance_id').notNull(),
    approverUserId: varchar('approver_user_id', { length: 255 }).notNull(), // User ID - matches users.userId VARCHAR(255)
    approverRole: varchar('approver_role', { length: 50 }),
    approvalLevel: varchar('approval_level', { length: 20 }), // local, regional, national, clc (nullable for 'submitted' action)
    action: varchar('action', { length: 20 }).notNull(), // submitted, approved, rejected, returned
    status: varchar('status', { length: 20 }).default('pending'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
    comment: text('comment'), // Renamed from 'comments' for consistency
    rejectionReason: text('rejection_reason'),
    flaggedIssues: text('flagged_issues'),
    requestedChanges: text('requested_changes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => ({
    idxApprovalsRemittance: index('idx_approvals_remittance').on(table.remittanceId),
    idxApprovalsApprover: index('idx_approvals_approver').on(table.approverUserId),
    idxApprovalsStatus: index('idx_approvals_status').on(table.status),
    remittanceApprovalsFkey: foreignKey({
      columns: [table.remittanceId],
      foreignColumns: [perCapitaRemittances.id],
      name: 'remittance_approvals_remittance_id_fkey',
    }),
  })
);

/**
 * CLC Sync Log Table
 * Tracks synchronization operations with CLC national database
 */
export const clcSyncLog = pgTable(
  'clc_sync_log',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id'),
    affiliateCode: varchar('affiliate_code', { length: 50 }),
    action: varchar('action', { length: 50 }).notNull(),
    changes: text('changes'),
    conflicts: text('conflicts'),
    duration: integer('duration'),
    error: text('error'),
    syncedAt: timestamp('synced_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => ({
    idxSyncLogOrg: index('idx_sync_log_org').on(table.organizationId),
    idxSyncLogAffiliate: index('idx_sync_log_affiliate').on(table.affiliateCode),
    idxSyncLogSyncedAt: index('idx_sync_log_synced_at').on(table.syncedAt),
    clcSyncLogOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'clc_sync_log_organization_id_fkey',
    }),
  })
);

/**
 * CLC Webhook Log Table
 * Tracks incoming webhooks from CLC national system
 */
export const clcWebhookLog = pgTable(
  'clc_webhook_log',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    webhookId: varchar('webhook_id', { length: 100 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    affiliateCode: varchar('affiliate_code', { length: 50 }),
    status: varchar('status', { length: 20 }).notNull(),
    message: text('message'),
    payload: text('payload'),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => ({
    idxWebhookLogType: index('idx_webhook_log_type').on(table.type),
    idxWebhookLogAffiliate: index('idx_webhook_log_affiliate').on(table.affiliateCode),
    idxWebhookLogReceivedAt: index('idx_webhook_log_received_at').on(table.receivedAt),
  })
);

/**
 * Organization Contacts Table
 * Contact information for organization representatives
 */
export const organizationContacts = pgTable(
  'organization_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    userId: varchar('user_id', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
    role: varchar('role', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }),
    isPrimary: boolean('is_primary').default(false),
    receiveReminders: boolean('receive_reminders').default(true),
    receiveReports: boolean('receive_reports').default(false),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => ({
    idxContactsOrg: index('idx_contacts_org').on(table.organizationId),
    idxContactsEmail: index('idx_contacts_email').on(table.email),
    idxContactsUser: index('idx_contacts_user').on(table.userId),
    organizationContactsOrgIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'organization_contacts_organization_id_fkey',
    }),
  })
);

/**
 * Remittance Approvals Relations
 */
export const remittanceApprovalsRelations = relations(remittanceApprovals, ({ one }) => ({
  remittance: one(perCapitaRemittances, {
    fields: [remittanceApprovals.remittanceId],
    references: [perCapitaRemittances.id],
  }),
}));

/**
 * CLC Sync Log Relations
 */
export const clcSyncLogRelations = relations(clcSyncLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [clcSyncLog.organizationId],
    references: [organizations.id],
  }),
}));

/**
 * Organization Contacts Relations
 */
export const organizationContactsRelations = relations(organizationContacts, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationContacts.organizationId],
    references: [organizations.id],
  }),
}));

/**
 * Notification Log Table
 * Tracks notifications sent for remittance operations
 */
export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    remittanceId: uuid('remittance_id'),
    organizationId: uuid('organization_id').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    priority: varchar('priority', { length: 20 }).notNull(),
    channel: varchar('channel', { length: 255 }),
    recipients: text('recipients'),
    successCount: integer('success_count').default(0),
    failureCount: integer('failure_count').default(0),
    messageIds: text('message_ids'),
    errors: text('errors'),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => ({
    idxNotificationLogRemittance: index('idx_notification_log_remittance').on(table.remittanceId),
    idxNotificationLogOrg: index('idx_notification_log_org').on(table.organizationId),
    idxNotificationLogSentAt: index('idx_notification_log_sent_at').on(table.sentAt),
    notificationLogRemittanceIdFkey: foreignKey({
      columns: [table.remittanceId],
      foreignColumns: [perCapitaRemittances.id],
      name: 'notification_log_remittance_id_fkey',
    }),
    notificationLogOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'notification_log_organization_id_fkey',
    }),
  })
);

/**
 * Notification Log Relations
 */
export const notificationLogRelations = relations(notificationLog, ({ one }) => ({
  remittance: one(perCapitaRemittances, {
    fields: [notificationLog.remittanceId],
    references: [perCapitaRemittances.id],
  }),
  organization: one(organizations, {
    fields: [notificationLog.organizationId],
    references: [organizations.id],
  }),
}));

/**
 * TypeScript Types
 */
export type PerCapitaRemittance = typeof perCapitaRemittances.$inferSelect;
export type NewPerCapitaRemittance = typeof perCapitaRemittances.$inferInsert;
export type ClcChartOfAccount = typeof clcChartOfAccounts.$inferSelect;
export type NewClcChartOfAccount = typeof clcChartOfAccounts.$inferInsert;
export type RemittanceApproval = typeof remittanceApprovals.$inferSelect;
export type NewRemittanceApproval = typeof remittanceApprovals.$inferInsert;
export type ClcSyncLogEntry = typeof clcSyncLog.$inferSelect;
export type NewClcSyncLogEntry = typeof clcSyncLog.$inferInsert;
export type ClcWebhookLogEntry = typeof clcWebhookLog.$inferSelect;
export type NewClcWebhookLogEntry = typeof clcWebhookLog.$inferInsert;
export type OrganizationContact = typeof organizationContacts.$inferSelect;
export type NewOrganizationContact = typeof organizationContacts.$inferInsert;
export type NotificationLogEntry = typeof notificationLog.$inferSelect;
export type NewNotificationLogEntry = typeof notificationLog.$inferInsert;

