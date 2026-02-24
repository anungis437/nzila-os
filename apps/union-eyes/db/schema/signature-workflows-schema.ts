/**
 * E-Signature & PKI Workflow Schema
 * 
 * Tracks digital signature workflows, processing, and audit trails
 * Supports DocuSign, HelloSign, and other e-signature providers
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  _decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../schema-organizations";
import { profiles } from "./profiles-schema";
import { documents } from "./documents-schema";

// ============================================================================
// ENUMS
// ============================================================================

export const signatureWorkflowStatusEnum = pgEnum("signature_workflow_status", [
  "draft",
  "sent",
  "in_progress",
  "completed",
  "declined",
  "cancelled",
  "expired",
  "voided",
]);

export const signerStatusEnum = pgEnum("signer_status", [
  "pending",
  "sent",
  "opened",
  "signed",
  "declined",
  "skipped",
]);

export const signatureProviderEnum = pgEnum("signature_provider", [
  "docusign",
  "hellosign",
  "signrequest",
  "adobe_sign",
]);

// ============================================================================
// MAIN TABLES
// ============================================================================

/**
 * Signature workflows - tracks document signing workflows
 */
export const signatureWorkflows = pgTable(
  "signature_workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    
    // Workflow details
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: signatureWorkflowStatusEnum("status").notNull().default("draft"),
    
    // Provider details
    provider: signatureProviderEnum("provider").notNull(),
    externalEnvelopeId: varchar("external_envelope_id", { length: 255 }).notNull().unique(),
    externalWorkflowId: varchar("external_workflow_id", { length: 255 }),
    
    // Signing process
    totalSigners: integer("total_signers").notNull(),
    completedSignatures: integer("completed_signatures").default(0),
    
    // Dates
    sentAt: timestamp("sent_at"),
    expiresAt: timestamp("expires_at"),
    completedAt: timestamp("completed_at"),
    
    // Config
    reminderFrequencyDays: integer("reminder_frequency_days").default(3),
    lastReminderSentAt: timestamp("last_reminder_sent_at"),
    autoRemindersEnabled: boolean("auto_reminders_enabled").default(true),
    
    // Metadata
    workflowData: jsonb("workflow_data"), // Provider-specific data
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 255 }),
    voidedAt: timestamp("voided_at"),
    voidedBy: varchar("voided_by", { length: 255 }),
    voidReason: text("void_reason"),
  },
  (t) => ({
    orgIdx: index("signature_workflows_org_idx").on(t.organizationId),
    docIdx: index("signature_workflows_doc_idx").on(t.documentId),
    statusIdx: index("signature_workflows_status_idx").on(t.status),
    envelopeIdx: index("signature_workflows_envelope_idx").on(t.externalEnvelopeId),
  })
);

/**
 * Signers - tracks individual signers per workflow
 */
export const signers = pgTable(
  "signers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => signatureWorkflows.id, { onDelete: "cascade" }),
    memberId: varchar("member_id", { length: 255 }).references(() => profiles.userId, { onDelete: "set null" }),
    
    // Signer info
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    signerOrder: integer("signer_order").notNull(),
    
    // Status
    status: signerStatusEnum("status").notNull().default("pending"),
    
    // Signing
    signedAt: timestamp("signed_at"),
    declinedAt: timestamp("declined_at"),
    declineReason: text("decline_reason"),
    
    // Provider details
    externalSignerId: varchar("external_signer_id", { length: 255 }),
    signingUrl: varchar("signing_url", { length: 500 }),
    signatureImage: text("signature_image"), // Base64 or URL to signature image
    
    // Audit trail
    ipAddress: varchar("ip_address"),
    userAgent: text("user_agent"),
    
    // Reminders
    lastReminderSentAt: timestamp("last_reminder_sent_at"),
    reminderCount: integer("reminder_count").default(0),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    workflowIdx: index("signers_workflow_idx").on(t.workflowId),
    memberIdx: index("signers_member_idx").on(t.memberId),
    emailIdx: index("signers_email_idx").on(t.email),
    statusIdx: index("signers_status_idx").on(t.status),
  })
);

/**
 * Signature audit log - complete audit trail of all signature events
 */
