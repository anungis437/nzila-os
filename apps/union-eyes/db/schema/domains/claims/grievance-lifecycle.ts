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
  varchar,
  text,
  timestamp,
  index,
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

export const grievanceDocumentTypeEnum = pgEnum("grievance_document_type", [
  "intake_form",
  "evidence",
  "witness_statement",
  "employer_response",
  "union_brief",
  "arbitration_submission",
  "settlement_agreement",
  "correspondence",
  "photo",
  "other",
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
 * Documents attached to a grievance case.
 * Supports categorized file storage for evidence, briefs, etc.
 */
export const grievanceDocuments = pgTable(
  "grievance_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grievanceId: uuid("grievance_id")
      .notNull()
      .references(() => grievances.id, { onDelete: "cascade" }),
    fileUrl: varchar("file_url", { length: 2048 }).notNull(),
    documentType: grievanceDocumentTypeEnum("document_type").notNull(),
    uploadedBy: uuid("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_grievance_documents_grievance").on(table.grievanceId),
    index("idx_grievance_documents_type").on(table.documentType),
    index("idx_grievance_documents_uploader").on(table.uploadedBy),
  ],
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type GrievanceLifecycleStatus =
  (typeof grievanceLifecycleStatusEnum.enumValues)[number];
export type GrievanceEventType =
  (typeof grievanceEventTypeEnum.enumValues)[number];
export type GrievanceDocumentType =
  (typeof grievanceDocumentTypeEnum.enumValues)[number];

export type GrievanceEvent = typeof grievanceEvents.$inferSelect;
export type GrievanceEventInsert = typeof grievanceEvents.$inferInsert;
export type GrievanceDocument = typeof grievanceDocuments.$inferSelect;
export type GrievanceDocumentInsert = typeof grievanceDocuments.$inferInsert;
