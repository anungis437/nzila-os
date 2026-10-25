import { pgTable, uuid, text, timestamp, varchar, jsonb, boolean, decimal } from "drizzle-orm/pg-core";

/**
 * Founder & Executive Conflict of Interest Schema
 * Blind trust requirements, conflict disclosure, arms-length verification
 */

// Conflict of Interest Policy (global settings)
export const conflictOfInterestPolicy = pgTable("conflict_of_interest_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Policy settings
  policyEnabled: boolean("policy_enabled").notNull().default(true),
  blindTrustRequired: boolean("blind_trust_required").notNull().default(true), // Founders/execs must use blind trust
  
  // Disclosure requirements
  annualDisclosureRequired: boolean("annual_disclosure_required").notNull().default(true),
  disclosureDeadline: varchar("disclosure_deadline", { length: 10 }).notNull().default("01-31"), // January 31 annually
  
  // Transaction thresholds
  significantInterestThreshold: decimal("significant_interest_threshold", { precision: 15, scale: 2 }).notNull().default("5000.00"), // >$5k requires disclosure
  armsLengthVerificationRequired: boolean("arms_length_verification_required").notNull().default(true),
  
  // Covered roles
  coveredRoles: jsonb("covered_roles").notNull().default(['founder', 'president', 'vice_president', 'treasurer', 'secretary', 'executive_director', 'board_member']), // Roles requiring blind trust
  
  // Review process
  reviewCommitteeRequired: boolean("review_committee_required").notNull().default(true),
  minimumReviewers: varchar("minimum_reviewers", { length: 2 }).notNull().default("2"),
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }),
});

