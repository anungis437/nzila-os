/**
 * GDPR Compliance Schema
 * 
 * Implements GDPR requirements:
 * - Article 6: Lawful basis for processing
 * - Article 7: Conditions for consent
 * - Article 13-14: Information requirements
 * - Article 15: Right of access
 * - Article 17: Right to erasure
 * - Article 20: Right to data portability
 * - Article 30: Records of processing activities
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
} from "drizzle-orm/pg-core";
import { organizations } from "../../../schema-organizations";
import { profiles } from "../../profiles-schema";

// Consent types enum
export const consentTypeEnum = pgEnum("consent_type", [
  "essential",        // Required for service operation
  "functional",       // Enhances user experience
  "analytics",        // Usage analytics and statistics
  "marketing",        // Marketing communications
  "personalization",  // Personalized content
  "third_party",      // Third-party integrations
]);

// Consent status enum
export const consentStatusEnum = pgEnum("consent_status", [
  "granted",
  "denied",
  "withdrawn",
  "expired",
]);

// Data processing purpose enum
export const processingPurposeEnum = pgEnum("processing_purpose", [
  "service_delivery",
  "legal_compliance",
  "contract_performance",
  "legitimate_interest",
  "consent",
  "vital_interest",
]);

// GDPR request type enum
export const gdprRequestTypeEnum = pgEnum("gdpr_request_type", [
  "access",           // Article 15: Right of access
  "rectification",    // Article 16: Right to rectification
  "erasure",          // Article 17: Right to erasure (RTBF)
  "restriction",      // Article 18: Right to restriction
  "portability",      // Article 20: Right to data portability
  "objection",        // Article 21: Right to object
]);

// GDPR request status enum
export const gdprRequestStatusEnum = pgEnum("gdpr_request_status", [
  "pending",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
]);

/**
 * User Consent Records
 * Tracks all consent decisions made by users
 */
export const userConsents = pgTable(
  "user_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Consent details
    consentType: consentTypeEnum("consent_type").notNull(),
    status: consentStatusEnum("status").notNull().default("granted"),
    
    // Legal basis
    legalBasis: text("legal_basis").notNull(), // GDPR Article 6
    processingPurpose: processingPurposeEnum("processing_purpose").notNull(),
    
    // Consent metadata
    consentVersion: text("consent_version").notNull(), // Policy version
    consentText: text("consent_text").notNull(), // Actual text shown
    
    // User interaction
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    grantedAt: timestamp("granted_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"), // Some consents expire
    withdrawnAt: timestamp("withdrawn_at"),
    
    // Additional context
    metadata: jsonb("metadata").$type<{
      source?: string; // web, mobile, api
      campaign?: string;
      thirdPartyServices?: string[];
      dataCategories?: string[];
    }>(),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_consents_user_id_idx").on(table.userId),
    organizationIdIdx: index("user_consents_organization_id_idx").on(
      table.organizationId
    ),
    statusIdx: index("user_consents_status_idx").on(table.status),
    typeIdx: index("user_consents_type_idx").on(table.consentType),
  })
);

/**
 * Cookie Consent Records
 * Tracks cookie preferences separately for granular control
 */
export const cookieConsents = pgTable(
  "cookie_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => profiles.userId, {
      onDelete: "cascade",
    }), // Optional - can track anonymous users
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Cookie categories
    essential: boolean("essential").notNull().default(true), // Always true
    functional: boolean("functional").notNull().default(false),
    analytics: boolean("analytics").notNull().default(false),
    marketing: boolean("marketing").notNull().default(false),
    
    // Tracking
    consentId: text("consent_id").notNull().unique(), // Browser-side ID
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    
    // Metadata
    lastUpdated: timestamp("last_updated").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(), // Typically 12 months
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("cookie_consents_user_id_idx").on(table.userId),
    consentIdIdx: index("cookie_consents_consent_id_idx").on(table.consentId),
    organizationIdIdx: index("cookie_consents_organization_id_idx").on(
      table.organizationId
    ),
  })
);

/**
 * GDPR Data Requests
 * Tracks user data requests (access, erasure, portability, etc.)
 */
export const gdprDataRequests = pgTable(
  "gdpr_data_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Request details
    requestType: gdprRequestTypeEnum("request_type").notNull(),
    status: gdprRequestStatusEnum("status").notNull().default("pending"),
    
    // Request specifics
    requestDetails: jsonb("request_details").$type<{
      dataCategories?: string[];
      specificRecords?: string[];
      reason?: string;
      preferredFormat?: "json" | "csv" | "xml";
    }>(),
    
    // Processing
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
    completedAt: timestamp("completed_at"),
    
    // Identity verification
    verificationMethod: text("verification_method"), // email, sms, manual
    verifiedAt: timestamp("verified_at"),
    verifiedBy: text("verified_by"),
    
    // Response
    responseData: jsonb("response_data").$type<{
      fileUrl?: string;
      expiresAt?: string;
      format?: string;
      recordsIncluded?: string[];
    }>(),
    
    // Legal compliance
    deadline: timestamp("deadline").notNull(), // 30 days from request
    rejectionReason: text("rejection_reason"),
    
    // Audit trail
    processedBy: text("processed_by"),
    notes: text("notes"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("gdpr_requests_user_id_idx").on(table.userId),
    statusIdx: index("gdpr_requests_status_idx").on(table.status),
    typeIdx: index("gdpr_requests_type_idx").on(table.requestType),
    deadlineIdx: index("gdpr_requests_deadline_idx").on(table.deadline),
    organizationIdIdx: index("gdpr_requests_organization_id_idx").on(
      table.organizationId
    ),
  })
);

/**
 * Data Anonymization Log
 * Track anonymization/pseudonymization operations
 */
export const dataAnonymizationLog = pgTable(
  "data_anonymization_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(), // Original user ID (before anonymization)
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Operation details
    operationType: text("operation_type").notNull(), // anonymize, pseudonymize, delete
    reason: text("reason").notNull(), // RTBF request, retention policy, etc.
    requestId: uuid("request_id").references(() => gdprDataRequests.id),
    
    // What was anonymized
    tablesAffected: jsonb("tables_affected").$type<
      Array<{
        table: string;
        recordsAffected: number;
        fieldsAnonymized: string[];
      }>
    >().notNull(),
    
    // Execution
    executedAt: timestamp("executed_at").notNull().defaultNow(),
    executedBy: text("executed_by").notNull(),
    
    // Verification
    verifiedAt: timestamp("verified_at"),
    verifiedBy: text("verified_by"),
    
    // Audit
    canReverse: boolean("can_reverse").notNull().default(false),
    backupLocation: text("backup_location"), // For reversible operations
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("anonymization_log_user_id_idx").on(table.userId),
    organizationIdIdx: index("anonymization_log_organization_id_idx").on(
      table.organizationId
    ),
    requestIdIdx: index("anonymization_log_request_id_idx").on(
      table.requestId
    ),
  })
);

// Type exports for use in application code
export type UserConsent = typeof userConsents.$inferSelect;
export type NewUserConsent = typeof userConsents.$inferInsert;
export type CookieConsent = typeof cookieConsents.$inferSelect;
export type NewCookieConsent = typeof cookieConsents.$inferInsert;
export type GdprDataRequest = typeof gdprDataRequests.$inferSelect;
export type NewGdprDataRequest = typeof gdprDataRequests.$inferInsert;
export type DataAnonymizationLog = typeof dataAnonymizationLog.$inferSelect;
export type NewDataAnonymizationLog = typeof dataAnonymizationLog.$inferInsert;

