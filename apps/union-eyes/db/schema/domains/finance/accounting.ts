/**
 * Chart of Accounts Schema
 * 
 * Financial accounting structure for GL integration and reporting
 * Includes accounts, cost centers, and transaction mappings for ERP systems
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../../../schema-organizations";

// ============================================================================
// ENUMS
// ============================================================================

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "cost_of_goods_sold",
  "other_income",
  "other_expense",
]);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "inactive",
  "archived",
  "deleted",
]);

export const costCenterTypeEnum = pgEnum("cost_center_type", [
  "department",
  "project",
  "location",
  "program",
  "fund",
  "grant",
  "other",
]);

// ============================================================================
// MAIN TABLES
// ============================================================================

/**
 * Chart of Accounts - main GL accounts
 */
export const chartOfAccounts = pgTable(
  "chart_of_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Account identification
    accountNumber: varchar("account_number", { length: 50 }).notNull(),
    accountName: varchar("account_name", { length: 255 }).notNull(),
    description: text("description"),
    
    // Classification
    type: accountTypeEnum("type").notNull(),
    subType: varchar("sub_type", { length: 100 }), // More granular classification
    
    // Hierarchy
    parentAccountId: uuid("parent_account_id").references(() => chartOfAccounts.id),
    
    // Details
    status: accountStatusEnum("status").notNull().default("active"),
    normalBalance: varchar("normal_balance", { length: 10 }), // debit or credit
    isSubAccount: boolean("is_sub_account").default(false),
    allowTransactions: boolean("allow_transactions").default(true),
    
    // Rules
    requireCostCenter: boolean("require_cost_center").default(false),
    requireDepartment: boolean("require_department").default(false),
    requireApproval: boolean("require_approval").default(false),
    requireInvoice: boolean("require_invoice").default(false),
    
    // Reconciliation
    isReconciledDaily: boolean("is_reconciled_daily").default(false),
    lastReconciledAt: timestamp("last_reconciled_at"),
    lastReconciledBalance: decimal("last_reconciled_balance", { precision: 19, scale: 2 }),
    
    // Metadata
    glCode: varchar("gl_code", { length: 50 }), // External GL code
    sapCode: varchar("sap_code", { length: 50 }), // SAP code
    quickbooksCode: varchar("quickbooks_code", { length: 50 }),
    
    // Opening balances
    openingBalance: decimal("opening_balance", { precision: 19, scale: 2 }).default("0"),
    openingBalanceDate: timestamp("opening_balance_date"),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 255 }),
    updatedBy: varchar("updated_by", { length: 255 }),
  },
  (t) => ({
    orgIdx: index("chart_of_accounts_org_idx").on(t.organizationId),
    numberIdx: index("chart_of_accounts_number_idx").on(t.accountNumber, t.organizationId),
    typeIdx: index("chart_of_accounts_type_idx").on(t.type),
    statusIdx: index("chart_of_accounts_status_idx").on(t.status),
    parentIdx: index("chart_of_accounts_parent_idx").on(t.parentAccountId),
  })
);

/**
 * Cost Centers - for tracking expenses by department/project
 */
export const costCenters = pgTable(
  "cost_centers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Identification
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: costCenterTypeEnum("type").notNull(),
    
    // Hierarchy
    parentCostCenterId: uuid("parent_cost_center_id").references(() => costCenters.id),
    
    // Details
    manager: varchar("manager", { length: 255 }), // User ID of manager
    status: varchar("status", { length: 50 }).notNull().default("active"),
    
    // Budget
    budgetAmount: decimal("budget_amount", { precision: 19, scale: 2 }),
    budgetPeriod: varchar("budget_period", { length: 50 }), // monthly, quarterly, annual
    budgetStartDate: timestamp("budget_start_date"),
    budgetEndDate: timestamp("budget_end_date"),
    
    // Thresholds
    warningThreshold: integer("warning_threshold").default(80), // percent
    
    // Metadata
    externalCode: varchar("external_code", { length: 100 }),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 255 }),
    updatedBy: varchar("updated_by", { length: 255 }),
  },
  (t) => ({
    orgIdx: index("cost_centers_org_idx").on(t.organizationId),
    codeIdx: index("cost_centers_code_idx").on(t.code, t.organizationId),
    typeIdx: index("cost_centers_type_idx").on(t.type),
    statusIdx: index("cost_centers_status_idx").on(t.status),
  })
);

