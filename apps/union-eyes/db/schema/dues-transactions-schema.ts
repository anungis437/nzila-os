/**
 * Dues Transactions Schema
 * Database schema for tracking member dues and payments
 */
import { pgTable, text, uuid, numeric, timestamp, date, pgEnum, jsonb, varchar } from 'drizzle-orm/pg-core';

export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'paid', 'partial', 'overdue', 'waived', 'refunded', 'cancelled']);
export const transactionTypeEnum = pgEnum('transaction_type', ['charge', 'payment', 'adjustment', 'refund', 'waiver', 'late_fee']);

export const duesTransactions = pgTable('dues_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  memberId: text('member_id').notNull(),
  assignmentId: uuid('assignment_id'),
  ruleId: uuid('rule_id'),
  
  // Transaction type
  transactionType: varchar('transaction_type', { length: 50 }).notNull(),
  
  // Legacy amount column (kept for backward compatibility)
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  
  // Period covered by this transaction
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  
  // Due date
  dueDate: date('due_date').notNull(),
  
  // Status
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  
  // Legacy payment date column
  paymentDate: timestamp('payment_date', { withTimezone: true }),
  
  // Payment details
  paymentMethod: varchar('payment_method', { length: 50 }),
  paymentReference: varchar('payment_reference', { length: 255 }),
  
  // Notes and metadata
  notes: text('notes'),
  metadata: jsonb('metadata').default({}),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  
  // Detailed dues breakdown (added in migration 058)
  duesAmount: numeric('dues_amount', { precision: 10, scale: 2 }).notNull(),
  copeAmount: numeric('cope_amount', { precision: 10, scale: 2 }).default('0.00'),
  pacAmount: numeric('pac_amount', { precision: 10, scale: 2 }).default('0.00'),
  strikeFundAmount: numeric('strike_fund_amount', { precision: 10, scale: 2 }).default('0.00'),
  lateFeeAmount: numeric('late_fee_amount', { precision: 10, scale: 2 }).default('0.00'),
  adjustmentAmount: numeric('adjustment_amount', { precision: 10, scale: 2 }).default('0.00'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  
  // New payment date column (preferred over legacy paymentDate)
  paidDate: timestamp('paid_date', { withTimezone: true }),
  
  // Receipt URL
  receiptUrl: text('receipt_url'),
});

export type DuesTransaction = typeof duesTransactions.$inferSelect;
export type NewDuesTransaction = typeof duesTransactions.$inferInsert;