export const signatureAuditLog = pgTable(
  "signature_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => signatureWorkflows.id, { onDelete: "cascade" }),
    signerId: uuid("signer_id").references(() => signers.id, { onDelete: "set null" }),
    
    // Event
    eventType: varchar("event_type", { length: 100 }).notNull(), // opened, signed, declined, reminded, sent, etc.
    eventDescription: text("event_description"),
    
    // Details
    ipAddress: varchar("ip_address"),
    userAgent: text("user_agent"),
    location: jsonb("location"), // Geolocation data if available
    
    // Timestamp
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    
    // Provider data
    externalEventId: varchar("external_event_id", { length: 255 }),
    providerData: jsonb("provider_data"), // Raw provider event data
    
    // Signature data
    signatureId: varchar("signature_id", { length: 255 }), // Reference to signature in provider
    certificateInfo: jsonb("certificate_info"), // Certificate details if provided
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    workflowIdx: index("signature_audit_log_workflow_idx").on(t.workflowId),
    signerIdx: index("signature_audit_log_signer_idx").on(t.signerId),
    eventTypeIdx: index("signature_audit_log_event_type_idx").on(t.eventType),
  })
);

/**
 * Signature verification - stores signature verification data for legal validity
 */
export const signatureVerification = pgTable(
  "signature_verification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => signatureWorkflows.id, { onDelete: "cascade" }),
    signerId: uuid("signer_id")
      .notNull()
      .references(() => signers.id, { onDelete: "cascade" }),
    
    // Verification details
    signatureHash: varchar("signature_hash", { length: 255 }).notNull(), // SHA256 hash of signature
    certificateHash: varchar("certificate_hash", { length: 255 }), // Hash of signing certificate
    
    // Verification status
    isVerified: boolean("is_verified").default(false),
    verificationMethod: varchar("verification_method", { length: 100 }), // ocsp, crl, local
    verificationResult: jsonb("verification_result"), // Verification details
    
    // Certificate chain
    certificateChain: jsonb("certificate_chain"), // Array of certificates
    certificateValidFrom: timestamp("certificate_valid_from"),
    certificateValidTo: timestamp("certificate_valid_to"),
    certificateIssuer: text("certificate_issuer"),
    
    // Tamper detection
    tamperDetected: boolean("tamper_detected").default(false),
    tamperDetails: text("tamper_details"),
    
    // Evidence
    signatureFile: varchar("signature_file", { length: 500 }), // Path to signature evidence file
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    verifiedAt: timestamp("verified_at"),
    verifiedBy: varchar("verified_by", { length: 255 }),
  },
  (t) => ({
    workflowIdx: index("signature_verification_workflow_idx").on(t.workflowId),
    signerIdx: index("signature_verification_signer_idx").on(t.signerId),
    verificationIdx: index("signature_verification_verified_idx").on(t.isVerified),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const signatureWorkflowsRelations = relations(signatureWorkflows, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [signatureWorkflows.organizationId],
    references: [organizations.id],
  }),
  document: one(documents, {
    fields: [signatureWorkflows.documentId],
    references: [documents.id],
  }),
  signers: many(signers),
  auditLog: many(signatureAuditLog),
}));

export const signersRelations = relations(signers, ({ one, many }) => ({
  workflow: one(signatureWorkflows, {
    fields: [signers.workflowId],
    references: [signatureWorkflows.id],
  }),
  member: one(profiles, {
    fields: [signers.memberId],
    references: [profiles.userId],
  }),
  auditLog: many(signatureAuditLog),
  verification: one(signatureVerification),
}));

export const signatureAuditLogRelations = relations(signatureAuditLog, ({ one }) => ({
  workflow: one(signatureWorkflows, {
    fields: [signatureAuditLog.workflowId],
    references: [signatureWorkflows.id],
  }),
  signer: one(signers, {
    fields: [signatureAuditLog.signerId],
    references: [signers.id],
  }),
}));

export const signatureVerificationRelations = relations(signatureVerification, ({ one }) => ({
  workflow: one(signatureWorkflows, {
    fields: [signatureVerification.workflowId],
    references: [signatureWorkflows.id],
  }),
  signer: one(signers, {
    fields: [signatureVerification.signerId],
    references: [signers.id],
  }),
}));

