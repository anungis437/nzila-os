import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean } from "drizzle-orm/pg-core";

/**
 * Provincial Privacy Compliance Schema
 * Supports PIPEDA, AB/BC PIPA, Quebec Law 25, Ontario PHIPA
 */

// Provincial privacy configurations
export const provincialPrivacyConfig = pgTable("provincial_privacy_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  province: varchar("province", { length: 2 }).notNull(), // AB, BC, ON, QC, etc.
  lawName: text("law_name").notNull(), // e.g., "PIPEDA", "BC PIPA", "Law 25"
  consentRequired: boolean("consent_required").notNull().default(true),
  explicitOptIn: boolean("explicit_opt_in").notNull().default(false), // Quebec Law 25 requires explicit
  dataRetentionDays: varchar("data_retention_days", { length: 10 }).notNull().default("365"),
  breachNotificationHours: varchar("breach_notification_hours", { length: 10 }).notNull().default("72"),
  rightToErasure: boolean("right_to_erasure").notNull().default(true),
  rightToPortability: boolean("right_to_portability").notNull().default(true),
  dpoRequired: boolean("dpo_required").notNull().default(false), // Quebec Law 25
  piaRequired: boolean("pia_required").notNull().default(false), // Privacy Impact Assessment
  customRules: jsonb("custom_rules"), // Province-specific rules
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// User consent tracking per province
export const provincialConsent = pgTable("provincial_consent", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  province: varchar("province", { length: 2 }).notNull(),
  consentType: varchar("consent_type", { length: 50 }).notNull(), // "data_collection", "marketing", "sharing", etc.
  consentGiven: boolean("consent_given").notNull(),
  consentMethod: varchar("consent_method", { length: 50 }).notNull(), // "explicit_checkbox", "implied_action", "verbal", etc.
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  consentText: text("consent_text").notNull(), // Exact text shown to user
  consentLanguage: varchar("consent_language", { length: 2 }).notNull().default("en"),
  expiresAt: timestamp("expires_at"), // Some consents expire (Quebec Law 25)
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Privacy breach notifications (72-hour deadline)
export const privacyBreaches = pgTable("privacy_breaches", {
  id: uuid("id").primaryKey().defaultRandom(),
  breachType: varchar("breach_type", { length: 50 }).notNull(), // "unauthorized_access", "data_loss", "ransomware", etc.
  severity: varchar("severity", { length: 20 }).notNull(), // "low", "medium", "high", "critical"
  affectedProvince: varchar("affected_province", { length: 2 }),
  affectedUserCount: varchar("affected_user_count", { length: 20 }).notNull().default("0"),
  dataTypes: jsonb("data_types").notNull(), // ["email", "phone", "sin", "health", etc.]
  breachDescription: text("breach_description").notNull(),
  discoveredAt: timestamp("discovered_at").notNull(),
  containedAt: timestamp("contained_at"),
  
  // Notification tracking
  userNotificationRequired: boolean("user_notification_required").notNull().default(true),
  regulatorNotificationRequired: boolean("regulator_notification_required").notNull().default(true),
  usersNotifiedAt: timestamp("users_notified_at"),
  regulatorNotifiedAt: timestamp("regulator_notified_at"),
  
  // 72-hour deadline compliance
  notificationDeadline: timestamp("notification_deadline").notNull(), // discoveredAt + 72 hours
  deadlineMet: boolean("deadline_met").notNull().default(false),
  
  // Mitigation
  mitigationSteps: jsonb("mitigation_steps"),
  mitigationCompletedAt: timestamp("mitigation_completed_at"),
  
  // Documentation
  incidentReport: text("incident_report"),
  reportedBy: varchar("reported_by", { length: 255 }).notNull(),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Provincial data handling logs (audit trail)
export const provincialDataHandling = pgTable("provincial_data_handling", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  province: varchar("province", { length: 2 }).notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(), // "access", "modify", "delete", "export", "share"
  dataCategory: varchar("data_category", { length: 50 }).notNull(), // "personal", "sensitive", "health", "biometric"
  purpose: text("purpose").notNull(), // Legal basis for processing
  legalBasis: varchar("legal_basis", { length: 50 }).notNull(), // "consent", "contract", "legal_obligation", "legitimate_interest"
  
  // Third-party sharing tracking
  sharedWith: text("shared_with"), // Organization name if shared
  sharingAgreementId: uuid("sharing_agreement_id"), // DPA reference
  
  performedBy: varchar("performed_by", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Data Subject Access Requests (DSAR)
export const dataSubjectAccessRequests = pgTable("data_subject_access_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  requestType: varchar("request_type", { length: 50 }).notNull(), // "access", "rectification", "erasure", "portability", "restriction"
  province: varchar("province", { length: 2 }).notNull(),
  
  // Request details
  requestDescription: text("request_description"),
  requestedDataTypes: jsonb("requested_data_types"), // Specific data categories requested
  
  // Identity verification
  identityVerified: boolean("identity_verified").notNull().default(false),
  verificationMethod: varchar("verification_method", { length: 50 }),
  verifiedAt: timestamp("verified_at"),
  
  // Processing
  status: varchar("status", { length: 20 }).notNull().default("pending"), // "pending", "in_progress", "completed", "denied"
  assignedTo: varchar("assigned_to", { length: 255 }),
  
  // Response (30-day deadline in most provinces)
  responseDeadline: timestamp("response_deadline").notNull(), // requestedAt + 30 days
  respondedAt: timestamp("responded_at"),
  deadlineMet: boolean("deadline_met").notNull().default(false),
  
  // Denial tracking
  denialReason: text("denial_reason"), // If request denied
  denialLegalBasis: text("denial_legal_basis"),
  
  // Delivery
  responseMethod: varchar("response_method", { length: 50 }), // "email", "secure_portal", "mail", "in_person"
  responseDeliveredAt: timestamp("response_delivered_at"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

