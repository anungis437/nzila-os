import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core'

/**
 * Append-only audit of pseudonymous public-intake access (platform 0054, cache 0044). System-only. It names no organization, no actor
 * and no consent, because an unclaimed subject has none: `subjectRef` is a keyed HMAC of the bearer identifier (never the identifier),
 * and the events of one subject form a hash chain. Written by lib/public-intake/intake-audit.ts under the system role.
 */
export const publicIntakeAuditEvents = pgTable('public_intake_audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  subjectKind: varchar('subject_kind', { length: 40 }).notNull(), // unclaimed_workbook
  subjectRef: varchar('subject_ref', { length: 64 }).notNull(),
  surface: varchar('surface', { length: 80 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  operation: varchar('operation', { length: 10 }).notNull(), // read | create | update | delete | denied
  outcome: varchar('outcome', { length: 10 }).notNull().default('success'),
  resourceRef: varchar('resource_ref', { length: 64 }),
  details: jsonb('details').notNull().default({}),
  previousHash: varchar('previous_hash', { length: 64 }),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
})