/**
 * GL Account Mappings - maps local accounts to general ledger codes
 */
export const glAccountMappings = pgTable(
  "gl_account_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    chartOfAccountsId: uuid("chart_of_accounts_id")
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: "cascade" }),
    
    // Mapping details
    localAccountType: varchar("local_account_type", { length: 100 }).notNull(), // e.g., dues, strike_fund
    localTransactionType: varchar("local_transaction_type", { length: 100 }).notNull(), // e.g., payment, refund
    
    // GL info
    glAccountNumber: varchar("gl_account_number", { length: 50 }).notNull(),
    glDepartment: varchar("gl_department", { length: 50 }),
    glCostCenter: varchar("gl_cost_center", { length: 50 }),
    
    // ERP system
    erpSystemCode: varchar("erp_system_code", { length: 50 }), // sap, quickbooks, netsuite
    erpAccountCode: varchar("erp_account_code", { length: 100 }),
    
    // Mapping rules
    debitAccount: varchar("debit_account", { length: 50 }),
    creditAccount: varchar("credit_account", { length: 50 }),
    
    // Status
    isActive: boolean("is_active").default(true),
    validFrom: timestamp("valid_from"),
    validTo: timestamp("valid_to"),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 255 }),
  },
  (t) => ({
    orgIdx: index("gl_account_mappings_org_idx").on(t.organizationId),
    chartIdx: index("gl_account_mappings_chart_idx").on(t.chartOfAccountsId),
    localTypeIdx: index("gl_account_mappings_local_type_idx").on(t.localAccountType),
    glIdx: index("gl_account_mappings_gl_idx").on(t.glAccountNumber),
  })
);

/**
 * GL Transaction Log - audit trail of ALL GL transactions
 */
export const glTransactionLog = pgTable(
  "gl_transaction_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    chartOfAccountsId: uuid("chart_of_accounts_id")
      .notNull()
      .references(() => chartOfAccounts.id),
    
    // Transaction details
    transactionDate: timestamp("transaction_date").notNull(),
    transactionNumber: varchar("transaction_number", { length: 50 }).notNull().unique(),
    description: text("description"),
    
    // Amounts
    debitAmount: decimal("debit_amount", { precision: 19, scale: 2 }).default("0"),
    creditAmount: decimal("credit_amount", { precision: 19, scale: 2 }).default("0"),
    
    // References
    costCenterId: uuid("cost_center_id").references(() => costCenters.id),
    invoiceNumber: varchar("invoice_number", { length: 100 }),
    receiptNumber: varchar("receipt_number", { length: 100 }),
    purchaseOrderNumber: varchar("purchase_order_number", { length: 100 }),
    
    // Source
    sourceSystem: varchar("source_system", { length: 100 }), // dues, payments, payroll, etc.
    sourceRecordId: varchar("source_record_id", { length: 100 }),
    
    // Post status
    isPosted: boolean("is_posted").default(false),
    postedAt: timestamp("posted_at"),
    postedBy: varchar("posted_by", { length: 255 }),
    
    // Reconciliation
    isReconciled: boolean("is_reconciled").default(false),
    reconciledAt: timestamp("reconciled_at"),
    reconciledBy: varchar("reconciled_by", { length: 255 }),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 255 }),
  },
  (t) => ({
    orgIdx: index("gl_transaction_log_org_idx").on(t.organizationId),
    chartIdx: index("gl_transaction_log_chart_idx").on(t.chartOfAccountsId),
    dateIdx: index("gl_transaction_log_date_idx").on(t.transactionDate),
    numberIdx: index("gl_transaction_log_number_idx").on(t.transactionNumber),
    postedIdx: index("gl_transaction_log_posted_idx").on(t.isPosted),
    reconciledIdx: index("gl_transaction_log_reconciled_idx").on(t.isReconciled),
  })
);

