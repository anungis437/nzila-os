/**
 * Organizer Workflows Schema
 * 
 * Phase 4: Communications & Organizing - Organizer Tools
 * 
 * Features:
 * - Steward assignments (primary/backup steward → member relationships)
 * - Member outreach sequences (automated follow-up campaigns)
 * - Field notes & relationship tracking (minimal CRM)
 * - Organizer tasks & follow-ups
 * 
 * This complements organizing-tools-schema.ts (which handles union certification campaigns)
 * by providing day-to-day organizer workflow support.
 * 
 * Version: 1.0.0
 * Created: February 13, 2026
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const outreachSequenceStatusEnum = pgEnum('outreach_sequence_status', [
  'active',
  'paused',
  'completed',
  'cancelled',
]);

export const outreachStepStatusEnum = pgEnum('outreach_step_status', [
  'pending',
  'scheduled',
  'sent',
  'delivered',
  'completed',
  'skipped',
  'failed',
]);

export const fieldNoteTypeEnum = pgEnum('field_note_type', [
  'contact',      // General contact/conversation
  'grievance',    // Grievance-related discussion
  'organizing',   // Organizing activity
  'meeting',      // Meeting notes
  'personal',     // Personal issue (health, family)
  'workplace',    // Workplace issue
  'follow_up',    // Follow-up from previous note
]);

export const sentimentEnum = pgEnum('sentiment', [
  'positive',
  'neutral',
  'negative',
  'concerned',
  'engaged',
  'disengaged',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'blocked',
]);

// ============================================================================
// STEWARD ASSIGNMENTS
// ============================================================================
//
// The physical `steward_assignments` table is canonically declared in
// ../../union-structure-schema.ts (steward-to-coverage-area assignment,
// with tenure/training/certification tracking and an optional grievance
// link). This module previously declared a second, conflicting
// `pgTable('steward_assignments', ...)` for a different, narrower concept
// (steward-to-individual-member assignment). PR #752 review confirmed
// zero production consumers ever imported that declaration (or its
// stewardAssignmentTypeEnum/stewardAssignmentsRelations) directly from
// this module or from the domains/communications barrel - every real
// caller already used the canonical declaration via @/db/schema or
// @/db/schema/union-structure-schema. Removed rather than re-exported: a
// re-export would misrepresent this file as still owning a
// steward-to-member assignment concept it never actually persisted.
// See scripts/__tests__/schema-duplicate-table-ratchet.test.ts and
// docs/union-eyes/reality-remediation/27_RLS_STORAGE_SCHEMA_CANONICALIZATION.md
// (Round 4) for the full investigation.

// ============================================================================
// OUTREACH SEQUENCES
// ============================================================================

/**
 * Outreach Sequences
 * Automated multi-step outreach campaigns (e.g., new member onboarding)
 */
export const outreachSequences = pgTable('outreach_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Sequence details
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Trigger configuration
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // manual, new_member, case_opened, grievance_filed, etc.
  triggerConditions: jsonb('trigger_conditions').default({}), // JSON query for auto-triggering
  
  // Steps definition
  steps: jsonb('steps').notNull(), // [{step: 1, delayDays: 0, action: 'send_email', templateId: 'xxx', ...}]
  
  // Status
  status: outreachSequenceStatusEnum('status').notNull().default('active'),
  isActive: boolean('is_active').default(true),
  
  // Statistics
  stats: jsonb('stats').default({
    enrolled: 0,
    completed: 0,
    active: 0,
    cancelled: 0,
  }),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  tags: text('tags').array(),
  
  // Audit
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_outreach_sequences_org').on(table.organizationId),
  statusIdx: index('idx_outreach_sequences_status').on(table.status),
  isActiveIdx: index('idx_outreach_sequences_active').on(table.isActive),
  triggerTypeIdx: index('idx_outreach_sequences_trigger').on(table.triggerType),
}));

/**
 * Outreach Enrollments
 * Individual members enrolled in outreach sequences
 */
export const outreachEnrollments = pgTable('outreach_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  sequenceId: uuid('sequence_id')
    .notNull()
    .references(() => outreachSequences.id, { onDelete: 'cascade' }),
  
  // Enrollment details
  memberId: varchar('member_id', { length: 255 }).notNull(), // User ID of member
  enrolledBy: varchar('enrolled_by', { length: 255 }), // User ID of person who enrolled them (or 'system')
  
  // Progress
  currentStep: integer('current_step').default(1),
  totalSteps: integer('total_steps').notNull(),
  completedSteps: integer('completed_steps').default(0),
  
  // Status
  status: outreachSequenceStatusEnum('status').notNull().default('active'),
  
  // Timestamps
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  
  // Next action
  nextStepAt: timestamp('next_step_at', { withTimezone: true }), // When to send next message
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_outreach_enrollments_org').on(table.organizationId),
  sequenceIdx: index('idx_outreach_enrollments_sequence').on(table.sequenceId),
  memberIdx: index('idx_outreach_enrollments_member').on(table.memberId),
  statusIdx: index('idx_outreach_enrollments_status').on(table.status),
  nextStepIdx: index('idx_outreach_enrollments_next_step').on(table.nextStepAt),
}));

