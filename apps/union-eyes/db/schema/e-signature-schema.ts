/**
 * E-Signature Schema
 * 
 * Supports DocuSign, HelloSign, and other e-signature providers
 * Includes full audit trail for legal compliance
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { organizations } from "../schema-organizations";
import { profiles } from "./profiles-schema";

// E-Signature provider enum
export const signatureProviderEnum = pgEnum("signature_provider", [
  "docusign",
  "hellosign",
  "adobe_sign",
  "pandadoc",
  "internal", // Built-in signature system
]);

// Document status enum
export const signatureDocumentStatusEnum = pgEnum(
  "signature_document_status",
  [
    "draft",
    "sent",
    "delivered",
    "viewed",
    "signed",
    "completed",
    "declined",
    "voided",
    "expired",
  ]
);

// Signer status enum
export const signerStatusEnum = pgEnum("signer_status", [
  "pending",
  "sent",
  "delivered",
  "viewed",
  "signed",
  "declined",
  "authentication_failed",
  "expired",
]);

// Signature type enum
export const signatureTypeEnum = pgEnum("signature_type", [
  "electronic",      // Standard e-signature
  "digital",         // Certificate-based
  "wet",             // Physical signature (uploaded)
  "clickwrap",       // Click-to-accept
]);

// Authentication method enum
export const authenticationMethodEnum = pgEnum("authentication_method", [
  "email",
  "sms",
  "phone_call",
  "knowledge_based",  // KBA questions
  "id_verification",  // Government ID
  "multi_factor",
  "none",
]);

/**
 * Signature Documents
 * Main table for documents requiring signatures
 */
export const signatureDocuments = pgTable(
  "signature_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Document details
    title: text("title").notNull(),
    description: text("description"),
    documentType: text("document_type").notNull(), // contract, agreement, form, authorization
    
    // File information
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    fileHash: text("file_hash").notNull(), // SHA-256 for integrity
    
    // Provider integration
    provider: signatureProviderEnum("provider").notNull(),
    providerDocumentId: text("provider_document_id"), // External provider ID
    providerEnvelopeId: text("provider_envelope_id"), // DocuSign envelope, etc.
    
    // Status
    status: signatureDocumentStatusEnum("status").notNull().default("draft"),
    
    // Sender information
    sentBy: text("sent_by")
      .notNull()
      .references(() => profiles.userId),
    sentAt: timestamp("sent_at"),
    
    // Completion
    completedAt: timestamp("completed_at"),
    voidedAt: timestamp("voided_at"),
    voidedBy: text("voided_by"),
    voidReason: text("void_reason"),
    
    // Expiration
    expiresAt: timestamp("expires_at"),
    reminderSchedule: jsonb("reminder_schedule").$type<{
      days: number[];
      lastSent?: string;
    }>(),
    
    // Security
    requireAuthentication: boolean("require_authentication")
      .notNull()
      .default(false),
    authenticationMethod: authenticationMethodEnum("authentication_method"),
    accessCode: text("access_code"), // Optional PIN
    
    // Settings
    sequentialSigning: boolean("sequential_signing")
      .notNull()
      .default(false), // Signers must sign in order
    allowDecline: boolean("allow_decline").notNull().default(true),
    allowReassign: boolean("allow_reassign").notNull().default(false),
    
    // Template
    templateId: uuid("template_id").references(
      () => signatureTemplates.id,
      { onDelete: "set null" }
    ),
    
    // Metadata
    metadata: jsonb("metadata").$type<{
      relatedEntityType?: string; // claim, contract, member
      relatedEntityId?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customFields?: Record<string, any>;
      tags?: string[];
    }>(),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("signature_documents_organization_id_idx").on(
      table.organizationId
    ),
    statusIdx: index("signature_documents_status_idx").on(table.status),
    sentByIdx: index("signature_documents_sent_by_idx").on(table.sentBy),
    providerDocIdIdx: index("signature_documents_provider_doc_id_idx").on(
      table.providerDocumentId
    ),
  })
);

/**
 * Document Signers
 * Defines who needs to sign each document
 */
export const documentSigners = pgTable(
  "document_signers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => signatureDocuments.id, { onDelete: "cascade" }),
    
    // Signer details
    userId: text("user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }), // Null if external signer
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role"), // e.g., "Member", "Union Rep", "Employer"
    
    // Signing order
    signingOrder: integer("signing_order").notNull().default(1),
    
    // Status
    status: signerStatusEnum("status").notNull().default("pending"),
    
    // Notifications
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    viewedAt: timestamp("viewed_at"),
    
    // Signature
    signedAt: timestamp("signed_at"),
    signatureType: signatureTypeEnum("signature_type"),
    signatureImageUrl: text("signature_image_url"),
    
    // Authentication
    authenticationMethod: authenticationMethodEnum("authentication_method"),
    authenticatedAt: timestamp("authenticated_at"),
    
    // Decline/Reassign
    declinedAt: timestamp("declined_at"),
    declineReason: text("decline_reason"),
    reassignedTo: text("reassigned_to"),
    reassignedAt: timestamp("reassigned_at"),
    
    // Identity verification
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    geolocation: jsonb("geolocation").$type<{
      country?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    }>(),
    
    // Provider data
    providerSignerId: text("provider_signer_id"),
    
    // Metadata
    metadata: jsonb("metadata").$type<{
      phoneNumber?: string;
      idVerification?: {
        documentType: string;
        documentNumber: string;
        verifiedAt: string;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customFields?: Record<string, any>;
    }>(),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    documentIdIdx: index("document_signers_document_id_idx").on(
      table.documentId
    ),
    userIdIdx: index("document_signers_user_id_idx").on(table.userId),
    emailIdx: index("document_signers_email_idx").on(table.email),
    statusIdx: index("document_signers_status_idx").on(table.status),
    signingOrderIdx: index("document_signers_signing_order_idx").on(
      table.signingOrder
    ),
  })
);

