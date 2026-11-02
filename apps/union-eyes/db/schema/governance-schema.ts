// Golden Share Governance Schema
// Class B Special Voting Share for mission protection
// Reserved Matters veto rights and 5-year sunset clause

import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, date, varchar } from "drizzle-orm/pg-core";

/**
 * Golden Shares Table
 * Tracks Class B Special Voting Share held by Union Member Representative Council
 * 51% voting power on Reserved Matters, 5-year sunset clause
 */
export const goldenShares = pgTable("golden_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Share details
  shareClass: text("share_class").notNull().default("B"), // Always "B" for Special Voting Share
  certificateNumber: text("certificate_number").unique().notNull(),
  issueDate: date("issue_date").notNull(),
  
  // Holder (Union Member Representative Council)
  holderType: text("holder_type").notNull().default("council"), // 'council' for Union Member Representative Council
  councilMembers: jsonb("council_members").notNull(), // JSON: [{ name, term_start, term_end, elected_date }]
  
  // Voting power
  votingPowerReservedMatters: integer("voting_power_reserved_matters").notNull().default(51), // 51% on Reserved Matters
  votingPowerOrdinaryMatters: integer("voting_power_ordinary_matters").notNull().default(1), // 1% on ordinary matters
  
  // Economic rights (minimal to avoid tax burden)
  redemptionValue: integer("redemption_value").notNull().default(1), // $1 redemption value (nominal)
  dividendRights: boolean("dividend_rights").notNull().default(false), // No dividend rights
  
  // Sunset clause (5-year mission compliance)
  sunsetClauseActive: boolean("sunset_clause_active").notNull().default(true),
  sunsetClauseDuration: integer("sunset_clause_duration").notNull().default(5), // Years
  consecutiveComplianceYears: integer("consecutive_compliance_years").notNull().default(0), // 0-5
  sunsetTriggeredDate: date("sunset_triggered_date"), // When 5 years of compliance achieved
  conversionDate: date("conversion_date"), // When converted to ordinary share
  
  // Status
  status: text("status").notNull().default("active"), // 'active' | 'sunset_triggered' | 'converted' | 'dormant'
  
  // Transfer restrictions
  transferable: boolean("transferable").notNull().default(false), // Non-transferable except to successor Council
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Reserved Matter Votes Table
 * Tracks voting on Reserved Matters requiring Class B approval
 * Reserved Matters: Mission changes, sale/control changes, data governance, major contracts
 */
export const reservedMatterVotes = pgTable("reserved_matter_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Reserved Matter details
  matterType: text("matter_type").notNull(), // 'mission_change' | 'sale_control' | 'data_governance' | 'major_contract'
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  // Proposal details
  proposedBy: varchar("proposed_by", { length: 255 }).notNull(), // Board member/shareholder who proposed
  proposedDate: timestamp("proposed_date").notNull(),
  votingDeadline: timestamp("voting_deadline").notNull(),
  
  // Matter specifics
  matterDetails: jsonb("matter_details").notNull(), // JSON varies by type
  // mission_change: { old_mission, new_mission, rationale }
  // sale_control: { buyer, ownership_percent, price, terms }
  // data_governance: { data_type, recipient, purpose, duration }
  // major_contract: { counterparty, value, term, scope }
  
  // Class A (ordinary) vote
  classAVotesFor: integer("class_a_votes_for").default(0),
  classAVotesAgainst: integer("class_a_votes_against").default(0),
  classAAbstain: integer("class_a_abstain").default(0),
  classATotalVotes: integer("class_a_total_votes").notNull(),
  classAPercentFor: integer("class_a_percent_for").default(0), // 0-100
  
  // Class B (golden share) vote
  classBVote: text("class_b_vote"), // null | 'approve' | 'veto'
  classBVoteDate: timestamp("class_b_vote_date"),
  classBVoteRationale: text("class_b_vote_rationale"),
  classBCouncilMembersVoting: jsonb("class_b_council_members_voting"), // JSON: [{ member, vote, rationale }]
  
  // Voting outcome
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'vetoed' | 'withdrawn'
  finalDecision: text("final_decision"), // 'approved' | 'rejected_class_a' | 'vetoed_class_b'
  decisionDate: timestamp("decision_date"),
  
  // Implementation
  implemented: boolean("implemented").default(false),
  implementationDate: timestamp("implementation_date"),
  implementationNotes: text("implementation_notes"),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Mission Audits Table
 * Annual independent audits to verify mission compliance (for sunset clause)
 * Must pass 90%+ union revenue, 80%+ member satisfaction, zero data violations
 */
export const missionAudits = pgTable("mission_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Audit period
  auditYear: integer("audit_year").notNull(),
  auditPeriodStart: date("audit_period_start").notNull(),
  auditPeriodEnd: date("audit_period_end").notNull(),
  
  // Auditor
  auditorFirm: text("auditor_firm").notNull(),
  auditorName: text("auditor_name").notNull(),
  auditorCertification: text("auditor_certification"), // e.g., 'CPA', 'B Corp Auditor'
  auditDate: date("audit_date").notNull(),
  
  // Mission compliance criteria
  unionRevenuePercent: integer("union_revenue_percent").notNull(), // % of revenue from unions
  memberSatisfactionPercent: integer("member_satisfaction_percent").notNull(), // % member satisfaction (survey)
  dataViolations: integer("data_violations").notNull().default(0), // Count of data governance violations
  
  // Compliance thresholds (from shareholder agreement)
  unionRevenueThreshold: integer("union_revenue_threshold").notNull().default(90), // 90%
  memberSatisfactionThreshold: integer("member_satisfaction_threshold").notNull().default(80), // 80%
  dataViolationsThreshold: integer("data_violations_threshold").notNull().default(0), // Zero violations
  
  // Pass/fail
  unionRevenuePass: boolean("union_revenue_pass").notNull(),
  memberSatisfactionPass: boolean("member_satisfaction_pass").notNull(),
  dataViolationsPass: boolean("data_violations_pass").notNull(),
  overallPass: boolean("overall_pass").notNull(), // All three must pass
  
  // Supporting data
  totalRevenue: integer("total_revenue"), // CAD
  unionRevenue: integer("union_revenue"), // CAD from unions
  memberSurveySampleSize: integer("member_survey_sample_size"),
  memberSurveyResponses: integer("member_survey_responses"),
  dataViolationDetails: jsonb("data_violation_details"), // JSON: [{ date, type, severity, resolved }]
  
  // Audit opinion
  auditorOpinion: text("auditor_opinion").notNull(), // 'compliant' | 'non_compliant' | 'qualified'
  auditorNotes: text("auditor_notes"),
  correctiveActions: jsonb("corrective_actions"), // JSON: [{ action, deadline, status }]
  
  // Sunset clause impact
  impactsConsecutiveCompliance: boolean("impacts_consecutive_compliance").notNull(),
  consecutiveYearsAfterAudit: integer("consecutive_years_after_audit"), // Running count after this audit
  
  // Document storage
  auditReportPdfUrl: text("audit_report_pdf_url"),
  supportingDocumentsUrls: jsonb("supporting_documents_urls"),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Governance Events Table
 * Log of significant governance events (share creation, votes, audits, sunset)
 */
export const governanceEvents = pgTable("governance_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Event details
  eventType: text("event_type").notNull(), // 'golden_share_issued' | 'reserved_matter_vote' | 'mission_audit' | 'sunset_triggered' | 'share_converted'
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  
  // Related orgs
  goldenShareId: uuid("golden_share_id"),
  reservedMatterVoteId: uuid("reserved_matter_vote_id"),
  missionAuditId: uuid("mission_audit_id"),
  
  // Event description
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  // Impact
  impact: text("impact"), // 'high' | 'medium' | 'low'
  impactDescription: text("impact_description"),
  
  // Stakeholders notified
  stakeholders: jsonb("stakeholders"), // JSON: ['board', 'council', 'investors', 'public']
  notificationsSent: boolean("notifications_sent").default(false),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 255 }),
});

