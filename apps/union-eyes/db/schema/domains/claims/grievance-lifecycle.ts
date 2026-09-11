/**
 * Grievance Lifecycle Extensions
 *
 * Adds event-sourced audit trail and document management
 * to the existing grievance tables. Supports the full
 * intake → triage → investigation → arbitration → resolution pipeline.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { grievances } from "./grievances";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const grievanceLifecycleStatusEnum = pgEnum(
  "grievance_lifecycle_status",
  [
    "new",
    "triage",
    "investigation",
    "negotiation",
    "arbitration",
    "resolved",
    "closed",
  ],
);

export const grievanceEventTypeEnum = pgEnum("grievance_event_type", [
  "created",
  "status_changed",
  "assigned",
  "reassigned",
  "note_added",
  "document_uploaded",
  "escalated",
  "deadline_set",
  "deadline_extended",
  "meeting_scheduled",
  "response_received",
  "closed",
  "converted_to_case",
  "priority_overridden",
  "intake_submitted",
]);

export const caseAccessRoleEnum = pgEnum("case_access_role", [
  "secondary_lro",
  "reviewer",
  "read_only",
]);

export const caseAccessStatusEnum = pgEnum("case_access_status", [
  "active",
  "revoked",
  "expired",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

/**
 * Immutable event log for every action taken on a grievance.
 * Provides a full audit trail for case review and compliance.
 */
export const grievanceEvents = pgTable(
  "grievance_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grievanceId: uuid("grievance_id")
      .notNull()
      .references(() => grievances.id, { onDelete: "cascade" }),
    eventType: grievanceEventTypeEnum("event_type").notNull(),
    actorUserId: uuid("actor_user_id").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_grievance_events_grievance").on(table.grievanceId),
    index("idx_grievance_events_type").on(table.eventType),
    index("idx_grievance_events_actor").on(table.actorUserId),
    index("idx_grievance_events_created").on(table.createdAt),
  ],
);

/**
 * Secondary case access assignments.
 * Primary LRO ownership remains on grievances.unionRepId and is never replaced by this table.
 */
export const grievanceCaseAccessAssignments = pgTable(
  "grievance_case_access_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    grievanceId: uuid("grievance_id")
      .notNull()
      .references(() => grievances.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    accessRole: caseAccessRoleEnum("access_role").notNull().default("secondary_lro"),
    grantedBy: uuid("granted_by").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    canComment: boolean("can_comment").notNull().default(true),
    canUploadDocuments: boolean("can_upload_documents").notNull().default(false),
    canEditCaseNotes: boolean("can_edit_case_notes").notNull().default(false),
    canDraftActions: boolean("can_draft_actions").notNull().default(false),
    canViewPrivateDocuments: boolean("can_view_private_documents").notNull().default(false),
    status: caseAccessStatusEnum("status").notNull().default("active"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_case_access_grievance").on(table.grievanceId),
    index("idx_case_access_user").on(table.userId),
    index("idx_case_access_org").on(table.organizationId),
    index("idx_case_access_status").on(table.status),
    index("idx_case_access_expires").on(table.expiresAt),
  ],
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type GrievanceLifecycleStatus =
  (typeof grievanceLifecycleStatusEnum.enumValues)[number];
export type GrievanceEventType =
  (typeof grievanceEventTypeEnum.enumValues)[number];
export type CaseAccessRole = (typeof caseAccessRoleEnum.enumValues)[number];
export type CaseAccessStatus = (typeof caseAccessStatusEnum.enumValues)[number];

export type GrievanceEvent = typeof grievanceEvents.$inferSelect;
export type GrievanceEventInsert = typeof grievanceEvents.$inferInsert;
export type GrievanceCaseAccessAssignment =
  typeof grievanceCaseAccessAssignments.$inferSelect;
export type GrievanceCaseAccessAssignmentInsert =
  typeof grievanceCaseAccessAssignments.$inferInsert;
