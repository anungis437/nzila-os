/**
 * Messages Schema
 * Real-time messaging system for member-staff communication
 */
import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
  bigint,
  integer,
  primaryKey,
  check,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const messageStatusEnum = pgEnum('message_status', ['sent', 'delivered', 'read'])
export const messageTypeEnum = pgEnum('message_type', ['text', 'file', 'system'])

// Message threads table
export const messageThreads = pgTable('message_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  subject: text('subject').notNull(),
  memberId: text('member_id').notNull(), // Auth user ID
  staffId: text('staff_id'), // Auth user ID of assigned staff
  organizationId: uuid('organization_id').notNull(),
  status: text('status').notNull().default('open'), // open, resolved, closed
  priority: text('priority').default('normal'), // low, normal, high, urgent
  category: text('category'), // general, grievance, dues, benefits, etc.
  isArchived: boolean('is_archived').default(false),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// Explicit, expiring, revocable authority to triage the unassigned queue (platform 0014, RLS 0021).
export const triageDesignations = pgTable(
  'triage_designations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    scope: text('scope').notNull(), // messages, cases
    userId: text('user_id').notNull(),
    grantedBy: text('granted_by').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: text('revoked_by'),
  },
  (table) => [
    check('triage_scope_valid', sql`${table.scope} IN ('messages','cases')`),
    check('triage_no_self_grant', sql`${table.grantedBy} <> ${table.userId}`),
    check('triage_expiry_after_grant', sql`${table.expiresAt} > ${table.grantedAt}`),
    check(
      'triage_revocation_pair',
      sql`(${table.revokedAt} IS NULL) = (${table.revokedBy} IS NULL)`,
    ),
    uniqueIndex('triage_designations_live_uq')
      .on(table.organizationId, table.scope, table.userId)
      .where(sql`${table.revokedAt} IS NULL`),
  ],
)

// Append-only history of every assignment decision on a conversation (platform 0014, RLS 0021).
export const messageThreadAssignments = pgTable(
  'message_thread_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => messageThreads.id, { onDelete: 'restrict' }),
    action: text('action').notNull(), // assign, reassign, release
    fromStaffId: text('from_staff_id'),
    toStaffId: text('to_staff_id'),
    actedBy: text('acted_by').notNull(),
    actedVia: text('acted_via').notNull(), // triage_designation, current_assignee
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'message_assignment_action_valid',
      sql`${table.action} IN ('assign','reassign','release')`,
    ),
    check(
      'message_assignment_via_valid',
      sql`${table.actedVia} IN ('triage_designation','current_assignee')`,
    ),
    check(
      'message_assignment_target_shape',
      sql`(${table.action} = 'release') = (${table.toStaffId} IS NULL)`,
    ),
    check(
      'message_assignment_source_shape',
      sql`(${table.action} = 'assign') = (${table.fromStaffId} IS NULL)`,
    ),
    index('message_thread_assignments_thread_idx').on(
      table.organizationId,
      table.threadId,
      table.createdAt,
    ),
  ],
)

// Append-only history of every close, archive and legal-hold decision on a conversation (platform 0025, RLS 0024).
// It never holds message text; a hold carries only a reference to the matter or authority behind it.
export const messageThreadLifecycle = pgTable(
  'message_thread_lifecycle',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seq: bigint('seq', { mode: 'number' }).generatedAlwaysAsIdentity(),
    organizationId: uuid('organization_id').notNull(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => messageThreads.id, { onDelete: 'restrict' }),
    action: text('action').notNull(), // close, archive, hold_place, hold_release
    actedBy: text('acted_by').notNull(),
    actedVia: text('acted_via').notNull(), // thread_member, current_assignee, organization_administrator
    reference: text('reference'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'message_lifecycle_action_valid',
      sql`${table.action} IN ('close','archive','hold_place','hold_release')`,
    ),
    check(
      'message_lifecycle_via_valid',
      sql`${table.actedVia} IN ('thread_member','current_assignee','organization_administrator')`,
    ),
    check(
      'message_lifecycle_hold_by_administrator',
      sql`(${table.action} IN ('hold_place','hold_release')) = (${table.actedVia} = 'organization_administrator')`,
    ),
    check(
      'message_lifecycle_hold_reference',
      sql`(${table.action} IN ('hold_place','hold_release')) = (${table.reference} IS NOT NULL AND length(btrim(${table.reference})) > 0)`,
    ),
    index('message_thread_lifecycle_thread_idx').on(
      table.organizationId,
      table.threadId,
      table.seq,
    ),
  ],
)

// An organization's ADOPTED retention period for closed conversations (platform 0025, RLS 0024). No row: not adopted.
export const messageRetentionPolicies = pgTable(
  'message_retention_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    policyReference: text('policy_reference').notNull(),
    authorityReference: text('authority_reference').notNull(),
    retentionDays: integer('retention_days').notNull(),
    adoptedBy: text('adopted_by').notNull(),
    adoptedAt: timestamp('adopted_at', { withTimezone: true }).defaultNow().notNull(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    supersededBy: text('superseded_by'),
  },
  (table) => [
    check('message_retention_days_ck', sql`${table.retentionDays} BETWEEN 1 AND 36500`),
    check(
      'message_retention_reference_ck',
      sql`length(btrim(${table.policyReference})) > 0 AND length(btrim(${table.authorityReference})) > 0`,
    ),
    check(
      'message_retention_supersession_pair',
      sql`(${table.supersededAt} IS NULL) = (${table.supersededBy} IS NULL)`,
    ),
    uniqueIndex('message_retention_policies_live_uq')
      .on(table.organizationId)
      .where(sql`${table.supersededAt} IS NULL`),
  ],
)

// Last time each participant read a conversation (platform 0025, RLS 0024).
export const messageThreadReads = pgTable(
  'message_thread_reads',
  {
    threadId: uuid('thread_id')
      .notNull()
      .references(() => messageThreads.id, { onDelete: 'restrict' }),
    userId: text('user_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.threadId, table.userId] })],
)

// Individual messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => messageThreads.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull(), // Auth user ID
  senderRole: text('sender_role').notNull(), // member, staff, admin, system
  messageType: messageTypeEnum('message_type').notNull().default('text'),
  content: text('content'), // Message text content
  fileUrl: text('file_url'), // For file attachments
  fileName: text('file_name'),
  fileSize: text('file_size'),
  status: messageStatusEnum('status').notNull().default('sent'),
  readAt: timestamp('read_at'),
  isEdited: boolean('is_edited').default(false),
  editedAt: timestamp('edited_at'),
  metadata: text('metadata'), // JSON string for additional data
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// Message read receipts table
export const messageReadReceipts = pgTable('message_read_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), // Auth user ID
  readAt: timestamp('read_at').defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
