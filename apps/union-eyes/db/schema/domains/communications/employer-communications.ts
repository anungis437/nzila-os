/**
 * Employer Communication Schema
 *
 * Tables for employer contacts, communications log, and message templates.
 * Supports structured employer outreach with grievance linkage.
 *
 * @module db/schema/domains/communications/employer-communications
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { grievances } from "../claims/grievances";

// ─── Enums ────────────────────────────────────────────────────

export const contactRoleEnum = pgEnum("employer_contact_role", [
  "main",
  "hr",
  "labour_relations",
  "legal",
  "supervisor",
  "other",
]);

export const communicationTypeEnum = pgEnum("employer_communication_type", [
  "email",
  "phone",
  "meeting",
  "letter",
  "other",
]);

export const communicationStatusEnum = pgEnum("employer_communication_status", [
  "draft",
  "sent",
  "received",
  "acknowledged",
]);

export const templateCategoryEnum = pgEnum("communication_template_category", [
  "initial_notification",
  "request_response",
  "request_documentation",
  "meeting_request",
  "resolution_proposal",
  "escalation_notice",
  "general",
]);

// ─── Employer Contacts ────────────────────────────────────────

export const employerContacts = pgTable(
  "employer_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    employerId: uuid("employer_id").notNull(),

    // Contact info
    name: varchar("name", { length: 255 }).notNull(),
    role: contactRoleEnum("role").notNull().default("main"),
    title: varchar("title", { length: 255 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 30 }),
    preferredMethod: communicationTypeEnum("preferred_method").default("email"),

    // Flags
    isPrimary: boolean("is_primary").default(false),
    isActive: boolean("is_active").default(true),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("idx_employer_contacts_org").on(table.organizationId),
    index("idx_employer_contacts_employer").on(table.employerId),
    index("idx_employer_contacts_role").on(table.role),
    uniqueIndex("employer_contacts_one_primary_per_employer_idx")
      .on(table.organizationId, table.employerId)
      .where(sql`${table.isPrimary} IS TRUE AND ${table.isActive} IS NOT FALSE`),
  ]
);

// ─── Employer Communications ──────────────────────────────────

export const employerCommunications = pgTable(
  "employer_communications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    employerId: uuid("employer_id").notNull(),
    grievanceId: uuid("grievance_id").references(() => grievances.id),

    // Communication details
    type: communicationTypeEnum("type").notNull(),
    status: communicationStatusEnum("status").notNull().default("draft"),
    subject: varchar("subject", { length: 500 }).notNull(),
    body: text("body").notNull(),
    summary: text("summary"),

    // Parties
    senderName: varchar("sender_name", { length: 255 }).notNull(),
    senderUserId: text("sender_user_id"),
    recipientName: varchar("recipient_name", { length: 255 }).notNull(),
    recipientContactId: uuid("recipient_contact_id").references(
      () => employerContacts.id
    ),

    // Dates
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),

    // Attachments
    attachments: jsonb("attachments").$type<
      Array<{
        id: string;
        name: string;
        url: string;
        type: string;
      }>
    >(),

    // Template reference
    templateId: uuid("template_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("idx_employer_comms_org").on(table.organizationId),
    index("idx_employer_comms_employer").on(table.employerId),
    index("idx_employer_comms_grievance").on(table.grievanceId),
    index("idx_employer_comms_status").on(table.status),
    index("idx_employer_comms_type").on(table.type),
  ]
);

// ─── Communication Templates ──────────────────────────────────

// ─── Type Exports ─────────────────────────────────────────────

export type EmployerContact = typeof employerContacts.$inferSelect;
export type EmployerContactInsert = typeof employerContacts.$inferInsert;
export type EmployerCommunication = typeof employerCommunications.$inferSelect;
export type EmployerCommunicationInsert = typeof employerCommunications.$inferInsert;
