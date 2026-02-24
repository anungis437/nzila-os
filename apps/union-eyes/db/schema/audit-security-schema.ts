import { uuid, varchar, boolean, timestamp, text, jsonb, integer, pgSchema, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "../schema-organizations";
import { users } from "./user-management-schema";

// Create audit_security schema
export const auditSecuritySchema = pgSchema("audit_security");

// Audit logs table - comprehensive system activity tracking
export const auditLogs = auditSecuritySchema.table("audit_logs", {
  auditId: uuid("audit_id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  userId: varchar("user_id", { length: 255 }).references(() => users.userId),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: uuid("resource_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv6 support
  userAgent: text("user_agent"),
  sessionId: uuid("session_id"),
  correlationId: uuid("correlation_id"),
  severity: varchar("severity", { length: 20 }).default("info"),
  outcome: varchar("outcome", { length: 20 }).default("success"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  // PR #11: Archive support (never delete audit logs)
  archived: boolean("archived").default(false).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedPath: text("archived_path"), // Path to archived file (S3, filesystem, etc.)
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  checkAction: check("valid_action", 
    sql`${table.action} != ''`),
  checkSeverity: check("valid_severity", 
    sql`${table.severity} IN ('debug', 'info', 'warning', 'error', 'critical')`),
  checkOutcome: check("valid_outcome", 
    sql`${table.outcome} IN ('success', 'failure', 'error')`),
}));

// Security events table - security-specific event tracking
export const securityEvents = auditSecuritySchema.table("security_events", {
  eventId: uuid("event_id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  userId: varchar("user_id", { length: 255 }).references(() => users.userId),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventCategory: varchar("event_category", { length: 30 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  description: text("description").notNull(),
  sourceIp: varchar("source_ip", { length: 45 }), // IPv6 support
  userAgent: text("user_agent"),
  additionalData: jsonb("additional_data").default(sql`'{}'::jsonb`),
  riskScore: integer("risk_score").default(0),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: varchar("resolved_by", { length: 255 }).references(() => users.userId),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  checkCategory: check("valid_event_category", 
    sql`${table.eventCategory} IN ('authentication', 'authorization', 'data_access', 'configuration', 'suspicious')`),
  checkSeverity: check("valid_severity", 
    sql`${table.severity} IN ('low', 'medium', 'high', 'critical')`),
  checkRiskScore: check("valid_risk_score", 
    sql`${table.riskScore} BETWEEN 0 AND 100`),
}));

// Failed login attempts table - brute force detection
export const failedLoginAttempts = auditSecuritySchema.table("failed_login_attempts", {
  attemptId: uuid("attempt_id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(), // IPv6 support
  userAgent: text("user_agent"),
  failureReason: varchar("failure_reason", { length: 100 }).notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  checkRecentAttempts: check("recent_attempts", 
    sql`${table.attemptedAt} > NOW() - INTERVAL '30 days'`),
}));

// Rate limit events table - API rate limiting tracking
export const rateLimitEvents = auditSecuritySchema.table("rate_limit_events", {
  eventId: uuid("event_id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  identifierType: varchar("identifier_type", { length: 20 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  requestCount: integer("request_count").notNull(),
  limitExceeded: boolean("limit_exceeded").default(false),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  checkIdentifierType: check("valid_identifier_type", 
    sql`${table.identifierType} IN ('ip', 'user', 'api_key')`),
}));

// Export types
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type NewSecurityEvent = typeof securityEvents.$inferInsert;
export type FailedLoginAttempt = typeof failedLoginAttempts.$inferSelect;
export type NewFailedLoginAttempt = typeof failedLoginAttempts.$inferInsert;
export type RateLimitEvent = typeof rateLimitEvents.$inferSelect;
export type NewRateLimitEvent = typeof rateLimitEvents.$inferInsert;

