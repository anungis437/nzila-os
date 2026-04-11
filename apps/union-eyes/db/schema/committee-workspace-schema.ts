// =====================================================================================
// COMMITTEE WORKSPACE SCHEMA
// =====================================================================================
// Purpose: Meeting minutes repository, action items, document linkage, and
//          intelligence synthesis for internal and external/national committees
// Extends: union-structure-schema.ts (committees, committeeMemberships)
// =====================================================================================

import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  boolean,
  date,
  integer,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { committees } from './union-structure-schema';
import { profiles } from './domains/member/profiles';
import { organizations } from '../schema-organizations';

// =====================================================================================
// ENUMS
// =====================================================================================

export const committeeScopeEnum = pgEnum('committee_scope', [
  'internal',    // Internal subcommittee (e.g., OSH, Equity)
  'external',    // External consultation with outside stakeholders
  'national',    // National-level committee (UMCC, NLMCC)
  'joint',       // Joint union-management committee
]);

export const meetingStatusEnum = pgEnum('committee_meeting_status', [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'postponed',
]);

export const actionItemStatusEnum = pgEnum('committee_action_item_status', [
  'pending',
  'in_progress',
  'completed',
  'deferred',
  'cancelled',
]);

export const actionItemPriorityEnum = pgEnum('committee_action_item_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

// =====================================================================================
// TABLE: committee_meetings
// =====================================================================================

export const committeeMeetings = pgTable(
  'committee_meetings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    committeeId: uuid('committee_id')
      .notNull()
      .references(() => committees.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Meeting Details
    title: varchar('title', { length: 500 }).notNull(),
    meetingDate: timestamp('meeting_date', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    location: text('location'),
    virtualLink: text('virtual_link'),
    status: meetingStatusEnum('status').notNull().default('scheduled'),

    // Agenda
    agenda: text('agenda'),          // Pre-meeting agenda (markdown)
    agendaItems: jsonb('agenda_items').$type<Array<{
      order: number;
      title: string;
      presenter?: string;
      duration?: number; // minutes
      notes?: string;
    }>>(),

    // Minutes
    minutes: text('minutes'),        // Post-meeting minutes (markdown/rich text)
    minutesApprovedBy: text('minutes_approved_by').references(() => profiles.userId),
    minutesApprovedAt: timestamp('minutes_approved_at', { withTimezone: true }),

    // Attendance summary
    quorumMet: boolean('quorum_met'),
    attendeeCount: integer('attendee_count').default(0),

    // External participants (for external/national committees)
    externalAttendees: jsonb('external_attendees').$type<Array<{
      name: string;
      organization: string;
      role?: string;
      email?: string;
    }>>(),

    // Key decisions & outcomes
    decisions: jsonb('decisions').$type<Array<{
      description: string;
      movedBy?: string;
      secondedBy?: string;
      outcome: 'carried' | 'defeated' | 'tabled' | 'withdrawn';
      voteCount?: { for: number; against: number; abstained: number };
    }>>(),

    // Next meeting reference
    nextMeetingDate: timestamp('next_meeting_date', { withTimezone: true }),

    // Attachments
    attachmentIds: jsonb('attachment_ids').$type<string[]>(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
  },
  (table) => [
    index('idx_committee_meetings_committee').on(table.committeeId),
    index('idx_committee_meetings_organization').on(table.organizationId),
    index('idx_committee_meetings_date').on(table.meetingDate),
    index('idx_committee_meetings_status').on(table.status),
  ]
);

// =====================================================================================
// TABLE: committee_meeting_attendees
// =====================================================================================

export const committeeMeetingAttendees = pgTable(
  'committee_meeting_attendees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => committeeMeetings.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),

    // Attendance
    attended: boolean('attended').notNull().default(false),
    arrivedLate: boolean('arrived_late').default(false),
    leftEarly: boolean('left_early').default(false),
    proxy: text('proxy'),                // Name of proxy if someone attended on behalf
    regrets: boolean('regrets').default(false),  // Sent regrets

    notes: text('notes'),
  },
  (table) => [
    index('idx_meeting_attendees_meeting').on(table.meetingId),
    index('idx_meeting_attendees_member').on(table.memberId),
  ]
);

// =====================================================================================
// TABLE: committee_action_items
// =====================================================================================

export const committeeActionItems = pgTable(
  'committee_action_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    committeeId: uuid('committee_id')
      .notNull()
      .references(() => committees.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id')
      .references(() => committeeMeetings.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Item details
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    status: actionItemStatusEnum('status').notNull().default('pending'),
    priority: actionItemPriorityEnum('priority').notNull().default('medium'),

    // Assignment
    assignedTo: text('assigned_to').references(() => profiles.userId),
    dueDate: date('due_date'),

    // Resolution
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: text('completed_by').references(() => profiles.userId),
    resolution: text('resolution'),

    // Carry-forward tracking
    carriedFromMeetingId: uuid('carried_from_meeting_id')
      .references(() => committeeMeetings.id, { onDelete: 'set null' }),
    carryCount: integer('carry_count').default(0), // How many times this item was carried forward

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
  },
  (table) => [
    index('idx_committee_action_items_committee').on(table.committeeId),
    index('idx_committee_action_items_meeting').on(table.meetingId),
    index('idx_committee_action_items_status').on(table.status),
    index('idx_committee_action_items_assigned').on(table.assignedTo),
    index('idx_committee_action_items_due').on(table.dueDate),
    index('idx_committee_action_items_org').on(table.organizationId),
  ]
);

// =====================================================================================
// TABLE: committee_documents
// =====================================================================================

export const committeeDocuments = pgTable(
  'committee_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    committeeId: uuid('committee_id')
      .notNull()
      .references(() => committees.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Document reference
    documentId: uuid('document_id'),  // References documents table (optional via migration FK)
    meetingId: uuid('meeting_id')
      .references(() => committeeMeetings.id, { onDelete: 'set null' }),

    // For standalone files not in documents table
    title: varchar('title', { length: 500 }).notNull(),
    fileUrl: text('file_url'),
    fileType: text('file_type'),
    fileSize: integer('file_size'),

    // Classification
    category: varchar('category', { length: 100 }),  // 'minutes', 'agenda', 'report', 'policy', 'reference'

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    uploadedBy: text('uploaded_by').references(() => profiles.userId),
  },
  (table) => [
    index('idx_committee_documents_committee').on(table.committeeId),
    index('idx_committee_documents_meeting').on(table.meetingId),
    index('idx_committee_documents_category').on(table.category),
    index('idx_committee_documents_org').on(table.organizationId),
  ]
);

// =====================================================================================
// TABLE: committee_intelligence_snapshots
// =====================================================================================
// AI-generated synthesis across committee activities for unified voice

export const committeeIntelligenceSnapshots = pgTable(
  'committee_intelligence_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Scope: for a specific committee or cross-committee
    committeeId: uuid('committee_id')
      .references(() => committees.id, { onDelete: 'cascade' }),

    // Intelligence content
    title: varchar('title', { length: 500 }).notNull(),
    summary: text('summary').notNull(),              // AI-generated synthesis
    keyThemes: jsonb('key_themes').$type<string[]>(), // Major themes extracted
    positions: jsonb('positions').$type<Array<{
      topic: string;
      position: string;
      source: string;      // Committee name or UMCC/NLMCC
      meetingDate?: string;
    }>>(),
    recommendations: jsonb('recommendations').$type<string[]>(),

    // Sources
    sourceMeetingIds: jsonb('source_meeting_ids').$type<string[]>(),
    sourceCommitteeIds: jsonb('source_committee_ids').$type<string[]>(),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),

    // Metadata
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
    generatedBy: text('generated_by').references(() => profiles.userId),
    model: varchar('model', { length: 100 }),  // AI model used
  },
  (table) => [
    index('idx_committee_intel_org').on(table.organizationId),
    index('idx_committee_intel_committee').on(table.committeeId),
    index('idx_committee_intel_period').on(table.periodStart, table.periodEnd),
  ]
);

// =====================================================================================
// RELATIONS
// =====================================================================================

export const committeeMeetingsRelations = relations(committeeMeetings, ({ one, many }) => ({
  committee: one(committees, {
    fields: [committeeMeetings.committeeId],
    references: [committees.id],
  }),
  organization: one(organizations, {
    fields: [committeeMeetings.organizationId],
    references: [organizations.id],
  }),
  minutesApprover: one(profiles, {
    fields: [committeeMeetings.minutesApprovedBy],
    references: [profiles.userId],
    relationName: 'minutesApprover',
  }),
  attendees: many(committeeMeetingAttendees),
  actionItems: many(committeeActionItems),
  documents: many(committeeDocuments),
}));

export const committeeMeetingAttendeesRelations = relations(committeeMeetingAttendees, ({ one }) => ({
  meeting: one(committeeMeetings, {
    fields: [committeeMeetingAttendees.meetingId],
    references: [committeeMeetings.id],
  }),
  member: one(profiles, {
    fields: [committeeMeetingAttendees.memberId],
    references: [profiles.userId],
  }),
}));

export const committeeActionItemsRelations = relations(committeeActionItems, ({ one }) => ({
  committee: one(committees, {
    fields: [committeeActionItems.committeeId],
    references: [committees.id],
  }),
  meeting: one(committeeMeetings, {
    fields: [committeeActionItems.meetingId],
    references: [committeeMeetings.id],
  }),
  organization: one(organizations, {
    fields: [committeeActionItems.organizationId],
    references: [organizations.id],
  }),
  assignedToProfile: one(profiles, {
    fields: [committeeActionItems.assignedTo],
    references: [profiles.userId],
    relationName: 'actionItemAssignee',
  }),
}));

export const committeeDocumentsRelations = relations(committeeDocuments, ({ one }) => ({
  committee: one(committees, {
    fields: [committeeDocuments.committeeId],
    references: [committees.id],
  }),
  meeting: one(committeeMeetings, {
    fields: [committeeDocuments.meetingId],
    references: [committeeMeetings.id],
  }),
  organization: one(organizations, {
    fields: [committeeDocuments.organizationId],
    references: [organizations.id],
  }),
  uploader: one(profiles, {
    fields: [committeeDocuments.uploadedBy],
    references: [profiles.userId],
  }),
}));

export const committeeIntelligenceSnapshotsRelations = relations(committeeIntelligenceSnapshots, ({ one }) => ({
  committee: one(committees, {
    fields: [committeeIntelligenceSnapshots.committeeId],
    references: [committees.id],
  }),
  organization: one(organizations, {
    fields: [committeeIntelligenceSnapshots.organizationId],
    references: [organizations.id],
  }),
}));

// =====================================================================================
// TYPE EXPORTS
// =====================================================================================

export type CommitteeMeeting = typeof committeeMeetings.$inferSelect;
export type NewCommitteeMeeting = typeof committeeMeetings.$inferInsert;

export type CommitteeMeetingAttendee = typeof committeeMeetingAttendees.$inferSelect;
export type NewCommitteeMeetingAttendee = typeof committeeMeetingAttendees.$inferInsert;

export type CommitteeActionItem = typeof committeeActionItems.$inferSelect;
export type NewCommitteeActionItem = typeof committeeActionItems.$inferInsert;

export type CommitteeDocument = typeof committeeDocuments.$inferSelect;
export type NewCommitteeDocument = typeof committeeDocuments.$inferInsert;

export type CommitteeIntelligenceSnapshot = typeof committeeIntelligenceSnapshots.$inferSelect;
export type NewCommitteeIntelligenceSnapshot = typeof committeeIntelligenceSnapshots.$inferInsert;
