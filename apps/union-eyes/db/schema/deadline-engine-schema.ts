/**
 * Union Eyes — Deadline Engine Schema
 *
 * Wave 1 Phase A: durable reminder outbox + append-only execution history +
 * append-only audit trail. Mirror of migrations/0045_union_eyes_deadline_engine.sql.
 *
 * Do NOT extend this schema without also updating the SQL migration; the DB
 * enforces the invariants (lease guard, append-only history, RLS). Drizzle is
 * a client-side convenience only.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  varchar,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// deadline_reminders
// ============================================================================
export const deadlineReminders = pgTable(
  'deadline_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    sourceTable: text('source_table').notNull(), // 'grievance_deadlines' | 'claim_deadlines'
    sourceDeadlineId: uuid('source_deadline_id').notNull(),

    organizationId: uuid('organization_id').notNull(),

    offsetDays: integer('offset_days').notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    reminderKind: text('reminder_kind').notNull().default('upcoming'), // 'upcoming' | 'overdue' | 'escalation'

    recipientUserId: varchar('recipient_user_id', { length: 255 }),
    recipientRole: text('recipient_role').notNull(), // 'grievor' | 'assigned_officer' | 'assigned_steward' | 'org_admin'
    recipientEmail: text('recipient_email').notNull(),
    recipientEmailHash: text('recipient_email_hash').notNull(),
    recipientLocale: text('recipient_locale').notNull().default('en'),

    messageTemplate: text('message_template').notNull().default('deadline_reminder_v1'),
    messageSubject: text('message_subject').notNull().default('Union Eyes deadline reminder'),

    status: text('status').notNull().default('pending'), // pending | claimed | sent | failed | dead_letter | cancelled
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),

    provider: text('provider'),
    providerMessageId: text('provider_message_id'),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),

    cancelledReason: text('cancelled_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deadLetteredAt: timestamp('dead_lettered_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('deadline_reminders_pending_uidx').on(
      t.sourceDeadlineId,
      t.recipientEmailHash,
      t.offsetDays,
      t.reminderKind,
    ),
    uniqueIndex('deadline_reminders_provider_msg_uidx').on(t.provider, t.providerMessageId),
    index('deadline_reminders_pending_scan_idx').on(t.scheduledFor, t.id),
    index('deadline_reminders_lease_recovery_idx').on(t.leaseExpiresAt),
    index('deadline_reminders_source_lookup_idx').on(t.sourceDeadlineId, t.status),
    index('deadline_reminders_org_status_idx').on(t.organizationId, t.status),
  ],
);

// ============================================================================
// deadline_reminder_executions (append-only)
// ============================================================================
export const deadlineReminderExecutions = pgTable(
  'deadline_reminder_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reminderId: uuid('reminder_id')
      .notNull()
      .references(() => deadlineReminders.id, { onDelete: 'restrict' }),
    attemptNumber: integer('attempt_number').notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    outcome: text('outcome').notNull(), // 'sent' | 'transient_failure' | 'permanent_failure' | 'skipped_cancelled'
    provider: text('provider'),
    providerMessageId: text('provider_message_id'),
    providerStatusCode: integer('provider_status_code'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    workerInstance: text('worker_instance').notNull(),
    correlationId: text('correlation_id').notNull(),
  },
  (t) => [
    uniqueIndex('deadline_reminder_executions_attempt_uidx').on(t.reminderId, t.attemptNumber),
    index('deadline_reminder_executions_reminder_idx').on(t.reminderId, t.attemptedAt),
  ],
);

// ============================================================================
// deadline_audit_events (append-only)
// ============================================================================
export const deadlineAuditEvents = pgTable(
  'deadline_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sourceTable: text('source_table').notNull(),
    sourceDeadlineId: uuid('source_deadline_id').notNull(),
    reminderId: uuid('reminder_id'),
    eventType: text('event_type').notNull(),
    actorType: text('actor_type').notNull(), // 'system' | 'user' | 'worker'
    actorId: varchar('actor_id', { length: 255 }),
    correlationId: text('correlation_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('deadline_audit_events_deadline_idx').on(t.sourceDeadlineId, t.occurredAt),
    index('deadline_audit_events_reminder_idx').on(t.reminderId, t.occurredAt),
    index('deadline_audit_events_org_time_idx').on(t.organizationId, t.occurredAt),
    index('deadline_audit_events_type_time_idx').on(t.eventType, t.occurredAt),
  ],
);

// ============================================================================
// deadline_reassignment_convergence
// ============================================================================
// Durable work item for the assignment → reminder-recipient handoff. A row
// is inserted in the SAME transaction as the grievance's union_rep_id
// update, so an assignment change can never commit without a durable
// convergence task existing. status stays 'pending' (never a terminal
// failure state) across attempts so retries keep converging it — see
// assignment-sync.ts's processAssignmentConvergence()/sweepPending...().
export const deadlineReassignmentConvergence = pgTable(
  'deadline_reassignment_convergence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    grievanceId: uuid('grievance_id').notNull(),
    previousAssigneeId: varchar('previous_assignee_id', { length: 255 }),
    newAssigneeId: varchar('new_assignee_id', { length: 255 }).notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'converged'
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    correlationId: text('correlation_id').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }),
    convergedAt: timestamp('converged_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('deadline_reassignment_convergence_pending_idx').on(t.grievanceId),
    index('deadline_reassignment_convergence_org_idx').on(t.organizationId, t.status),
  ],
);

export type DeadlineReassignmentConvergence = typeof deadlineReassignmentConvergence.$inferSelect;
export type DeadlineReassignmentConvergenceInsert =
  typeof deadlineReassignmentConvergence.$inferInsert;
export type DeadlineReassignmentConvergenceStatus = 'pending' | 'converged';

// ============================================================================
// Relations
// ============================================================================
export const deadlineRemindersRelations = relations(deadlineReminders, ({ many }) => ({
  executions: many(deadlineReminderExecutions),
}));

export const deadlineReminderExecutionsRelations = relations(
  deadlineReminderExecutions,
  ({ one }) => ({
    reminder: one(deadlineReminders, {
      fields: [deadlineReminderExecutions.reminderId],
      references: [deadlineReminders.id],
    }),
  }),
);

// ============================================================================
// Types
// ============================================================================
export type DeadlineReminder = typeof deadlineReminders.$inferSelect;
export type DeadlineReminderInsert = typeof deadlineReminders.$inferInsert;
export type DeadlineReminderExecution = typeof deadlineReminderExecutions.$inferSelect;
export type DeadlineReminderExecutionInsert = typeof deadlineReminderExecutions.$inferInsert;
export type DeadlineAuditEvent = typeof deadlineAuditEvents.$inferSelect;
export type DeadlineAuditEventInsert = typeof deadlineAuditEvents.$inferInsert;

export type DeadlineReminderStatus =
  | 'pending'
  | 'claimed'
  | 'sent'
  | 'failed'
  | 'dead_letter'
  | 'cancelled';

export type DeadlineReminderKind = 'upcoming' | 'overdue' | 'escalation';

export type DeadlineReminderRecipientRole =
  | 'grievor'
  | 'assigned_officer'
  | 'assigned_steward'
  | 'org_admin';

export type DeadlineAuditEventType =
  | 'deadline.created'
  | 'deadline.rescheduled'
  | 'deadline.completed'
  | 'deadline.cancelled'
  | 'deadline.extension_requested'
  | 'deadline.extension_approved'
  | 'deadline.escalation_triggered'
  | 'reminder.scheduled'
  | 'reminder.cancelled_reschedule'
  | 'reminder.claimed'
  | 'reminder.sent'
  | 'reminder.failed_transient'
  | 'reminder.failed_permanent'
  | 'reminder.dead_lettered'
  | 'reminder.replayed'
  | 'reminder.lease_recovered'
  | 'reminder.recipients_refreshed'
  | 'reminder.superseded_at_dispatch'
  | 'overdue.detected'
  | 'overdue.processed';
