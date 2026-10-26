/**
 * CLC (Canadian Labour Congress) Synchronization Schema
 * 
 * Tracks CLC API synchronization events, webhook deliveries, and logs
 * for reconciliation and audit purposes
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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../../../schema-organizations";

// ============================================================================
// ENUMS
// ============================================================================

export const clcSyncStatusEnum = pgEnum("clc_sync_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "partial",
  "manual_review_required",
]);

export const clcSyncTypeEnum = pgEnum("clc_sync_type", [
  "full_sync",
  "incremental_sync",
  "remittance_sync",
  "member_update",
  "wage_update",
  "dispute_update",
]);

export const clcWebhookStatusEnum = pgEnum("clc_webhook_status", [
  "received",
  "processing",
  "processed",
  "failed",
  "skipped",
  "manual_review",
]);

// ============================================================================
// MAIN TABLES
// ============================================================================

/**
 * CLC Sync Log - tracks all synchronization operations
 */
export const clcSyncLog = pgTable(
  "clc_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Sync details
    syncType: clcSyncTypeEnum("sync_type").notNull(),
    status: clcSyncStatusEnum("status").notNull().default("pending"),
    direction: varchar("direction", { length: 20 }).notNull(), // inbound or outbound
    
    // Sync parameters
    syncStartDate: timestamp("sync_start_date"),
    syncEndDate: timestamp("sync_end_date"),
    
    // Results
    recordsProcessed: integer("records_processed").default(0),
    recordsSucceeded: integer("records_succeeded").default(0),
    recordsFailed: integer("records_failed").default(0),
    recordsSkipped: integer("records_skipped").default(0),
    
    // Error tracking
    errorMessage: text("error_message"),
    errorDetails: jsonb("error_details"),
    
    // Data
    dataHash: varchar("data_hash"), // Hash of synced data for integrity verification
    syncData: jsonb("sync_data"), // Summary of what was synced
    
    // Verification
    verificationStatus: varchar("verification_status", { length: 50 }),
    verificationNotes: text("verification_notes"),
    isVerified: boolean("is_verified").default(false),
    verifiedAt: timestamp("verified_at"),
    verifiedBy: varchar("verified_by", { length: 255 }),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    initiatedBy: varchar("initiated_by", { length: 255 }),
  },
  (t) => ({
    orgIdx: index("clc_sync_log_org_idx").on(t.organizationId),
    statusIdx: index("clc_sync_log_status_idx").on(t.status),
    typeIdx: index("clc_sync_log_type_idx").on(t.syncType),
    dateIdx: index("clc_sync_log_date_idx").on(t.createdAt),
  })
);

/**
 * CLC Webhook Log - tracks all webhook deliveries
 */
export const clcWebhookLog = pgTable(
  "clc_webhook_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Webhook details
    webhookUrl: varchar("webhook_url", { length: 500 }),
    webhookEventType: varchar("webhook_event_type", { length: 100 }).notNull(),
    externalWebhookId: varchar("external_webhook_id", { length: 100 }),
    
    // Delivery tracking
    status: clcWebhookStatusEnum("status").notNull().default("received"),
    httpStatusCode: integer("http_status_code"),
    
    // Request data
    payload: jsonb("payload").notNull(),
    payloadHash: varchar("payload_hash"), // For duplicate detection
    signature: varchar("signature"), // HMAC signature for verification
    
    // Response data
    responseBody: jsonb("response_body"),
    responseTime: integer("response_time"), // milliseconds
    
    // Related sync
    syncLogId: uuid("sync_log_id").references(() => clcSyncLog.id, { onDelete: "set null" }),
    
    // Processing
    processedAt: timestamp("processed_at"),
    processingError: text("processing_error"),
    retryCount: integer("retry_count").default(0),
    nextRetryAt: timestamp("next_retry_at"),
    
    // Manual review
    requiresManualReview: boolean("requires_manual_review").default(false),
    reviewNotes: text("review_notes"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: varchar("reviewed_by", { length: 255 }),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("clc_webhook_log_org_idx").on(t.organizationId),
    statusIdx: index("clc_webhook_log_status_idx").on(t.status),
    webhookIdx: index("clc_webhook_log_webhook_idx").on(t.externalWebhookId),
    syncLogIdx: index("clc_webhook_log_sync_idx").on(t.syncLogId),
    payloadHashIdx: index("clc_webhook_log_payload_hash_idx").on(t.payloadHash),
  })
);

/**
 * CLC Remittance Mapping - for tracking remittance data from CLC
 */
export const clcRemittanceMapping = pgTable(
  "clc_remittance_mapping",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    
    // Local and external reference
    localRemittanceId: uuid("local_remittance_id"),
    externalRemittanceId: varchar("external_remittance_id", { length: 100 }).notNull(),
    
    // Mapping details
    localData: jsonb("local_data"),
    externalData: jsonb("external_data"),
    reconciliationStatus: varchar("reconciliation_status", { length: 50 }),
    
    // Verification
    isVerified: boolean("is_verified").default(false),
    verificationNotes: text("verification_notes"),
    
    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    verifiedAt: timestamp("verified_at"),
    verifiedBy: varchar("verified_by", { length: 255 }),
  },
  (t) => ({
    orgIdx: index("clc_remittance_mapping_org_idx").on(t.organizationId),
    externalIdx: index("clc_remittance_mapping_external_idx").on(t.externalRemittanceId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const clcSyncLogRelations = relations(clcSyncLog, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clcSyncLog.organizationId],
    references: [organizations.id],
  }),
  webhookLogs: many(clcWebhookLog),
}));

export const clcWebhookLogRelations = relations(clcWebhookLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [clcWebhookLog.organizationId],
    references: [organizations.id],
  }),
  syncLog: one(clcSyncLog, {
    fields: [clcWebhookLog.syncLogId],
    references: [clcSyncLog.id],
  }),
}));

export const clcRemittanceMappingRelations = relations(clcRemittanceMapping, ({ one }) => ({
  organization: one(organizations, {
    fields: [clcRemittanceMapping.organizationId],
    references: [organizations.id],
  }),
}));

