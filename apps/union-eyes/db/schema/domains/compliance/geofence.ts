import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean, decimal } from "drizzle-orm/pg-core";

/**
 * Geofence Privacy & Location Tracking Schema
 * Strict opt-in requirements, no background tracking, 24-hour data retention
 */

// Member location consent (explicit opt-in required)
export const memberLocationConsent = pgTable("member_location_consent", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  
  // Consent status
  consentStatus: varchar("consent_status", { length: 20 }).notNull().default("never_asked"), // "never_asked", "opted_in", "opted_out", "expired"
  optedInAt: timestamp("opted_in_at"),
  optedOutAt: timestamp("opted_out_at"),
  
  // Purpose limitation
  consentPurpose: text("consent_purpose").notNull(), // "Strike line tracking", "Safety check-ins", "Picket coordination"
  purposeDescription: text("purpose_description"), // Detailed explanation shown to user
  
  // Tracking restrictions
  foregroundOnly: boolean("foreground_only").notNull().default(true), // MUST be true - no background tracking
  allowedDuringStrike: boolean("allowed_during_strike").notNull().default(false),
  allowedDuringEvents: boolean("allowed_during_events").notNull().default(false),
  
  // Rights and controls
  canRevokeAnytime: boolean("can_revoke_anytime").notNull().default(true),
  dataRetentionHours: varchar("data_retention_hours", { length: 10 }).notNull().default("24"), // Max 24 hours
  autoDeleteEnabled: boolean("auto_delete_enabled").notNull().default(true),
  
  // Consent expiry (must renew periodically)
  expiresAt: timestamp("expires_at"), // Quebec Law 25 - consent expires
  renewalRequired: boolean("renewal_required").notNull().default(true),
  lastRenewalReminder: timestamp("last_renewal_reminder"),
  
  // Consent audit
  consentText: text("consent_text").notNull(), // Exact text shown to user
  consentVersion: varchar("consent_version", { length: 10 }).notNull(), // Track consent form versions
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Location tracking data (24-hour retention only)
export const locationTracking = pgTable("location_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  
  // Location data
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }), // meters
  altitude: decimal("altitude", { precision: 10, scale: 2 }), // meters
  
  // Timestamp and retention
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // recordedAt + 24 hours (MAX)
  autoDeleteScheduled: boolean("auto_delete_scheduled").notNull().default(true),
  
  // Tracking context
  trackingType: varchar("tracking_type", { length: 50 }).notNull().default("foreground_only"), // NEVER "background"
  purpose: text("purpose").notNull(), // Why this location was tracked
  activityType: varchar("activity_type", { length: 50 }), // "strike_line", "safety_checkin", "picket_duty"
  
  // Associated event/strike
  strikeId: uuid("strike_id"),
  eventId: uuid("event_id"),
  
  // Privacy flags
  sharedWithUnion: boolean("shared_with_union").notNull().default(false),
  aggregatedOnly: boolean("aggregated_only").notNull().default(true), // Only show in aggregate, not individual
  
  // Device info
  deviceType: varchar("device_type", { length: 50 }),
  appVersion: varchar("app_version", { length: 20 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Geofence definitions (strike lines, union halls, etc.)
export const geofences = pgTable("geofences", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Geofence details
  name: text("name").notNull(), // "Strike Line - Plant A", "Union Hall - Local 123"
  description: text("description"),
  geofenceType: varchar("geofence_type", { length: 50 }).notNull(), // "strike_line", "union_hall", "safety_zone"
  
  // Location (center point)
  centerLatitude: decimal("center_latitude", { precision: 10, scale: 8 }).notNull(),
  centerLongitude: decimal("center_longitude", { precision: 11, scale: 8 }).notNull(),
  radiusMeters: decimal("radius_meters", { precision: 10, scale: 2 }).notNull(), // Geofence radius
  
  // Associated orgs
  strikeId: uuid("strike_id"),
  unionLocalId: uuid("union_local_id"),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // "active", "inactive", "archived"
  activeFrom: timestamp("active_from"),
  activeTo: timestamp("active_to"),
  
  // Privacy settings
  notifyOnEntry: boolean("notify_on_entry").notNull().default(false),
  notifyOnExit: boolean("notify_on_exit").notNull().default(false),
  requiresExplicitConsent: boolean("requires_explicit_consent").notNull().default(true),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Geofence entries/exits (for safety tracking)
export const geofenceEvents = pgTable("geofence_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  geofenceId: uuid("geofence_id").notNull(),
  
  // Event details
  eventType: varchar("event_type", { length: 20 }).notNull(), // "entry", "exit"
  eventTime: timestamp("event_time").notNull().defaultNow(),
  
  // Location at event
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Auto-delete (24-hour retention)
  expiresAt: timestamp("expires_at").notNull(),
  
  // Purpose
  purpose: text("purpose"), // "Strike attendance", "Safety check-in"
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Location tracking audit log
export const locationTrackingAudit = pgTable("location_tracking_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  
  // Action
  actionType: varchar("action_type", { length: 50 }).notNull(), // "consent_granted", "consent_revoked", "data_accessed", "data_deleted"
  actionDescription: text("action_description"),
  
  // Actor
  performedBy: varchar("performed_by", { length: 255 }), // Who performed action (if different from user)
  performedByRole: varchar("performed_by_role", { length: 50 }), // "admin", "union_steward", "system"
  
  // Context
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional context
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Location data deletion log (compliance tracking)
export const locationDeletionLog = pgTable("location_deletion_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Deletion details
  deletionType: varchar("deletion_type", { length: 50 }).notNull(), // "auto_24hr", "user_request", "consent_revoked", "retention_policy"
  deletionReason: text("deletion_reason"),
  
  // What was deleted
  recordCount: varchar("record_count", { length: 20 }).notNull(),
  oldestRecordDate: timestamp("oldest_record_date"),
  newestRecordDate: timestamp("newest_record_date"),
  
  // Who initiated
  initiatedBy: varchar("initiated_by", { length: 255 }), // NULL for automatic deletions
  initiatorRole: varchar("initiator_role", { length: 50 }),
  
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
});

// Location tracking configuration (global settings)
export const locationTrackingConfig = pgTable("location_tracking_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Global settings: tracking is off until someone turns it on
  locationTrackingEnabled: boolean("location_tracking_enabled").notNull().default(false),
  maxRetentionHours: varchar("max_retention_hours", { length: 10 }).notNull().default("24"), // Hard limit: 24 hours
  
  // Background tracking (MUST be disabled)
  backgroundTrackingAllowed: boolean("background_tracking_allowed").notNull().default(false), // ALWAYS false
  backgroundTrackingReason: text("background_tracking_reason"), // Documentation if ever enabled (should never be)
  
  // Consent requirements
  explicitOptInRequired: boolean("explicit_opt_in_required").notNull().default(true),
  consentRenewalMonths: varchar("consent_renewal_months", { length: 10 }).notNull().default("6"), // Consent expires every 6 months
  
  // Auto-deletion
  autoDeletionEnabled: boolean("auto_deletion_enabled").notNull().default(true),
  autoDeletionSchedule: varchar("auto_deletion_schedule", { length: 50 }).notNull().default("hourly"), // "hourly", "daily"
  
  // Compliance
  complianceReviewRequired: boolean("compliance_review_required").notNull().default(true),
  lastComplianceReview: timestamp("last_compliance_review"),
  nextComplianceReviewDue: timestamp("next_compliance_review_due"),
  
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }),
});

