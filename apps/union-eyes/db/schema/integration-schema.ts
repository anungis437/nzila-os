/**
 * Webhooks and Integration Schema
 * 
 * Outbound webhooks, API integrations, and HR/Payroll adapters
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "../schema-organizations";

/**
 * Webhook Subscriptions Table
 * Outbound webhook subscriptions for real-time event notifications
 */
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Subscription details
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Target URL
  url: varchar("url", { length: 500 }).notNull(),
  
  // Events to subscribe to
  events: text("events").array().notNull(),
  // ['member.created', 'member.updated', 'case.opened', 'payment.received', 'vote.cast']
  
  // Authentication
  authType: varchar("auth_type", { length: 50 }).default('bearer'), // 'bearer' | 'basic' | 'hmac' | 'none'
  authSecret: text("auth_secret"), // Encrypted bearer token or HMAC secret
  
  // Headers
  customHeaders: jsonb("custom_headers"), // Custom HTTP headers to send
  
  // Filtering
  filters: jsonb("filters"), // Event-specific filters
  // Example: { 'member.created': { localId: 'local-123' } }
  
  // Retry configuration
  retryEnabled: boolean("retry_enabled").default(true),
  maxRetries: integer("max_retries").default(3),
  retryBackoff: varchar("retry_backoff", { length: 50 }).default('exponential'), // 'fixed' | 'exponential'
  
  // Status
  enabled: boolean("enabled").default(true),
  
  // Statistics
  deliverySuccessCount: integer("delivery_success_count").default(0),
  deliveryFailureCount: integer("delivery_failure_count").default(0),
  lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
  lastFailureReason: text("last_failure_reason"),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

/**
 * Webhook Deliveries Table
 * Log of webhook delivery attempts
 */
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Subscription reference
  subscriptionId: uuid("subscription_id").notNull().references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
  
  // Event details
  eventType: varchar("event_type", { length: 100 }).notNull(),
  eventId: uuid("event_id").notNull(), // Reference to source event
  
  // Request
  requestUrl: varchar("request_url", { length: 500 }).notNull(),
  requestMethod: varchar("request_method", { length: 10 }).default('POST'),
  requestHeaders: jsonb("request_headers"),
  requestBody: jsonb("request_body").notNull(),
  
  // Response
  responseStatus: integer("response_status"),
  responseHeaders: jsonb("response_headers"),
  responseBody: text("response_body"),
  
  // Timing
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  responseTime: integer("response_time_ms"), // Response time in milliseconds
  
  // Retry tracking
  attemptNumber: integer("attempt_number").default(1),
  isRetry: boolean("is_retry").default(false),
  
  // Status
  status: varchar("status", { length: 50 }).notNull(), // 'success' | 'failed' | 'pending'
  errorMessage: text("error_message"),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

/**
 * API Integrations Table
 * Third-party integrations (HR, Payroll, etc.)
 */
export const apiIntegrations = pgTable("api_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Integration details
  name: varchar("name", { length: 255 }).notNull(),
  integrationType: varchar("integration_type", { length: 50 }).notNull(),
  // 'hr_system' | 'payroll_system' | 'accounting' | 'calendar' | 'email' | 'custom'
  
  provider: varchar("provider", { length: 100 }), // 'ADP', 'Workday', 'QuickBooks', etc.
  
  // Connection details
  connectionType: varchar("connection_type", { length: 50 }).notNull(),
  // 'api' | 'sftp' | 'file_upload' | 'database' | 'csv_import'
  
  // API configuration
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  apiVersion: varchar("api_version", { length: 50 }),
  authType: varchar("auth_type", { length: 50 }), // 'oauth2' | 'api_key' | 'basic' | 'custom'
  credentials: jsonb("credentials"), // Encrypted credentials
  
  // File-based configuration
  sftpHost: varchar("sftp_host", { length: 255 }),
  sftpPort: integer("sftp_port"),
  sftpPath: varchar("sftp_path", { length: 500 }),
  fileFormat: varchar("file_format", { length: 50 }), // 'csv' | 'json' | 'xml' | 'excel'
  
  // Data mapping
  fieldMapping: jsonb("field_mapping").notNull(),
  // Map between UnionEyes fields and external system fields
  
  // Sync configuration
  syncDirection: varchar("sync_direction", { length: 50 }).default('inbound'),
  // 'inbound' | 'outbound' | 'bidirectional'
  
  syncFrequency: varchar("sync_frequency", { length: 50 }), // 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual'
  syncSchedule: jsonb("sync_schedule"), // Cron expression or schedule config
  
  // Status
  enabled: boolean("enabled").default(true),
  connectionStatus: varchar("connection_status", { length: 50 }).default('not_tested'),
  // 'not_tested' | 'connected' | 'error' | 'disconnected'
  
  // Statistics
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: varchar("last_sync_status", { length: 50 }),
  recordsSyncedTotal: integer("records_synced_total").default(0),
  lastSyncRecordCount: integer("last_sync_record_count"),
  errorCount: integer("error_count").default(0),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

/**
 * Integration Sync Logs
 * Detailed log of integration sync operations
 */
export const integrationSyncLogs = pgTable("integration_sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Integration reference
  integrationId: uuid("integration_id").notNull().references(() => apiIntegrations.id, { onDelete: "cascade" }),
  
  // Sync details
  syncType: varchar("sync_type", { length: 50 }).notNull(), // 'full' | 'incremental' | 'manual'
  direction: varchar("direction", { length: 50 }).notNull(), // 'inbound' | 'outbound'
  
  // Timing
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  
  // Results
  status: varchar("status", { length: 50 }).notNull(), // 'success' | 'partial' | 'failed'
  recordsProcessed: integer("records_processed").default(0),
  recordsSucceeded: integer("records_succeeded").default(0),
  recordsFailed: integer("records_failed").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  
  // Errors
  errors: jsonb("errors"), // [{ record, error, details }]
  errorSummary: text("error_summary"),
  
  // Data
  dataSummary: jsonb("data_summary"), // Summary stats about synced data
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  triggeredBy: varchar("triggered_by", { length: 255 }), // 'system' | 'user_id'
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

/**
 * API Access Tokens
 * Tokens for external systems to access UnionEyes API
 */
export const apiAccessTokens = pgTable("api_access_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Organization
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Token details
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Token
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(), // SHA-256 hash
  tokenPrefix: varchar("token_prefix", { length: 10 }).notNull(), // First 10 chars for identification
  
  // Permissions
  scopes: text("scopes").array().notNull(), // ['read:members', 'write:members', 'read:reports']
  
  // IP restrictions
  allowedIps: text("allowed_ips").array(), // Whitelist of IP addresses/ranges
  
  // Rate limiting
  rateLimit: integer("rate_limit").default(1000), // Requests per hour
  
  // Status
  enabled: boolean("enabled").default(true),
  
  // Usage statistics
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  usageCount: integer("usage_count").default(0),
  
  // Expiry
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: varchar("revoked_by", { length: 255 }),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

// Export types
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type APIIntegration = typeof apiIntegrations.$inferSelect;
export type NewAPIIntegration = typeof apiIntegrations.$inferInsert;
export type IntegrationSyncLog = typeof integrationSyncLogs.$inferSelect;
export type NewIntegrationSyncLog = typeof integrationSyncLogs.$inferInsert;
export type APIAccessToken = typeof apiAccessTokens.$inferSelect;
export type NewAPIAccessToken = typeof apiAccessTokens.$inferInsert;