// Blind trust registry (founders/execs must divest control)
export const blindTrustRegistry = pgTable("blind_trust_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Trust holder (founder/exec)
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  fullName: text("full_name").notNull(),
  role: varchar("role", { length: 50 }).notNull(), // "founder", "president", "treasurer", etc.
  
  // Trust status
  trustStatus: varchar("trust_status", { length: 20 }).notNull().default("required"), // "required", "established", "verified", "non_compliant"
  trustEstablishedDate: timestamp("trust_established_date"),
  
  // Trustee information
  trusteeName: text("trustee_name"), // Independent trustee managing assets
  trusteeContact: text("trustee_contact"),
  trusteeRelationship: varchar("trustee_relationship", { length: 50 }), // "law_firm", "accounting_firm", "financial_advisor"
  
  // Trust details
  trustType: varchar("trust_type", { length: 50 }), // "revocable", "irrevocable", "discretionary"
  trustDocument: text("trust_document"), // URL/path to trust agreement
  trustAccountNumber: varchar("trust_account_number", { length: 100 }),
  
  // Assets in trust
  assetsTransferred: jsonb("assets_transferred"), // Array of assets placed in blind trust
  estimatedValue: decimal("estimated_value", { precision: 15, scale: 2 }),
  
  // Verification
  verifiedBy: varchar("verified_by", { length: 255 }),
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
  
  // Annual review
  lastReviewDate: timestamp("last_review_date"),
  nextReviewDue: timestamp("next_review_due"),
  
  // Compliance
  compliant: boolean("compliant").notNull().default(false),
  complianceNotes: text("compliance_notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Conflict of interest disclosures (annual + ad-hoc)
export const conflictDisclosures = pgTable("conflict_disclosures", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Discloser
  userId: varchar("user_id", { length: 255 }).notNull(),
  fullName: text("full_name").notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  
  // Disclosure type
  disclosureType: varchar("disclosure_type", { length: 50 }).notNull(), // "annual", "transaction_specific", "ongoing_relationship"
  disclosureYear: varchar("disclosure_year", { length: 4 }), // For annual disclosures
  
  // Conflict details
  conflictType: varchar("conflict_type", { length: 50 }).notNull(), // "financial_interest", "family_relationship", "outside_employment", "vendor_relationship"
  conflictDescription: text("conflict_description").notNull(),
  
  // Parties involved
  relatedParties: jsonb("related_parties"), // Array of related individuals/orgs
  relatedTransactionIds: jsonb("related_transaction_ids"), // If transaction-specific
  
  // Financial interest
  financialInterestAmount: decimal("financial_interest_amount", { precision: 15, scale: 2 }),
  ownershipPercentage: decimal("ownership_percentage", { precision: 5, scale: 2 }),
  
  // Mitigation plan
  mitigationPlan: text("mitigation_plan"), // How conflict will be managed
  recusalRequired: boolean("recusal_required").notNull().default(false),
  recusalDocumented: boolean("recusal_documented").notNull().default(false),
  
  // Review status
  reviewStatus: varchar("review_status", { length: 20 }).notNull().default("pending"), // "pending", "under_review", "approved", "rejected", "requires_action"
  reviewNotes: text("review_notes"),
  
  // Reviewers
  reviewedBy: jsonb("reviewed_by"), // Array of reviewer user IDs
  reviewCompletedAt: timestamp("review_completed_at"),
  
  // Annual disclosure tracking
  disclosureDeadline: timestamp("disclosure_deadline"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  overdue: boolean("overdue").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Arms-length transaction verification
export const armsLengthVerification = pgTable("arms_length_verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Transaction details
  transactionId: uuid("transaction_id").notNull().unique(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // "procurement", "service_contract", "property_sale", "loan"
  transactionAmount: decimal("transaction_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Parties
  fromParty: uuid("from_party").notNull(),
  toParty: uuid("to_party").notNull(),
  
  // Relationship check
  relationshipExists: boolean("relationship_exists").notNull().default(false),
  relationshipType: varchar("relationship_type", { length: 50 }), // "family", "business_partner", "co_investor", "employer_employee"
  relationshipDescription: text("relationship_description"),
  
  // Arms-length determination
  armsLengthStatus: varchar("arms_length_status", { length: 20 }).notNull().default("pending"), // "pending", "arms_length", "not_arms_length", "requires_review"
  armsLengthJustification: text("arms_length_justification"),
  
  // Verification process
  verificationMethod: varchar("verification_method", { length: 50 }), // "comparable_transactions", "independent_appraisal", "competitive_bidding"
  comparableTransactions: jsonb("comparable_transactions"), // Array of similar arms-length transactions
  
  // Review
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewedAt: timestamp("reviewed_at"),
  reviewDecision: varchar("review_decision", { length: 20 }), // "approved", "rejected", "conditional_approval"
  reviewNotes: text("review_notes"),
  
  // Compliance
  compliant: boolean("compliant").notNull().default(false),
  complianceNotes: text("compliance_notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Recusal tracking (when conflicts require stepping aside)
export const recusalTracking = pgTable("recusal_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Recusal details
  userId: varchar("user_id", { length: 255 }).notNull(),
  fullName: text("full_name").notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  
  // Recusal context
  recusalType: varchar("recusal_type", { length: 50 }).notNull(), // "vote", "decision", "discussion", "meeting"
  recusalReason: text("recusal_reason").notNull(),
  
  // Related orgs
  relatedMatter: text("related_matter"), // Description of matter requiring recusal
  relatedMeetingId: uuid("related_meeting_id"),
  relatedVoteId: uuid("related_vote_id"),
  relatedTransactionId: uuid("related_transaction_id"),
  
  // Recusal documentation
  recusalDocumented: boolean("recusal_documented").notNull().default(false),
  documentationUrl: text("documentation_url"),
  documentedBy: varchar("documented_by", { length: 255 }),
  documentedAt: timestamp("documented_at"),
  
  // Recusal period
  recusalStartDate: timestamp("recusal_start_date").notNull(),
  recusalEndDate: timestamp("recusal_end_date"),
  
  // Verification
  verifiedBy: varchar("verified_by", { length: 255 }),
  verifiedAt: timestamp("verified_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Conflict of Interest Audit Log
export const conflictAuditLog = pgTable("conflict_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Action
  actionType: varchar("action_type", { length: 50 }).notNull(), // "disclosure_submitted", "blind_trust_established", "recusal_documented", "arms_length_verified"
  actionDescription: text("action_description").notNull(),
  
  // Subject
  subjectUserId: varchar("subject_user_id", { length: 255 }), // User affected by action
  relatedDisclosureId: uuid("related_disclosure_id"),
  relatedTransactionId: uuid("related_transaction_id"),
  
  // Actor
  performedBy: varchar("performed_by", { length: 255 }).notNull(),
  performedByRole: varchar("performed_by_role", { length: 50 }),
  
  // Compliance impact
  complianceImpact: varchar("compliance_impact", { length: 20 }), // "none", "low", "medium", "high", "critical"
  
  // Metadata
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

