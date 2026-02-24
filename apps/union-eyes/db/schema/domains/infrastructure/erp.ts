/**
 * ERP Integration Database Schema
 * 
 * Drizzle ORM schema for ERP connector configuration, GL mappings,
 * bank reconciliation, and audit trails.
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, decimal, integer, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const erpSystemEnum = pgEnum('erp_system', [
  'quickbooks_online',
  'sage_intacct',
  'xero',
  'sap_business_one',
  'microsoft_dynamics',
  'oracle_netsuite',
  'custom',
]);

export const accountTypeEnum = pgEnum('account_type', [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
  'contra_asset',
  'contra_liability',
]);

export const syncStatusEnum = pgEnum('sync_status', [
  'pending',
  'in_progress',
  'success',
  'failed',
  'partial',
]);

export const syncDirectionEnum = pgEnum('sync_direction', [
  'push',
  'pull',
  'bidirectional',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'sync',
  'approve',
  'reject',
  'void',
  'reverse',
]);

// ============================================================================
// ERP CONNECTORS
// ============================================================================

export const erpConnectors = pgTable('erp_connectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  systemType: erpSystemEnum('system_type').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  
  // Connection credentials (encrypted)
  encryptedCredentials: text('encrypted_credentials').notNull(),
  
  // Configuration
  config: jsonb('config').$type<{
    autoSync: boolean;
    syncInterval?: number;
    defaultGLAccount: string;
    baseCurrency: string;
    timezone: string;
    webhookUrl?: string;
    environment?: 'sandbox' | 'production';
  }>().notNull(),
  
  // Status
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  lastErrorMessage: text('last_error_message'),
  
  // Metadata
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
  updatedBy: varchar('updated_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
}, (table) => ({
  organizationIdx: index('erp_connectors_organization_idx').on(table.organizationId),
  systemTypeIdx: index('erp_connectors_system_type_idx').on(table.systemType),
}));

// ============================================================================
// CHART OF ACCOUNTS
// ============================================================================

export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  connectorId: uuid('connector_id').notNull().references(() => erpConnectors.id),
  
  externalId: varchar('external_id', { length: 255 }).notNull(),
  accountNumber: varchar('account_number', { length: 100 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountType: accountTypeEnum('account_type').notNull(),
  
  parentAccountId: uuid('parent_account_id'),
  isActive: boolean('is_active').default(true).notNull(),
  isHeader: boolean('is_header').default(false).notNull(),
  
  currency: varchar('currency', { length: 3 }).default('CAD').notNull(),
  balance: decimal('balance', { precision: 19, scale: 4 }).default('0').notNull(),
  balanceDate: timestamp('balance_date', { withTimezone: true }),
  
  description: text('description'),
  taxClassification: varchar('tax_classification', { length: 100 }),
  
  metadata: jsonb('metadata'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  organizationIdx: index('coa_organization_idx').on(table.organizationId),
  connectorIdx: index('coa_connector_idx').on(table.connectorId),
  accountNumberIdx: index('coa_account_number_idx').on(table.accountNumber),
  externalIdIdx: index('coa_external_id_idx').on(table.externalId),
}));

// ============================================================================
// GL ACCOUNT MAPPINGS
// ============================================================================

export const glAccountMappings = pgTable('gl_account_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  connectorId: uuid('connector_id').notNull().references(() => erpConnectors.id),
  
  unionEyesAccount: varchar('union_eyes_account', { length: 255 }).notNull(),
  erpAccountId: uuid('erp_account_id').notNull().references(() => chartOfAccounts.id),
  accountType: accountTypeEnum('account_type').notNull(),
  
  description: text('description'),
  autoSync: boolean('auto_sync').default(true).notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
  updatedBy: varchar('updated_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
}, (table) => ({
  organizationIdx: index('gl_mappings_organization_idx').on(table.organizationId),
  unionAccountIdx: index('gl_mappings_union_account_idx').on(table.unionEyesAccount),
  erpAccountIdx: index('gl_mappings_erp_account_idx').on(table.erpAccountId),
}));

// ============================================================================
// JOURNAL ENTRIES
// ============================================================================

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  connectorId: uuid('connector_id').references(() => erpConnectors.id),
  
  externalId: varchar('external_id', { length: 255 }),
  entryNumber: varchar('entry_number', { length: 100 }).notNull(),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  postingDate: timestamp('posting_date', { withTimezone: true }).notNull(),
  
  description: text('description').notNull(),
  reference: varchar('reference', { length: 255 }),
  currency: varchar('currency', { length: 3 }).default('CAD').notNull(),
  
  totalDebit: decimal('total_debit', { precision: 19, scale: 4 }).notNull(),
  totalCredit: decimal('total_credit', { precision: 19, scale: 4 }).notNull(),
  
  isPosted: boolean('is_posted').default(false).notNull(),
  isReversed: boolean('is_reversed').default(false).notNull(),
  reversalEntryId: uuid('reversal_entry_id'),
  
  createdBy: varchar('created_by', { length: 255 }).notNull(), // User ID - matches users.userId VARCHAR(255)
  approvedBy: varchar('approved_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  metadata: jsonb('metadata'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  organizationIdx: index('je_organization_idx').on(table.organizationId),
  entryNumberIdx: index('je_entry_number_idx').on(table.entryNumber),
  entryDateIdx: index('je_entry_date_idx').on(table.entryDate),
  externalIdIdx: index('je_external_id_idx').on(table.externalId),
}));

export const journalEntryLines = pgTable('journal_entry_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  lineNumber: integer('line_number').notNull(),
  
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  debitAmount: decimal('debit_amount', { precision: 19, scale: 4 }).default('0').notNull(),
  creditAmount: decimal('credit_amount', { precision: 19, scale: 4 }).default('0').notNull(),
  
  description: text('description'),
  
  // Union-specific dimensions
  memberId: uuid('member_id'),
  bargainingUnitId: uuid('bargaining_unit_id'),
  departmentId: varchar('department_id', { length: 255 }),
  locationId: varchar('location_id', { length: 255 }),
  projectId: varchar('project_id', { length: 255 }),
  
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  entryIdx: index('jel_entry_idx').on(table.entryId),
  accountIdx: index('jel_account_idx').on(table.accountId),
  memberIdx: index('jel_member_idx').on(table.memberId),
}));

// ============================================================================
// INVOICES
// ============================================================================

export const erpInvoices = pgTable('erp_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  connectorId: uuid('connector_id').references(() => erpConnectors.id),
  
  externalId: varchar('external_id', { length: 255 }),
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
  invoiceDate: timestamp('invoice_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  
  customerId: varchar('customer_id', { length: 255 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerEmail: varchar('customer_email', { length: 255 }),
  
  billingAddress: jsonb('billing_address'),
  shippingAddress: jsonb('shipping_address'),
  
  currency: varchar('currency', { length: 3 }).default('CAD').notNull(),
  subtotal: decimal('subtotal', { precision: 19, scale: 4 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 19, scale: 4 }).default('0').notNull(),
  totalAmount: decimal('total_amount', { precision: 19, scale: 4 }).notNull(),
  amountPaid: decimal('amount_paid', { precision: 19, scale: 4 }).default('0').notNull(),
  amountDue: decimal('amount_due', { precision: 19, scale: 4 }).notNull(),
  
  status: varchar('status', { length: 50 }).notNull(),
  terms: text('terms'),
  memo: text('memo'),
  
  pdfUrl: text('pdf_url'),
  
  metadata: jsonb('metadata'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  organizationIdx: index('invoices_organization_idx').on(table.organizationId),
  invoiceNumberIdx: index('invoices_number_idx').on(table.invoiceNumber),
  statusIdx: index('invoices_status_idx').on(table.status),
  dueDateIdx: index('invoices_due_date_idx').on(table.dueDate),
}));

// ============================================================================
// BANK ACCOUNTS
// ============================================================================

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  connectorId: uuid('connector_id').references(() => erpConnectors.id),
  
  externalId: varchar('external_id', { length: 255 }),
  bankName: varchar('bank_name', { length: 255 }).notNull(),
  accountNumber: varchar('account_number', { length: 255 }).notNull(), // Last 4 digits only
  accountType: varchar('account_type', { length: 50 }).notNull(),
  
  currency: varchar('currency', { length: 3 }).default('CAD').notNull(),
  currentBalance: decimal('current_balance', { precision: 19, scale: 4 }).default('0').notNull(),
  availableBalance: decimal('available_balance', { precision: 19, scale: 4 }).default('0').notNull(),
  
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
  
  // Bank feed provider
  bankFeedProvider: varchar('bank_feed_provider', { length: 50 }),
  bankFeedEnabled: boolean('bank_feed_enabled').default(false).notNull(),
  encryptedBankCredentials: text('encrypted_bank_credentials'),
  
  lastSyncDate: timestamp('last_sync_date', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  organizationIdx: index('bank_accounts_organization_idx').on(table.organizationId),
}));

export const bankTransactions = pgTable('bank_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  bankAccountId: uuid('bank_account_id').notNull().references(() => bankAccounts.id, { onDelete: 'cascade' }),
  
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),
  postingDate: timestamp('posting_date', { withTimezone: true }).notNull(),
  
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 19, scale: 4 }).notNull(),
  type: varchar('type', { length: 10 }).notNull(), // 'debit' or 'credit'
  balance: decimal('balance', { precision: 19, scale: 4 }),
  
  reference: varchar('reference', { length: 255 }),
  payee: varchar('payee', { length: 255 }),
  category: varchar('category', { length: 255 }),
  
  isReconciled: boolean('is_reconciled').default(false).notNull(),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
  matchedTransactionId: uuid('matched_transaction_id'),
  
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  bankAccountIdx: index('bank_txns_account_idx').on(table.bankAccountId),
  transactionDateIdx: index('bank_txns_date_idx').on(table.transactionDate),
  reconciledIdx: index('bank_txns_reconciled_idx').on(table.isReconciled),
}));

export const bankReconciliations = pgTable('bank_reconciliations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bank_account_id').notNull().references(() => bankAccounts.id),
  
  statementDate: timestamp('statement_date', { withTimezone: true }).notNull(),
  statementBalance: decimal('statement_balance', { precision: 19, scale: 4 }).notNull(),
  glBalance: decimal('gl_balance', { precision: 19, scale: 4 }).notNull(),
  difference: decimal('difference', { precision: 19, scale: 4 }).notNull(),
  
  status: varchar('status', { length: 50 }).default('in_progress').notNull(),
  
  reconciledBy: varchar('reconciled_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
  approvedBy: varchar('approved_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  organizationIdx: index('bank_recon_organization_idx').on(table.organizationId),
  bankAccountIdx: index('bank_recon_account_idx').on(table.bankAccountId),
  statementDateIdx: index('bank_recon_date_idx').on(table.statementDate),
}));

// ============================================================================
// SYNC JOBS
// ============================================================================

export const syncJobs = pgTable('sync_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  connectorId: uuid('connector_id').notNull().references(() => erpConnectors.id),
  
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  direction: syncDirectionEnum('direction').notNull(),
  status: syncStatusEnum('status').default('pending').notNull(),
  
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  recordsProcessed: integer('records_processed').default(0).notNull(),
  recordsSucceeded: integer('records_succeeded').default(0).notNull(),
  recordsFailed: integer('records_failed').default(0).notNull(),
  
  errors: jsonb('errors').$type<Array<{
    recordId: string;
    recordType: string;
    errorCode: string;
    errorMessage: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: any;
    timestamp: Date;
  }>>(),
  
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  organizationIdx: index('sync_jobs_organization_idx').on(table.organizationId),
  connectorIdx: index('sync_jobs_connector_idx').on(table.connectorId),
  statusIdx: index('sync_jobs_status_idx').on(table.status),
  startedAtIdx: index('sync_jobs_started_at_idx').on(table.startedAt),
}));

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export const financialAuditLog = pgTable('financial_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: auditActionEnum('action').notNull(),
  
  userId: varchar('user_id', { length: 255 }).notNull(), // User ID - matches users.userId VARCHAR(255)
  userName: varchar('user_name', { length: 255 }).notNull(),
  
  changes: jsonb('changes').$type<Array<{
    field: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oldValue: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newValue: any;
  }>>(),
  
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  organizationIdx: index('audit_organization_idx').on(table.organizationId),
  entityIdx: index('audit_entity_idx').on(table.entityType, table.entityId),
  userIdx: index('audit_user_idx').on(table.userId),
  timestampIdx: index('audit_timestamp_idx').on(table.timestamp),
}));

// ============================================================================
// CURRENCY EXCHANGE RATES
// ============================================================================

export const currencyExchangeRates = pgTable('currency_exchange_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  baseCurrency: varchar('base_currency', { length: 3 }).notNull(),
  targetCurrency: varchar('target_currency', { length: 3 }).notNull(),
  rate: decimal('rate', { precision: 19, scale: 8 }).notNull(),
  
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  source: varchar('source', { length: 100 }).notNull(),
  
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  organizationIdx: index('fx_rates_organization_idx').on(table.organizationId),
  currencyIdx: index('fx_rates_currency_idx').on(table.baseCurrency, table.targetCurrency),
  effectiveDateIdx: index('fx_rates_date_idx').on(table.effectiveDate),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const erpConnectorsRelations = relations(erpConnectors, ({ many }) => ({
  chartOfAccounts: many(chartOfAccounts),
  glMappings: many(glAccountMappings),
  journalEntries: many(journalEntries),
  invoices: many(erpInvoices),
  bankAccounts: many(bankAccounts),
  syncJobs: many(syncJobs),
}));

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  connector: one(erpConnectors, {
    fields: [chartOfAccounts.connectorId],
    references: [erpConnectors.id],
  }),
  glMappings: many(glAccountMappings),
  journalEntryLines: many(journalEntryLines),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  connector: one(erpConnectors, {
    fields: [journalEntries.connectorId],
    references: [erpConnectors.id],
  }),
  lines: many(journalEntryLines),
}));

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [journalEntryLines.entryId],
    references: [journalEntries.id],
  }),
  account: one(chartOfAccounts, {
    fields: [journalEntryLines.accountId],
    references: [chartOfAccounts.id],
  }),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  connector: one(erpConnectors, {
    fields: [bankAccounts.connectorId],
    references: [erpConnectors.id],
  }),
  glAccount: one(chartOfAccounts, {
    fields: [bankAccounts.glAccountId],
    references: [chartOfAccounts.id],
  }),
  transactions: many(bankTransactions),
  reconciliations: many(bankReconciliations),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  bankAccount: one(bankAccounts, {
    fields: [bankTransactions.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