/**
 * Outreach Steps Log
 * Execution log for each step in an outreach sequence
 */
export const outreachStepsLog = pgTable('outreach_steps_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  enrollmentId: uuid('enrollment_id')
    .notNull()
    .references(() => outreachEnrollments.id, { onDelete: 'cascade' }),
  
  // Step details
  stepNumber: integer('step_number').notNull(),
  actionType: varchar('action_type', { length: 50 }).notNull(), // send_email, send_sms, create_task, etc.
  
  // Execution
  status: outreachStepStatusEnum('status').notNull().default('pending'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  
  // Results
  messageLogId: uuid('message_log_id'), // Reference to message_log if sent
  taskId: uuid('task_id'), // Reference to organizer_tasks if task created
  
  // Error tracking
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_outreach_steps_log_org').on(table.organizationId),
  enrollmentIdx: index('idx_outreach_steps_log_enrollment').on(table.enrollmentId),
  statusIdx: index('idx_outreach_steps_log_status').on(table.status),
  scheduledAtIdx: index('idx_outreach_steps_log_scheduled').on(table.scheduledAt),
}));

// ============================================================================
// FIELD NOTES (ORGANIZER CRM)
// ============================================================================

/**
 * Field Notes
 * Organizer notes about member interactions and relationships
 */
export const fieldNotes = pgTable('field_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Subject
  memberId: varchar('member_id', { length: 255 }).notNull(), // User ID of member
  authorId: varchar('author_id', { length: 255 }).notNull(), // User ID of note author (organizer)
  
  // Note details
  noteType: fieldNoteTypeEnum('note_type').notNull(),
  subject: varchar('subject', { length: 255 }),
  content: text('content').notNull(),
  
  // Sentiment & engagement
  sentiment: sentimentEnum('sentiment'),
  engagementLevel: integer('engagement_level'), // 1-5 scale
  
  // Follow-up
  followUpDate: date('follow_up_date'),
  followUpCompleted: boolean('follow_up_completed').default(false),
  followUpCompletedAt: timestamp('follow_up_completed_at', { withTimezone: true }),
  
  // Context
  relatedCaseId: uuid('related_case_id'), // Optional reference to grievance/case
  relatedGrievanceId: uuid('related_grievance_id'),
  interactionDate: date('interaction_date'), // When the interaction occurred (vs when note was created)
  
  // Tags & categories
  tags: text('tags').array(),
  isPrivate: boolean('is_private').default(false), // Visible only to author and admins
  isConfidential: boolean('is_confidential').default(false), // Restricted access
  
  // Metadata
  metadata: jsonb('metadata').default({}), // Location, context, etc.
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_field_notes_org').on(table.organizationId),
  memberIdx: index('idx_field_notes_member').on(table.memberId),
  authorIdx: index('idx_field_notes_author').on(table.authorId),
  noteTypeIdx: index('idx_field_notes_type').on(table.noteType),
  sentimentIdx: index('idx_field_notes_sentiment').on(table.sentiment),
  followUpIdx: index('idx_field_notes_follow_up').on(table.followUpDate),
  interactionDateIdx: index('idx_field_notes_interaction_date').on(table.interactionDate),
}));

// ============================================================================
// ORGANIZER TASKS
// ============================================================================

/**
 * Organizer Tasks
 * Task management for stewards and organizers
 */
export const organizerTasks = pgTable('organizer_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Task details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  
  // Assignment
  assignedTo: varchar('assigned_to', { length: 255 }).notNull(), // User ID of assigned organizer
  assignedBy: varchar('assigned_by', { length: 255 }), // User ID of person who assigned task
  
  // Context
  memberId: varchar('member_id', { length: 255 }), // Optional member reference
  relatedCaseId: uuid('related_case_id'), // Optional case reference
  relatedGrievanceId: uuid('related_grievance_id'), // Optional grievance reference
  
  // Priority & status
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  status: taskStatusEnum('status').notNull().default('pending'),
  
  // Scheduling
  dueDate: date('due_date'),
  estimatedMinutes: integer('estimated_minutes'), // Estimated time to complete
  actualMinutes: integer('actual_minutes'), // Time actually spent
  
  // Completion
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completionNotes: text('completion_notes'),
  
  // Blocking
  blockedReason: text('blocked_reason'),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  tags: text('tags').array(),
  
  // Audit
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_organizer_tasks_org').on(table.organizationId),
  assignedToIdx: index('idx_organizer_tasks_assigned').on(table.assignedTo),
  memberIdx: index('idx_organizer_tasks_member').on(table.memberId),
  statusIdx: index('idx_organizer_tasks_status').on(table.status),
  priorityIdx: index('idx_organizer_tasks_priority').on(table.priority),
  dueDateIdx: index('idx_organizer_tasks_due_date').on(table.dueDate),
}));