/**
 * GL Trial Balance - monthly/period trial balance snapshots
 */
export const glTrialBalance = pgTable(
  "gl_trial_balance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    chartOfAccountsId: uuid("chart_of_accounts_id")
      .notNull()
      .references(() => chartOfAccounts.id),
    
    // Period
    periodEndDate: timestamp("period_end_date").notNull(),
    
    // Balances
    openingBalance: decimal("opening_balance", { precision: 19, scale: 2 }).default("0"),
    debitTotal: decimal("debit_total", { precision: 19, scale: 2 }).default("0"),
    creditTotal: decimal("credit_total", { precision: 19, scale: 2 }).default("0"),
    closingBalance: decimal("closing_balance", { precision: 19, scale: 2 }).default("0"),
    
    // Status
    isFinalized: boolean("is_finalized").default(false),
    finalizedAt: timestamp("finalized_at"),
    finalizedBy: varchar("finalized_by", { length: 255 }),
    
    // Verification
    isBalanced: boolean("is_balanced").default(false),
    balance: decimal("balance", { precision: 19, scale: 2 }), // Should be 0 if balanced
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 255 }),
  },
  (t) => ({
    orgIdx: index("gl_trial_balance_org_idx").on(t.organizationId),
    chartIdx: index("gl_trial_balance_chart_idx").on(t.chartOfAccountsId),
    dateIdx: index("gl_trial_balance_date_idx").on(t.periodEndDate),
    finalizedIdx: index("gl_trial_balance_finalized_idx").on(t.isFinalized),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [chartOfAccounts.organizationId],
    references: [organizations.id],
  }),
  parentAccount: one(chartOfAccounts, {
    fields: [chartOfAccounts.parentAccountId],
    references: [chartOfAccounts.id],
  }),
  childAccounts: many(chartOfAccounts),
  mappings: many(glAccountMappings),
  transactions: many(glTransactionLog),
  trialBalances: many(glTrialBalance),
}));

export const costCentersRelations = relations(costCenters, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [costCenters.organizationId],
    references: [organizations.id],
  }),
  parentCostCenter: one(costCenters, {
    fields: [costCenters.parentCostCenterId],
    references: [costCenters.id],
  }),
  childCostCenters: many(costCenters),
  transactions: many(glTransactionLog),
}));

export const glAccountMappingsRelations = relations(glAccountMappings, ({ one }) => ({
  organization: one(organizations, {
    fields: [glAccountMappings.organizationId],
    references: [organizations.id],
  }),
  account: one(chartOfAccounts, {
    fields: [glAccountMappings.chartOfAccountsId],
    references: [chartOfAccounts.id],
  }),
}));

export const glTransactionLogRelations = relations(glTransactionLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [glTransactionLog.organizationId],
    references: [organizations.id],
  }),
  account: one(chartOfAccounts, {
    fields: [glTransactionLog.chartOfAccountsId],
    references: [chartOfAccounts.id],
  }),
  costCenter: one(costCenters, {
    fields: [glTransactionLog.costCenterId],
    references: [costCenters.id],
  }),
}));

export const glTrialBalanceRelations = relations(glTrialBalance, ({ one }) => ({
  organization: one(organizations, {
    fields: [glTrialBalance.organizationId],
    references: [organizations.id],
  }),
  account: one(chartOfAccounts, {
    fields: [glTrialBalance.chartOfAccountsId],
    references: [chartOfAccounts.id],
  }),
}));

