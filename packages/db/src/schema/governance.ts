/**
 * Nzila OS — Minute book governance tables
 *
 * Meetings, resolutions, approvals, votes — all entity-scoped.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  numeric,
  pgEnum,
  date,
} from 'drizzle-orm/pg-core'
import { entities, people } from './entities'

// ── Enums ───────────────────────────────────────────────────────────────────

export const meetingKindEnum = pgEnum('meeting_kind', [
  'board',
  'shareholder',
  'committee',
])

export const meetingStatusEnum = pgEnum('meeting_status', [
  'scheduled',
  'held',
  'archived',
])

export const resolutionKindEnum = pgEnum('resolution_kind', [
  'board',
  'shareholder',
  'special',
])

export const resolutionStatusEnum = pgEnum('resolution_status', [
  'draft',
  'pending_approval',
  'approved',
  'pending_signature',
  'signed',
  'archived',
])

export const approvalTypeEnum = pgEnum('approval_type', [
  'board',
  'shareholder',
])

export const approvalSubjectTypeEnum = pgEnum('approval_subject_type', [
  'resolution',
  'governance_action',
])

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
])

export const voteChoiceEnum = pgEnum('vote_choice', [
  'yes',
  'no',
  'abstain',
])

// ── 5) meetings ─────────────────────────────────────────────────────────────

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  kind: meetingKindEnum('kind').notNull(),
  meetingDate: timestamp('meeting_date', { withTimezone: true }).notNull(),
  location: text('location'),
  minutesDocumentId: uuid('minutes_document_id'), // FK to documents
  status: meetingStatusEnum('status').notNull().default('scheduled'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 6) resolutions ──────────────────────────────────────────────────────────

export const resolutions = pgTable('resolutions', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  kind: resolutionKindEnum('kind').notNull(),
  title: text('title').notNull(),
  bodyMarkdown: text('body_markdown'),
  status: resolutionStatusEnum('status').notNull().default('draft'),
  meetingId: uuid('meeting_id').references(() => meetings.id),
  effectiveDate: date('effective_date'),
  requiresSpecialResolution: boolean('requires_special_resolution').notNull().default(false),
  requiredApprovalThreshold: numeric('required_approval_threshold'), // e.g. 0.75
  artifactDocumentId: uuid('artifact_document_id'), // FK to documents
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 7) approvals ────────────────────────────────────────────────────────────

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  subjectType: approvalSubjectTypeEnum('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  approvalType: approvalTypeEnum('approval_type').notNull(),
  threshold: numeric('threshold'), // e.g. 0.50, 0.75
  status: approvalStatusEnum('status').notNull().default('pending'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 8) votes ────────────────────────────────────────────────────────────────

export const votes = pgTable('votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  approvalId: uuid('approval_id')
    .notNull()
    .references(() => approvals.id),
  voterPersonId: uuid('voter_person_id')
    .notNull()
    .references(() => people.id),
  weight: numeric('weight').default('1'),
  choice: voteChoiceEnum('choice').notNull(),
  castAt: timestamp('cast_at', { withTimezone: true }).notNull().defaultNow(),
})
