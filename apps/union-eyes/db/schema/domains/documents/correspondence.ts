/**
 * Correspondence Pipeline Schema
 *
 * End-to-end workflow for drafting, reviewing, signing, and dispatching
 * letters and formal communications without leaving the platform.
 *
 * Workflow: draft → pending_review → approved → signed → dispatched → delivered
 *
 * Key roles:
 *  - Clerk: drafts, manages, dispatches (cannot sign)
 *  - Officer / Representative: reviews and signs
 *  - Executives (President, VP, Sec-Treasurer): sign and dispatch
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../../../schema-organizations";
import { profiles } from "../../profiles-schema";

// ============================================================================
// ENUMS
// ============================================================================

export const correspondenceStatusEnum = pgEnum("correspondence_status", [
  "draft",
  "pending_review",
  "approved",
  "signed",
  "dispatched",
  "delivered",
  "returned",
  "cancelled",
]);

export const correspondenceTypeEnum = pgEnum("correspondence_type", [
  "letter",
  "notice",
  "memo",
  "demand",
  "response",
  "proposal",
  "agreement",
  "report",
  "other",
]);

export const correspondencePriorityEnum = pgEnum("correspondence_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const signatureSourceEnum = pgEnum("signature_source", [
  "drawn",      // User drew their signature on a canvas
  "uploaded",   // User uploaded a signature image
  "typed",      // System-generated from user's name in a signature font
]);

export const correspondenceAuditEventEnum = pgEnum("correspondence_audit_event", [
  "created",
  "edited",
  "submitted_for_review",
  "review_requested",
  "approved",
  "revision_requested",
  "signed",
  "signature_affixed",
  "dispatched",
  "delivered",
  "returned",
  "cancelled",
  "recipient_added",
  "recipient_removed",
  "attachment_added",
  "attachment_removed",
  "template_applied",
  "reassigned",
  "viewed",
]);

// ============================================================================
// USER SIGNATURE PROFILES
// ============================================================================

/**
 * Stored signatures — each user can save a signature image once and reuse it
 * across all correspondence without leaving the platform.
 */
export const userSignatures = pgTable(
  "user_signatures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId),
    /** Display name shown beneath the signature line */
    displayName: varchar("display_name", { length: 255 }).notNull(),
    /** Title / role shown beneath the name (e.g. "Chief Steward, Local 123") */
    displayTitle: varchar("display_title", { length: 255 }),
    /** How the signature was created */
    source: signatureSourceEnum("source").notNull().default("drawn"),
    /** URL to the stored signature image (PNG, transparent background) */
    imageUrl: text("image_url").notNull(),
    /** SHA-256 hash of the image file for tamper detection */
    imageHash: varchar("image_hash", { length: 64 }).notNull(),
    /** Whether this is the user's active default signature */
    isDefault: boolean("is_default").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_user_signatures_user").on(t.userId),
    index("idx_user_signatures_org").on(t.organizationId),
  ],
);

// ============================================================================
// CORRESPONDENCE (PIPELINE)
// ============================================================================

/**
 * Core correspondence record — tracks a single document through the
 * draft → review → sign → dispatch pipeline.
 */
export const correspondence = pgTable(
  "correspondence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),

    // ── Document Details ───────────────────────────────────────────────────
    /** Reference number for tracking (e.g. "LTR-2026-0042") */
    referenceNumber: varchar("reference_number", { length: 50 }),
    subject: varchar("subject", { length: 500 }).notNull(),
    /** Rich HTML/markdown body of the letter */
    body: text("body").notNull(),
    type: correspondenceTypeEnum("type").notNull().default("letter"),
    priority: correspondencePriorityEnum("priority").notNull().default("normal"),

    // ── Template ───────────────────────────────────────────────────────────
    /** If drafted from a template, reference it */
    templateId: uuid("template_id"),
    /** Snapshot of template variables used (e.g. { grievanceNumber, employerName }) */
    templateVariables: jsonb("template_variables"),

    // ── Workflow State ─────────────────────────────────────────────────────
    status: correspondenceStatusEnum("status").notNull().default("draft"),

    // ── Participants ───────────────────────────────────────────────────────
    /** User who drafted / created the correspondence */
    draftedBy: text("drafted_by")
      .notNull()
      .references(() => profiles.userId),
    /** User assigned to review and sign */
    assignedSignerId: text("assigned_signer_id")
      .references(() => profiles.userId),
    /** User who approved (if different from signer, e.g. supervisor) */
    approvedBy: text("approved_by")
      .references(() => profiles.userId),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    // ── Signing ────────────────────────────────────────────────────────────
    /** Reference to the user_signatures row used */
    signatureId: uuid("signature_id"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signedBy: text("signed_by")
      .references(() => profiles.userId),

    // ── Dispatch ───────────────────────────────────────────────────────────
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    dispatchedBy: text("dispatched_by")
      .references(() => profiles.userId),
    /** Method used to dispatch (email, mail, fax, hand-delivered) */
    dispatchMethod: varchar("dispatch_method", { length: 50 }),

    // ── Generated PDF ──────────────────────────────────────────────────────
    /** URL to the final signed PDF stored in blob storage */
    signedPdfUrl: text("signed_pdf_url"),
    /** SHA-256 hash of the signed PDF */
    signedPdfHash: varchar("signed_pdf_hash", { length: 64 }),

    // ── Attachments ────────────────────────────────────────────────────────
    /** Array of { id, name, url, mimeType, sizeBytes } */
    attachments: jsonb("attachments").$type<
      Array<{
        id: string;
        name: string;
        url: string;
        mimeType: string;
        sizeBytes: number;
      }>
    >(),

    // ── Case Linkage ───────────────────────────────────────────────────────
    /** Link to a grievance / case if applicable */
    grievanceId: uuid("grievance_id"),

    // ── Notes ──────────────────────────────────────────────────────────────
    /** Internal notes visible only to org staff */
    internalNotes: text("internal_notes"),

    // ── Timestamps ─────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_correspondence_org").on(t.organizationId),
    index("idx_correspondence_status").on(t.status),
    index("idx_correspondence_drafter").on(t.draftedBy),
    index("idx_correspondence_signer").on(t.assignedSignerId),
    index("idx_correspondence_ref").on(t.referenceNumber),
    index("idx_correspondence_grievance").on(t.grievanceId),
  ],
);

