/**
 * Accounting Integration Schema
 * 
 * Database schema for external accounting system data.
 * Supports QuickBooks Online, Xero, and other accounting systems.
 * 
 * Tables:
 * - external_invoices: Invoices from external accounting systems
 * - external_payments: Payments from external systems
 * - external_customers: Customers/contacts from external systems
 * - external_accounts: Chart of accounts from external systems
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  date,
  boolean,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';

// ============================================================================
// External Invoices
// ============================================================================

export const externalInvoices = pgTable(
  'external_invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(), // QUICKBOOKS, XERO
    
    // Invoice data
    invoiceNumber: varchar('invoice_number', { length: 255 }).notNull(),
    customerId: varchar('customer_id', { length: 255 }).notNull(),
    customerName: varchar('customer_name', { length: 500 }).notNull(),
    invoiceDate: date('invoice_date').notNull(),
    dueDate: date('due_date'),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    balanceAmount: numeric('balance_amount', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 50 }).notNull(), // draft, paid, overdue, etc.
    
    // Sync metadata
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgProviderIdx: index('external_invoices_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    externalIdIdx: index('external_invoices_external_id_idx').on(
      table.externalId
    ),
    invoiceNumberIdx: index('external_invoices_invoice_number_idx').on(
      table.invoiceNumber
    ),
    customerIdx: index('external_invoices_customer_idx').on(
      table.customerId
    ),
    statusIdx: index('external_invoices_status_idx').on(table.status),
    dateIdx: index('external_invoices_date_idx').on(table.invoiceDate),
    uniqueExternalInvoice: unique('unique_external_invoice').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

export const externalInvoicesRelations = relations(
  externalInvoices,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalInvoices.organizationId],
      references: [organizations.id],
    }),
  })
);

// ============================================================================
// External Payments
// ============================================================================

export const externalPayments = pgTable(
  'external_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Payment data
    customerId: varchar('customer_id', { length: 255 }).notNull(),
    customerName: varchar('customer_name', { length: 500 }).notNull(),
    paymentDate: date('payment_date').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    
    // Sync metadata
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgProviderIdx: index('external_payments_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    externalIdIdx: index('external_payments_external_id_idx').on(
      table.externalId
    ),
    customerIdx: index('external_payments_customer_idx').on(
      table.customerId
    ),
    dateIdx: index('external_payments_date_idx').on(table.paymentDate),
    uniqueExternalPayment: unique('unique_external_payment').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

export const externalPaymentsRelations = relations(
  externalPayments,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalPayments.organizationId],
      references: [organizations.id],
    }),
  })
);

// ============================================================================
// External Customers
// ============================================================================

export const externalCustomers = pgTable(
  'external_customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Customer data
    name: varchar('name', { length: 500 }).notNull(),
    companyName: varchar('company_name', { length: 500 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    balance: numeric('balance', { precision: 12, scale: 2 }),
    
    // Sync metadata
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgProviderIdx: index('external_customers_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    externalIdIdx: index('external_customers_external_id_idx').on(
      table.externalId
    ),
    nameIdx: index('external_customers_name_idx').on(table.name),
    emailIdx: index('external_customers_email_idx').on(table.email),
    uniqueExternalCustomer: unique('unique_external_customer').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

export const externalCustomersRelations = relations(
  externalCustomers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalCustomers.organizationId],
      references: [organizations.id],
    }),
  })
);

// ============================================================================
// External Accounts (Chart of Accounts)
// ============================================================================

export const externalAccounts = pgTable(
  'external_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // External system fields
    externalId: varchar('external_id', { length: 255 }).notNull(),
    externalProvider: varchar('external_provider', { length: 50 }).notNull(),
    
    // Account data
    accountName: varchar('account_name', { length: 500 }).notNull(),
    accountType: varchar('account_type', { length: 100 }).notNull(),
    accountSubType: varchar('account_sub_type', { length: 100 }),
    classification: varchar('classification', { length: 100 }), // Asset, Liability, Equity, Revenue, Expense
    currentBalance: numeric('current_balance', { precision: 15, scale: 2 }),
    isActive: boolean('is_active').notNull().default(true),
    
    // Sync metadata
    lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgProviderIdx: index('external_accounts_org_provider_idx').on(
      table.organizationId,
      table.externalProvider
    ),
    externalIdIdx: index('external_accounts_external_id_idx').on(
      table.externalId
    ),
    typeIdx: index('external_accounts_type_idx').on(table.accountType),
    classificationIdx: index('external_accounts_classification_idx').on(
      table.classification
    ),
    activeIdx: index('external_accounts_active_idx').on(table.isActive),
    uniqueExternalAccount: unique('unique_external_account').on(
      table.organizationId,
      table.externalProvider,
      table.externalId
    ),
  })
);

export const externalAccountsRelations = relations(
  externalAccounts,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalAccounts.organizationId],
      references: [organizations.id],
    }),
  })
);
