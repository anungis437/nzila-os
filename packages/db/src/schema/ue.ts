/**
 * Nzila OS — Union Eyes vertical schema
 *
 * Tables:
 *   ueCases — Union Eyes case records (source of truth for ML training + inference)
 *
 * Column names match the canonical UE data layer. ML scripts (dataset builders,
 * inference runners) MUST import this table rather than raw-SQL guessing column
 * names, so schema drift is caught at compile time, not runtime.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core'
import { entities } from './entities'

// ── ueCases ───────────────────────────────────────────────────────────────────

export const ueCases = pgTable(
  'ue_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id),

    /** Case category / type (e.g., "grievance", "inquiry", "complaint") */
    category: text('category'),
    /** Intake channel (e.g., "email", "portal", "phone") */
    channel: text('channel'),
    /** Current workflow status (e.g., "open", "in_progress", "closed") */
    status: text('status'),
    /** Queue/team assignment — team-level only, no individual identifiers */
    assignedQueue: text('assigned_queue'),

    /**
     * Native priority label written by staff or source system.
     * Valid values: low | medium | high | critical
     * Used as y_priority ground truth label for the supervised priority model.
     */
    priority: text('priority'),

    /**
     * Whether the case breached its SLA as determined by the UE platform.
     * Used as y_sla_breached ground truth label for the binary SLA risk model.
     */
    slaBreached: boolean('sla_breached'),

    /** Number of times the case was reopened after closure */
    reopenCount: integer('reopen_count').default(0),
    /** Total number of messages on the case thread */
    messageCount: integer('message_count').default(0),
    /** Number of file attachments on the case */
    attachmentCount: integer('attachment_count').default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ue_cases_entity_id_idx').on(table.entityId),
    index('ue_cases_entity_status_idx').on(table.entityId, table.status),
    index('ue_cases_entity_created_at_idx').on(table.entityId, table.createdAt),
  ],
)