/**
 * Signature Audit Trail
 * Comprehensive audit log for legal compliance
 */
export const signatureAuditTrail = pgTable(
  "signature_audit_trail",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => signatureDocuments.id, { onDelete: "cascade" }),
    signerId: uuid("signer_id").references(() => documentSigners.id, {
      onDelete: "set null",
    }),
    
    // Event details
    eventType: text("event_type").notNull(), // sent, viewed, signed, etc.
    eventDescription: text("event_description").notNull(),
    
    // Actor
    actorUserId: text("actor_user_id"),
    actorEmail: text("actor_email"),
    actorRole: text("actor_role"),
    
    // Technical details
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
    
    // Location
    geolocation: jsonb("geolocation").$type<{
      country?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    }>(),
    
    // Additional context
    metadata: jsonb("metadata").$type<{
      provider?: string;
      providerEventId?: string;
      authenticationMethod?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      certificateInfo?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      previousValue?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newValue?: any;
    }>(),
    
    // Blockchain/Immutability (future)
    hashChain: text("hash_chain"), // Link to previous event
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    documentIdIdx: index("signature_audit_document_id_idx").on(
      table.documentId
    ),
    signerIdIdx: index("signature_audit_signer_id_idx").on(table.signerId),
    timestampIdx: index("signature_audit_timestamp_idx").on(table.timestamp),
    eventTypeIdx: index("signature_audit_event_type_idx").on(
      table.eventType
    ),
  })
);

/**
 * Signature Templates
 * Reusable document templates
 */
export const signatureTemplates = pgTable(
  "signature_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Template details
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull(), // contracts, forms, authorizations
    
    // Template content
    templateFileUrl: text("template_file_url").notNull(),
    templateFileName: text("template_file_name").notNull(),
    
    // Provider
    provider: signatureProviderEnum("provider").notNull(),
    providerTemplateId: text("provider_template_id"),
    
    // Fields
    signatureFields: jsonb("signature_fields").$type<
      Array<{
        fieldId: string;
        fieldType: "signature" | "initial" | "date" | "text" | "checkbox";
        label: string;
        required: boolean;
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
        signerRole: string; // Which signer this field is for
      }>
    >().notNull(),
    
    // Default settings
    defaultSettings: jsonb("default_settings").$type<{
      expirationDays?: number;
      reminderDays?: number[];
      requireAuthentication?: boolean;
      authenticationMethod?: string;
      sequentialSigning?: boolean;
    }>(),
    
    // Signer roles
    signerRoles: jsonb("signer_roles").$type<
      Array<{
        role: string;
        name: string;
        signingOrder: number;
        required: boolean;
      }>
    >().notNull(),
    
    // Status
    isActive: boolean("is_active").notNull().default(true),
    
    // Usage
    usageCount: integer("usage_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at"),
    
    // Ownership
    createdBy: text("created_by")
      .notNull()
      .references(() => profiles.userId),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index("signature_templates_organization_id_idx").on(
      table.organizationId
    ),
    categoryIdx: index("signature_templates_category_idx").on(
      table.category
    ),
    isActiveIdx: index("signature_templates_is_active_idx").on(
      table.isActive
    ),
  })
);

/**
 * Provider Webhooks Log
 * Track webhook events from signature providers
 */
export const signatureWebhooksLog = pgTable(
  "signature_webhooks_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Provider info
    provider: signatureProviderEnum("provider").notNull(),
    eventType: text("event_type").notNull(),
    
    // Related document
    documentId: uuid("document_id").references(() => signatureDocuments.id, {
      onDelete: "set null",
    }),
    providerDocumentId: text("provider_document_id"),
    
    // Webhook data
    payload: jsonb("payload").notNull(),
    headers: jsonb("headers"),
    
    // Processing
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
    processingStatus: text("processing_status")
      .notNull()
      .default("pending"), // pending, processed, failed
    errorMessage: text("error_message"),
    
    // Security
    signature: text("signature"), // Webhook signature for verification
    signatureVerified: boolean("signature_verified"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: index("signature_webhooks_provider_idx").on(table.provider),
    documentIdIdx: index("signature_webhooks_document_id_idx").on(
      table.documentId
    ),
    processingStatusIdx: index("signature_webhooks_processing_status_idx").on(
      table.processingStatus
    ),
  })
);

// Type exports for use in application code
export type SignatureDocument = typeof signatureDocuments.$inferSelect;
export type NewSignatureDocument = typeof signatureDocuments.$inferInsert;
export type DocumentSigner = typeof documentSigners.$inferSelect;
export type NewDocumentSigner = typeof documentSigners.$inferInsert;
export type SignatureAuditTrail = typeof signatureAuditTrail.$inferSelect;
export type NewSignatureAuditTrail = typeof signatureAuditTrail.$inferInsert;
export type SignatureTemplate = typeof signatureTemplates.$inferSelect;
export type NewSignatureTemplate = typeof signatureTemplates.$inferInsert;
export type SignatureWebhookLog = typeof signatureWebhooksLog.$inferSelect;
export type NewSignatureWebhookLog = typeof signatureWebhooksLog.$inferInsert;