/**
 * Task Comments
 * Comments and updates on organizer tasks
 */
export const taskComments = pgTable('task_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  taskId: uuid('task_id')
    .notNull()
    .references(() => organizerTasks.id, { onDelete: 'cascade' }),
  
  // Comment details
  authorId: varchar('author_id', { length: 255 }).notNull(), // User ID of commenter
  content: text('content').notNull(),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_task_comments_org').on(table.organizationId),
  taskIdx: index('idx_task_comments_task').on(table.taskId),
  authorIdx: index('idx_task_comments_author').on(table.authorId),
}));

// ============================================================================
// MEMBER RELATIONSHIP SCORES
// ============================================================================

/**
 * Member Relationship Scores
 * Calculated scores for member engagement and relationship strength
 * Updated async based on field notes, task completion, interaction frequency
 */
export const memberRelationshipScores = pgTable('member_relationship_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  
  memberId: varchar('member_id', { length: 255 }).notNull().unique(),
  
  // Scores (0-100)
  overallScore: integer('overall_score').default(50),
  engagementScore: integer('engagement_score').default(50),
  relationshipScore: integer('relationship_score').default(50),
  activityScore: integer('activity_score').default(50),
  
  // Metrics
  lastContactDate: date('last_contact_date'),
  totalInteractions: integer('total_interactions').default(0),
  interactionsLast30Days: integer('interactions_last_30_days').default(0),
  fieldNotesCount: integer('field_notes_count').default(0),
  positiveNotesCount: integer('positive_notes_count').default(0),
  negativeNotesCount: integer('negative_notes_count').default(0),
  
  // Sentiment
  averageSentiment: varchar('average_sentiment', { length: 50 }),
  currentSentiment: sentimentEnum('current_sentiment'),
  
  // Risk indicators
  isAtRisk: boolean('is_at_risk').default(false), // Low engagement, negative sentiment
  atRiskReason: text('at_risk_reason'),
  
  // Calculated timestamp
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow().notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_member_relationship_scores_org').on(table.organizationId),
  memberIdx: index('idx_member_relationship_scores_member').on(table.memberId),
  overallScoreIdx: index('idx_member_relationship_scores_overall').on(table.overallScore),
  isAtRiskIdx: index('idx_member_relationship_scores_at_risk').on(table.isAtRisk),
  lastContactIdx: index('idx_member_relationship_scores_last_contact').on(table.lastContactDate),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const outreachSequencesRelations = relations(outreachSequences, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [outreachSequences.organizationId],
    references: [organizations.id],
  }),
  enrollments: many(outreachEnrollments),
}));

export const outreachEnrollmentsRelations = relations(outreachEnrollments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [outreachEnrollments.organizationId],
    references: [organizations.id],
  }),
  sequence: one(outreachSequences, {
    fields: [outreachEnrollments.sequenceId],
    references: [outreachSequences.id],
  }),
  stepsLog: many(outreachStepsLog),
}));

export const outreachStepsLogRelations = relations(outreachStepsLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [outreachStepsLog.organizationId],
    references: [organizations.id],
  }),
  enrollment: one(outreachEnrollments, {
    fields: [outreachStepsLog.enrollmentId],
    references: [outreachEnrollments.id],
  }),
}));

export const fieldNotesRelations = relations(fieldNotes, ({ one }) => ({
  organization: one(organizations, {
    fields: [fieldNotes.organizationId],
    references: [organizations.id],
  }),
}));

export const organizerTasksRelations = relations(organizerTasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizerTasks.organizationId],
    references: [organizations.id],
  }),
  comments: many(taskComments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  organization: one(organizations, {
    fields: [taskComments.organizationId],
    references: [organizations.id],
  }),
  task: one(organizerTasks, {
    fields: [taskComments.taskId],
    references: [organizerTasks.id],
  }),
}));

export const memberRelationshipScoresRelations = relations(memberRelationshipScores, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberRelationshipScores.organizationId],
    references: [organizations.id],
  }),
}));

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type OutreachSequence = typeof outreachSequences.$inferSelect;
export type InsertOutreachSequence = typeof outreachSequences.$inferInsert;

export type OutreachEnrollment = typeof outreachEnrollments.$inferSelect;
export type InsertOutreachEnrollment = typeof outreachEnrollments.$inferInsert;

export type OutreachStepLog = typeof outreachStepsLog.$inferSelect;
export type InsertOutreachStepLog = typeof outreachStepsLog.$inferInsert;

export type FieldNote = typeof fieldNotes.$inferSelect;
export type InsertFieldNote = typeof fieldNotes.$inferInsert;

export type OrganizerTask = typeof organizerTasks.$inferSelect;
export type InsertOrganizerTask = typeof organizerTasks.$inferInsert;

export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskComment = typeof taskComments.$inferInsert;

export type MemberRelationshipScore = typeof memberRelationshipScores.$inferSelect;
export type InsertMemberRelationshipScore = typeof memberRelationshipScores.$inferInsert;
