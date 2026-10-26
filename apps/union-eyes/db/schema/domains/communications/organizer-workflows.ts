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

// ============================================================================
// RELATIONS
// ============================================================================

export const organizerTasksRelations = relations(organizerTasks, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizerTasks.organizationId],
    references: [organizations.id],
  }),
}));

// ============================================================================
// INFERRED TYPES
// ============================================================================





export type OrganizerTask = typeof organizerTasks.$inferSelect;
export type InsertOrganizerTask = typeof organizerTasks.$inferInsert;
