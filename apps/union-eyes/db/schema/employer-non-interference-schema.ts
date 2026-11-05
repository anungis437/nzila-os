import { pgTable, text, timestamp, boolean, jsonb, uuid } from "drizzle-orm/pg-core";

/**
 * Employer Non-Interference Schema
 * Enforces firewall between employer and union data
 * Prevents employer access to union-only information (strike plans, membership lists, internal discussions)
 * Compliance: Labour Relations Act firewall requirements
 */

// Data classification and access rules
export const dataClassificationPolicy = pgTable("data_classification_policy", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  policyName: text("policy_name").notNull(), // e.g., "Employer Data Firewall Policy"
  policyDescription: text("policy_description"),
  effectiveDate: timestamp("effective_date", { withTimezone: true }).notNull(),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  enforceStrictSeparation: boolean("enforce_strict_separation").notNull().default(true), // No employer access to union data
  allowBargainingUnitRoster: boolean("allow_bargaining_unit_roster").default(true), // Employer can see who's in bargaining unit
  allowGreivanceParticipation: boolean("allow_greivance_participation").default(true), // Employer can participate in grievances (the Django column keeps its original spelling)
  blockStrikePlans: boolean("block_strike_plans").notNull().default(true), // Employer never sees strike planning
  blockMembershipLists: boolean("block_membership_lists").notNull().default(true), // Employer can't access full member lists
  blockInternalDiscussions: boolean("block_internal_discussions").notNull().default(true), // Employer excluded from union discussions
  approvedBy: text("approved_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Data classification registry
export const dataClassificationRegistry = pgTable("data_classification_registry", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  dataType: text("data_type").notNull(), // "strike_plan", "membership_list", "grievance", "collective_agreement", "wage_data"
  classificationLevel: text("classification_level").notNull(), // "union_only", "shared", "employer_accessible"
  accessibleByEmployer: boolean("accessible_by_employer").notNull().default(false),
  accessibleByUnion: boolean("accessible_by_union").notNull().default(true),
  requiresJustification: boolean("requires_justification").default(false), // Require justification for employer access requests
  dataDescription: text("data_description"),
  legalBasis: text("legal_basis"), // Legal basis for classification (Labour Relations Act section)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Firewall access rules (who can access what)
export const firewallAccessRules = pgTable("firewall_access_rules", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  ruleName: text("rule_name").notNull(),
  dataTypeId: uuid("data_type_id").references(() => dataClassificationRegistry.id).notNull(),
  userRole: text("user_role").notNull(), // "employer_admin", "union_admin", "union_member", "employer_supervisor"
  accessPermitted: boolean("access_permitted").notNull().default(false),
  accessLevel: text("access_level"), // "read", "write", "none"
  justificationRequired: boolean("justification_required").default(false),
  requiresApproval: boolean("requires_approval").default(false),
  approverRole: text("approver_role"), // Who must approve access requests
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Access attempt log (all employer access attempts to union data)
export const employerAccessAttempts = pgTable("employer_access_attempts", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  attemptTimestamp: timestamp("attempt_timestamp", { withTimezone: true }).notNull().defaultNow(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  userRole: text("user_role").notNull(),
  dataTypeRequested: text("data_type_requested").notNull(), // What data they tried to access
  dataTypeId: uuid("data_type_id").references(() => dataClassificationRegistry.id),
  accessGranted: boolean("access_granted").notNull().default(false),
  denialReason: text("denial_reason"), // "employer_firewall", "insufficient_permissions", "data_classified_union_only"
  justificationProvided: text("justification_provided"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  flaggedForReview: boolean("flagged_for_review").default(false), // Flag suspicious access attempts
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
});

// Access justification and approval workflow
export const accessJustificationRequests = pgTable("access_justification_requests", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  requestDate: timestamp("request_date", { withTimezone: true }).notNull().defaultNow(),
  requestedBy: text("requested_by").notNull(), // User requesting access
  requestedByEmail: text("requested_by_email").notNull(),
  requestedByRole: text("requested_by_role").notNull(),
  dataTypeRequested: text("data_type_requested").notNull(),
  dataTypeId: uuid("data_type_id").references(() => dataClassificationRegistry.id),
  justification: text("justification").notNull(), // Why employer needs access to union data
  businessPurpose: text("business_purpose"), // Legitimate business need
  requestStatus: text("request_status").notNull().default("pending"), // "pending", "approved", "denied"
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewDecision: text("review_decision"), // "approved", "denied", "escalated"
  reviewNotes: text("review_notes"),
  approvalExpiryDate: timestamp("approval_expiry_date", { withTimezone: true }), // Temporary access only
  accessGrantedAt: timestamp("access_granted_at", { withTimezone: true }),
  accessRevokedAt: timestamp("access_revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Union-only data tags (mark data as union-exclusive)
export const unionOnlyDataTags = pgTable("union_only_data_tags", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  resourceType: text("resource_type").notNull(), // "document", "database_table", "file", "message", "discussion"
  resourceId: text("resource_id").notNull(), // ID of the resource being tagged
  resourceName: text("resource_name"),
  unionOnlyFlag: boolean("union_only_flag").notNull().default(true),
  employerAccessBlocked: boolean("employer_access_blocked").notNull().default(true),
  classificationLevel: text("classification_level").notNull().default("union_only"),
  taggedBy: text("tagged_by").notNull(),
  taggedAt: timestamp("tagged_at", { withTimezone: true }).notNull().defaultNow(),
  tagReason: text("tag_reason"), // Why this is union-only
  reviewDate: timestamp("review_date", { withTimezone: true }), // Periodic review of classification
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Firewall violation incidents
export const firewallViolations = pgTable("firewall_violations", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  violationDate: timestamp("violation_date", { withTimezone: true }).notNull().defaultNow(),
  violationType: text("violation_type").notNull(), // "unauthorized_access_attempt", "data_leak", "improper_sharing", "firewall_bypass"
  severity: text("severity").notNull(), // "critical", "high", "medium", "low"
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  userRole: text("user_role").notNull(),
  dataTypeAccessed: text("data_type_accessed"), // What union data was accessed
  dataTypeId: uuid("data_type_id").references(() => dataClassificationRegistry.id),
  violationDescription: text("violation_description").notNull(),
  systemDetected: boolean("system_detected").notNull().default(true), // Was it auto-detected or manually reported?
  detectedBy: text("detected_by"),
  incidentStatus: text("incident_status").notNull().default("open"), // "open", "investigating", "resolved", "escalated"
  investigatedBy: text("investigated_by"),
  investigationNotes: text("investigation_notes"),
  resolutionAction: text("resolution_action"), // "access_revoked", "warning_issued", "policy_updated", "legal_action"
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Firewall compliance audit log
export const firewallComplianceAudit = pgTable("firewall_compliance_audit", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  auditDate: timestamp("audit_date", { withTimezone: true }).notNull().defaultNow(),
  auditPeriod: text("audit_period").notNull(), // "Q1-2025", "2024", "January-2025"
  totalAccessAttempts: text("total_access_attempts").notNull(),
  totalEmployerAttempts: text("total_employer_attempts").notNull(),
  totalDeniedAccess: text("total_denied_access").notNull(),
  totalViolations: text("total_violations").notNull(),
  criticalViolations: text("critical_violations").notNull(),
  complianceRate: text("compliance_rate").notNull(), // % of access attempts that complied with firewall
  topViolatedDataTypes: jsonb("top_violated_data_types"), // Most frequently accessed union data by employers
  recommendedActions: text("recommended_actions"),
  auditedBy: text("audited_by").notNull(),
  auditReport: text("audit_report"), // Link to full audit report
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

