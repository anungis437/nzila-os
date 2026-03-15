/**
 * Dues Assignments Schema
 * 
 * Tracks recurring dues obligations assigned to members.
 * Referenced by dues_transactions via assignment_id FK
 * and by the report executor DATA_SOURCES registry.
 */
import { pgTable, uuid, numeric, varchar, timestamp } from 'drizzle-orm/pg-core';

export const duesAssignmentFrequencyEnum = {
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUALLY: 'annually',
} as const;

export const duesAssignmentStatusEnum = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

export const duesAssignments = pgTable('dues_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  memberId: uuid('member_id').notNull(),

  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  frequency: varchar('frequency', { length: 50 }).notNull().default('monthly'),
  status: varchar('status', { length: 50 }).notNull().default('active'),

  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type DuesAssignment = typeof duesAssignments.$inferSelect;
export type DuesAssignmentInsert = typeof duesAssignments.$inferInsert;
