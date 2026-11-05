import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean, date } from "drizzle-orm/pg-core";

/**
 * Certification & License Management Schema
 * Union staff certifications, license tracking, renewal deadlines
 */

// Certification types registry
export const certificationTypes = pgTable("certification_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Certification details
  certificationName: text("certification_name").notNull(), // "Labour Relations Officer", "Health & Safety Rep", "Arbitrator"
  certificationCode: varchar("certification_code", { length: 50 }).notNull().unique(),
  issuingAuthority: text("issuing_authority").notNull(), // "CIRB", "Provincial Labour Board", "WSIB"
  
  // Requirements
  requiresRenewal: boolean("requires_renewal").notNull().default(true),
  renewalFrequencyMonths: varchar("renewal_frequency_months", { length: 10 }), // "12", "24", "36"
  continuingEducationRequired: boolean("continuing_education_required").notNull().default(false),
  ceHoursRequired: varchar("ce_hours_required", { length: 10 }), // Annual CE hours
  
  // Applicability
  requiredForRoles: jsonb("required_for_roles"), // Array of role names
  mandatory: boolean("mandatory").notNull().default(false),
  
  // Documentation
  description: text("description"),
  applicationUrl: text("application_url"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Staff member certifications
export const staffCertifications = pgTable("staff_certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Staff member
  userId: varchar("user_id", { length: 255 }).notNull(),
  fullName: text("full_name").notNull(),
  role: varchar("role", { length: 100 }).notNull(),
  
  // Certification
  certificationTypeId: uuid("certification_type_id").notNull(),
  certificationNumber: varchar("certification_number", { length: 100 }),
  
  // Dates
  issuedDate: date("issued_date").notNull(),
  expiryDate: date("expiry_date"),
  lastRenewalDate: date("last_renewal_date"),
  nextRenewalDue: date("next_renewal_due"),
  
  // Status
  status: varchar("status", { length: 20 }).notNull().default("active"), // "active", "expired", "suspended", "revoked", "pending_renewal"
  
  // Documents
  certificateDocument: text("certificate_document"), // URL to certificate file
  verificationDocument: text("verification_document"),
  
  // Verification
  verifiedBy: varchar("verified_by", { length: 255 }),
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
  
  // Compliance
  compliant: boolean("compliant").notNull().default(true),
  complianceNotes: text("compliance_notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Continuing education tracking
export const continuingEducation = pgTable("continuing_education", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Staff member
  userId: varchar("user_id", { length: 255 }).notNull(),
  certificationId: uuid("certification_id").notNull(),
  
  // Course details
  courseTitle: text("course_title").notNull(),
  courseProvider: text("course_provider").notNull(),
  courseDate: date("course_date").notNull(),
  
  // Credits
  ceHoursEarned: varchar("ce_hours_earned", { length: 10 }).notNull(),
  ceCategory: varchar("ce_category", { length: 50 }), // "labour_law", "health_safety", "arbitration"
  
  // Documentation
  certificateOfCompletion: text("certificate_of_completion"),
  verifiedBy: varchar("verified_by", { length: 255 }),
  verifiedAt: timestamp("verified_at"),
  
  // Period
  applicablePeriodStart: date("applicable_period_start"),
  applicablePeriodEnd: date("applicable_period_end"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// License renewals tracking
export const licenseRenewals = pgTable("license_renewals", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Certification being renewed
  certificationId: uuid("certification_id").notNull(),
  
  // Renewal details
  renewalYear: varchar("renewal_year", { length: 4 }).notNull(),
  renewalDueDate: date("renewal_due_date").notNull(),
  renewalSubmittedDate: date("renewal_submitted_date"),
  renewalApprovedDate: date("renewal_approved_date"),
  
  // Status
  renewalStatus: varchar("renewal_status", { length: 20 }).notNull().default("pending"), // "pending", "submitted", "approved", "rejected", "overdue"
  
  // Requirements checklist
  ceRequirementsMet: boolean("ce_requirements_met").notNull().default(false),
  feePaid: boolean("fee_paid").notNull().default(false),
  applicationComplete: boolean("application_complete").notNull().default(false),
  
  // Documents
  renewalApplication: text("renewal_application"),
  paymentReceipt: text("payment_receipt"),
  approvalLetter: text("approval_letter"),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Certification expiry alerts
export const certificationAlerts = pgTable("certification_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Certification
  certificationId: uuid("certification_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  
  // Alert details
  alertType: varchar("alert_type", { length: 50 }).notNull(), // "90_day_warning", "30_day_warning", "expired", "ce_hours_low"
  alertDate: timestamp("alert_date").notNull().defaultNow(),
  expiryDate: date("expiry_date"),
  daysUntilExpiry: varchar("days_until_expiry", { length: 10 }),
  
  // Notification
  notificationSent: boolean("notification_sent").notNull().default(false),
  notificationSentAt: timestamp("notification_sent_at"),
  notificationMethod: varchar("notification_method", { length: 20 }), // "email", "sms", "in_app"
  
  // Resolution
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 255 }),
  resolutionNotes: text("resolution_notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Certification compliance reports
export const certificationComplianceReports = pgTable("certification_compliance_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Report details
  reportDate: date("report_date").notNull(),
  reportPeriod: varchar("report_period", { length: 20 }).notNull(), // "2026-Q1", "2026-01"
  
  // Compliance statistics
  totalStaff: varchar("total_staff", { length: 10 }).notNull(),
  totalCertificationsRequired: varchar("total_certifications_required", { length: 10 }).notNull(),
  totalCertificationsCurrent: varchar("total_certifications_current", { length: 10 }).notNull(),
  totalCertificationsExpired: varchar("total_certifications_expired", { length: 10 }).notNull(),
  totalCertificationsPendingRenewal: varchar("total_certifications_pending_renewal", { length: 10 }).notNull(),
  
  // CE hours
  totalCEHoursRequired: varchar("total_ce_hours_required", { length: 10 }),
  totalCEHoursCompleted: varchar("total_ce_hours_completed", { length: 10 }),
  
  // Compliance rate
  complianceRate: varchar("compliance_rate", { length: 10 }), // Percentage
  
  // Details
  expiredCertifications: jsonb("expired_certifications"), // Array of expired cert IDs
  upcomingRenewals: jsonb("upcoming_renewals"), // Array of certs expiring in 90 days
  
  // Report metadata
  generatedBy: varchar("generated_by", { length: 255 }),
  reportFormat: varchar("report_format", { length: 20 }).default("pdf"), // "pdf", "excel", "json"
  reportUrl: text("report_url"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Certification audit log
export const certificationAuditLog = pgTable("certification_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Action
  actionType: varchar("action_type", { length: 50 }).notNull(), // "certification_issued", "certification_renewed", "certification_expired", "ce_hours_added"
  actionDescription: text("action_description").notNull(),
  
  // Subject
  certificationId: uuid("certification_id"),
  userId: varchar("user_id", { length: 255 }),
  
  // Actor
  performedBy: varchar("performed_by", { length: 255 }).notNull(),
  performedByRole: varchar("performed_by_role", { length: 50 }),
  
  // Compliance impact
  complianceImpact: varchar("compliance_impact", { length: 20 }), // "none", "low", "medium", "high", "critical"
  
  // Metadata
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