// ============================================================================
// RECIPIENTS
// ============================================================================

/**
 * External recipients for a piece of correspondence.
 * Supports sending to multiple parties (e.g. employer + CC to legal).
 */
export const correspondenceRecipients = pgTable(
  "correspondence_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correspondenceId: uuid("correspondence_id")
      .notNull()
      .references(() => correspondence.id, { onDelete: "cascade" }),
    /** "to" | "cc" | "bcc" */
    recipientType: varchar("recipient_type", { length: 10 })
      .notNull()
      .default("to"),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    /** Physical mailing address (for printed letters) */
    mailingAddress: text("mailing_address"),
    organization: varchar("organization", { length: 255 }),
    title: varchar("title", { length: 255 }),
    /** Delivery confirmation (email opened, tracking number, etc.) */
    deliveryStatus: varchar("delivery_status", { length: 50 }).default("pending"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_corr_recipients_corr").on(t.correspondenceId),
  ],
);

// ============================================================================
// AUDIT TRAIL
// ============================================================================

/**
 * Immutable audit log for every action on a correspondence record.
 * Provides a complete chain of custody for legal/compliance purposes.
 */
export const correspondenceAuditTrail = pgTable(
  "correspondence_audit_trail",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correspondenceId: uuid("correspondence_id")
      .notNull()
      .references(() => correspondence.id, { onDelete: "cascade" }),
    eventType: correspondenceAuditEventEnum("event_type").notNull(),
    eventDescription: text("event_description"),
    /** Who performed the action */
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => profiles.userId),
    actorName: varchar("actor_name", { length: 255 }),
    actorRole: varchar("actor_role", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    /** Additional event-specific data */
    metadata: jsonb("metadata"),
    /** For tamper-proof chain: SHA-256(prev_hash + event_data) */
    hashChain: varchar("hash_chain", { length: 64 }),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_corr_audit_corr").on(t.correspondenceId),
    index("idx_corr_audit_actor").on(t.actorUserId),
    index("idx_corr_audit_event").on(t.eventType),
    index("idx_corr_audit_time").on(t.timestamp),
  ],
);

// ============================================================================
// RELATIONS
// ============================================================================

export const correspondenceRelations = relations(correspondence, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [correspondence.organizationId],
    references: [organizations.id],
  }),
  drafter: one(profiles, {
    fields: [correspondence.draftedBy],
    references: [profiles.userId],
    relationName: "correspondence_drafter",
  }),
  signer: one(profiles, {
    fields: [correspondence.assignedSignerId],
    references: [profiles.userId],
    relationName: "correspondence_signer",
  }),
  signature: one(userSignatures, {
    fields: [correspondence.signatureId],
    references: [userSignatures.id],
  }),
  recipients: many(correspondenceRecipients),
  auditTrail: many(correspondenceAuditTrail),
}));

export const correspondenceRecipientsRelations = relations(
  correspondenceRecipients,
  ({ one }) => ({
    correspondence: one(correspondence, {
      fields: [correspondenceRecipients.correspondenceId],
      references: [correspondence.id],
    }),
  }),
);

export const correspondenceAuditTrailRelations = relations(
  correspondenceAuditTrail,
  ({ one }) => ({
    correspondence: one(correspondence, {
      fields: [correspondenceAuditTrail.correspondenceId],
      references: [correspondence.id],
    }),
    actor: one(profiles, {
      fields: [correspondenceAuditTrail.actorUserId],
      references: [profiles.userId],
    }),
  }),
);

export const userSignaturesRelations = relations(userSignatures, ({ one }) => ({
  organization: one(organizations, {
    fields: [userSignatures.organizationId],
    references: [organizations.id],
  }),
  user: one(profiles, {
    fields: [userSignatures.userId],
    references: [profiles.userId],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserSignature = typeof userSignatures.$inferSelect;
export type UserSignatureInsert = typeof userSignatures.$inferInsert;
export type Correspondence = typeof correspondence.$inferSelect;
export type CorrespondenceInsert = typeof correspondence.$inferInsert;
export type CorrespondenceRecipient = typeof correspondenceRecipients.$inferSelect;
export type CorrespondenceRecipientInsert = typeof correspondenceRecipients.$inferInsert;
export type CorrespondenceAuditEntry = typeof correspondenceAuditTrail.$inferSelect;
