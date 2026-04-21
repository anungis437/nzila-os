/**
 * Nzila OS — Grants pipeline (non-dilutive capital).
 *
 * Bridge-pattern: `organization_id` references the public `organizations`
 * domain without FK to avoid pulling the business schema graph.
 */
import { pgTable, uuid, text, integer, date, timestamp, numeric } from 'drizzle-orm/pg-core'

export const grants = pgTable('grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  programName: text('program_name').notNull(),
  grantor: text('grantor'),
  status: text('status').notNull().default('prospecting'),
  // 'prospecting' | 'drafting' | 'submitted' | 'awarded' | 'rejected' | 'reporting' | 'closed'
  amountRequested: numeric('amount_requested', { precision: 18, scale: 2 }),
  amountAwarded: numeric('amount_awarded', { precision: 18, scale: 2 }),
  amountDrawnDown: numeric('amount_drawn_down', { precision: 18, scale: 2 }),
  currency: text('currency').default('CAD'),
  applicationDeadline: date('application_deadline'),
  decisionDate: date('decision_date'),
  reportDueDate: date('report_due_date'),
  owner: text('owner'),
  productKey: text('product_key'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const grantReports = pgTable('grant_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  grantId: uuid('grant_id').notNull(),
  reportType: text('report_type').notNull(), // 'interim' | 'annual' | 'final'
  dueDate: date('due_date').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  status: text('status').notNull().default('pending'), // 'pending' | 'submitted' | 'accepted' | 'rejected'
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