/**
 * Council Elections Table
 * Elections for Union Member Representative Council (golden share holders)
 * 5 members, 2-year staggered terms
 */
export const councilElections = pgTable("council_elections", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Election details
  electionYear: integer("election_year").notNull(),
  electionDate: date("election_date").notNull(),
  positionsAvailable: integer("positions_available").notNull(), // Typically 2-3 (staggered)
  
  // Candidates
  candidates: jsonb("candidates").notNull(), // JSON: [{ name, union, platform, votes }]
  
  // Results
  winners: jsonb("winners").notNull(), // JSON: [{ name, union, votes, term_start, term_end }]
  totalVotes: integer("total_votes").notNull(),
  participationRate: integer("participation_rate"), // % of eligible members who voted
  
  // Election integrity
  verifiedBy: text("verified_by"), // Independent election auditor
  verificationDate: date("verification_date"),
  contestedResults: boolean("contested_results").default(false),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Type exports
export type GoldenShare = typeof goldenShares.$inferSelect;
export type NewGoldenShare = typeof goldenShares.$inferInsert;

export type ReservedMatterVote = typeof reservedMatterVotes.$inferSelect;
export type NewReservedMatterVote = typeof reservedMatterVotes.$inferInsert;

export type MissionAudit = typeof missionAudits.$inferSelect;
export type NewMissionAudit = typeof missionAudits.$inferInsert;

export type GovernanceEvent = typeof governanceEvents.$inferSelect;
export type NewGovernanceEvent = typeof governanceEvents.$inferInsert;

export type CouncilElection = typeof councilElections.$inferSelect;
export type NewCouncilElection = typeof councilElections.$inferInsert;

