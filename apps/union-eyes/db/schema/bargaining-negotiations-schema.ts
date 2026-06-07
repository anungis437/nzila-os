/**
 * Bargaining Negotiations Schema
 * 
 * Manages active negotiation processes including:
 * - Active bargaining rounds
 * - Union demands and management offers (proposals)
 * - Tentative agreements (pre-ratification)
 * - Negotiation session tracking
 * - Bargaining team members
 * 
 * Complements existing CBA management (ratified agreements, clauses, versions)
 * and bargaining notes (session notes from cba-intelligence-schema.ts)
 */

import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, index, boolean, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";
import { collectiveAgreements } from "./collective-agreements-schema";

// ============================================================================
// Enums
// ============================================================================

export const negotiationStatusEnum = pgEnum("negotiation_status", [
  "scheduled",       // Negotiation scheduled, not started
  "active",          // Currently in negotiations
  "impasse",         // Reached an impasse
  "conciliation",    // In conciliation/mediation
  "tentative",       // Tentative agreement reached
  "ratified",        // Membership ratified agreement
  "rejected",        // Membership rejected tentative agreement
  "strike_lockout",  // Strike or lockout in progress
  "completed",       // Process completed (CBA signed)
  "abandoned"        // Negotiations abandoned
]);

export const proposalTypeEnum = pgEnum("proposal_type", [
  "union_demand",       // Union's proposal/demand
  "management_offer",   // Management's counter-offer
  "joint_proposal",     // Joint proposal
  "mediator_proposal"   // Mediator's recommendation
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",           // Being drafted
  "submitted",       // Submitted to other party
  "under_review",    // Being reviewed
  "accepted",        // Accepted by both parties
  "rejected",        // Rejected
  "counter_offered", // Counter-offer made
  "withdrawn",       // Proposal withdrawn
  "superseded"       // Replaced by newer proposal
]);

export const negotiationSessionTypeEnum = pgEnum("negotiation_session_type", [
  "opening",         // Opening session
  "negotiation",     // Regular negotiation session
  "caucus",          // Internal caucus meeting
  "conciliation",    // Conciliation/mediation session
  "information",     // Information exchange session
  "closing",         // Closing/signing session
  "ratification"     // Ratification meeting
]);

export const teamRoleEnum = pgEnum("bargaining_team_role", [
  "chief_negotiator",
  "committee_member",
  "researcher",
  "note_taker",
  "subject_expert",
  "observer",
  "legal_counsel",
  "financial_advisor"
]);

// ============================================================================
// Main Tables
// ============================================================================

/**
 * Active Negotiations (Bargaining Rounds)
 * 
 * Tracks active negotiation processes from notice to ratification.
 * Links to collectiveAgreements for the expiring agreement and future ratified agreement.
 */
export const negotiations = pgTable("negotiations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  
  // Related agreements
  expiringCbaId: uuid("expiring_cba_id").references(() => collectiveAgreements.id, { onDelete: "set null" }),
  resultingCbaId: uuid("resulting_cba_id").references(() => collectiveAgreements.id, { onDelete: "set null" }),
  
  // Basic info
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  
  // Parties
  unionName: varchar("union_name", { length: 300 }).notNull(),
  unionLocal: varchar("union_local", { length: 100 }),
  employerName: varchar("employer_name", { length: 300 }).notNull(),
  bargainingUnitSize: integer("bargaining_unit_size"),
  
  // Key dates
  noticeGivenDate: timestamp("notice_given_date", { withTimezone: true }),
  firstSessionDate: timestamp("first_session_date", { withTimezone: true }),
  targetCompletionDate: timestamp("target_completion_date", { withTimezone: true }),
  tentativeAgreementDate: timestamp("tentative_agreement_date", { withTimezone: true }),
  ratificationDate: timestamp("ratification_date", { withTimezone: true }),
  completionDate: timestamp("completion_date", { withTimezone: true }),
  
  // Status
  status: negotiationStatusEnum("status").notNull().default("scheduled"),
  currentRound: integer("current_round").default(1),
  totalSessions: integer("total_sessions").default(0),
  
  // Issues and priorities
  keyIssues: jsonb("key_issues").$type<Array<{
    issue: string;
    priority: "high" | "medium" | "low";
    status: "unresolved" | "progress" | "resolved";
    notes?: string;
  }>>(),
  
  // Mandates and constraints
  strikeVotePassed: boolean("strike_vote_passed").default(false),
  strikeVoteDate: timestamp("strike_vote_date", { withTimezone: true }),
  strikeVoteYesPercent: decimal("strike_vote_yes_percent", { precision: 5, scale: 2 }),
  mandateExpiry: timestamp("mandate_expiry", { withTimezone: true }),
  
  // Costing
  estimatedCost: decimal("estimated_cost", { precision: 15, scale: 2 }),
  maximumCost: decimal("maximum_cost", { precision: 15, scale: 2 }),
  
  // Progress tracking
  progressSummary: text("progress_summary"),
  lastActivityDate: timestamp("last_activity_date", { withTimezone: true }),
  
  // Metadata
  tags: jsonb("tags").$type<string[]>(),
  confidentialityLevel: varchar("confidentiality_level", { length: 50 }).default("restricted"),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }),
}, (table) => ({
  organizationIdx: index("negotiations_organization_idx").on(table.organizationId),
  statusIdx: index("negotiations_status_idx").on(table.status),
  expiringCbaIdx: index("negotiations_expiring_cba_idx").on(table.expiringCbaId),
  firstSessionIdx: index("negotiations_first_session_idx").on(table.firstSessionDate),
}));

/**
 * Bargaining Proposals
 * 
 * Union demands, management offers, and counter-proposals.
 * Can reference specific CBA clauses for amendments.
 */
export const bargainingProposals = pgTable("bargaining_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").notNull().references(() => negotiations.id, { onDelete: "cascade" }),
  
  // Proposal details
  proposalNumber: varchar("proposal_number", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  proposalType: proposalTypeEnum("proposal_type").notNull(),
  status: proposalStatusEnum("status").notNull().default("draft"),
  
  // Related clause (if amending existing clause)
  relatedClauseId: uuid("related_clause_id"),
  clauseCategory: varchar("clause_category", { length: 100 }), // wages, hours, benefits, etc.
  
  // Content
  currentLanguage: text("current_language"), // Current CBA language
  proposedLanguage: text("proposed_language").notNull(), // New proposed language
  rationale: text("rationale"), // Why this change is being proposed
  
  // Costing
  estimatedCost: decimal("estimated_cost", { precision: 15, scale: 2 }),
  costingNotes: text("costing_notes"),
  
  // Position tracking
  unionPosition: varchar("union_position", { length: 50 }), // must_have, important, tradeable, dropped
  managementPosition: varchar("management_position", { length: 50 }), // accepted, rejected, counter, pending
  
  // Timeline
  submittedDate: timestamp("submitted_date", { withTimezone: true }),
  responseDeadline: timestamp("response_deadline", { withTimezone: true }),
  resolvedDate: timestamp("resolved_date", { withTimezone: true }),
  
  // Related proposals (for tracking counter-offers)
  parentProposalId: uuid("parent_proposal_id").references((): PgColumn<unknown> => bargainingProposals.id as PgColumn<unknown>, { onDelete: "set null" }),
  supersededById: uuid("superseded_by_id").references((): PgColumn<unknown> => bargainingProposals.id as PgColumn<unknown>, { onDelete: "set null" }),
  
  // Attachments
  attachments: jsonb("attachments").$type<Array<{
    filename: string;
    url: string;
    fileType: string;
    uploadedAt: string;
  }>>(),
  
  // Notes
  internalNotes: text("internal_notes"), // Union-only notes
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }),
}, (table) => ({
  negotiationIdx: index("bargaining_proposals_negotiation_idx").on(table.negotiationId),
  statusIdx: index("bargaining_proposals_status_idx").on(table.status),
  typeIdx: index("bargaining_proposals_type_idx").on(table.proposalType),
  categoryIdx: index("bargaining_proposals_category_idx").on(table.clauseCategory),
  proposalNumberIdx: index("bargaining_proposals_number_idx").on(table.proposalNumber),
}));

/**
 * Tentative Agreements
 * 
 * Agreed-upon language before membership ratification.
 * Becomes part of the final CBA if ratified.
 */
export const tentativeAgreements = pgTable("tentative_agreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").notNull().references(() => negotiations.id, { onDelete: "cascade" }),
  
  // Agreement details
  agreementNumber: varchar("agreement_number", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  clauseCategory: varchar("clause_category", { length: 100 }).notNull(),
  
  // Content
  agreedLanguage: text("agreed_language").notNull(),
  previousLanguage: text("previous_language"),
  
  // Related items
  relatedProposalIds: jsonb("related_proposal_ids").$type<string[]>(),
  relatedClauseId: uuid("related_clause_id"),
  
  // Ratification
  requiresRatification: boolean("requires_ratification").default(true),
  ratified: boolean("ratified").default(false),
  ratificationDate: timestamp("ratification_date", { withTimezone: true }),
  ratificationVoteYes: integer("ratification_vote_yes"),
  ratificationVoteNo: integer("ratification_vote_no"),
  ratificationNotes: text("ratification_notes"),
  
  // Costing
  annualCost: decimal("annual_cost", { precision: 15, scale: 2 }),
  implementationCost: decimal("implementation_cost", { precision: 15, scale: 2 }),
  costingApproved: boolean("costing_approved").default(false),
  
  // Dates
  agreedDate: timestamp("agreed_date", { withTimezone: true }).notNull().defaultNow(),
  effectiveDate: timestamp("effective_date", { withTimezone: true }),
  
  // Sign-off
  unionSignedBy: varchar("union_signed_by", { length: 255 }),
  unionSignedDate: timestamp("union_signed_date", { withTimezone: true }),
  employerSignedBy: varchar("employer_signed_by", { length: 255 }),
  employerSignedDate: timestamp("employer_signed_date", { withTimezone: true }),
  
  // Attachments
  attachments: jsonb("attachments").$type<Array<{
    filename: string;
    url: string;
    fileType: string;
    uploadedAt: string;
  }>>(),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }),
}, (table) => ({
  negotiationIdx: index("tentative_agreements_negotiation_idx").on(table.negotiationId),
  categoryIdx: index("tentative_agreements_category_idx").on(table.clauseCategory),
  ratifiedIdx: index("tentative_agreements_ratified_idx").on(table.ratified),
}));

/**
 * Negotiation Sessions
 * 
 * Tracks individual bargaining meetings/sessions.
 * Complements bargainingNotes (from cba-intelligence-schema) for detailed notes.
 */
export const negotiationSessions = pgTable("negotiation_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").notNull().references(() => negotiations.id, { onDelete: "cascade" }),
  
  // Session details
  sessionNumber: integer("session_number").notNull(),
  sessionType: negotiationSessionTypeEnum("session_type").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  
  // Scheduling
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  scheduledEndDate: timestamp("scheduled_end_date", { withTimezone: true }),
  actualStartDate: timestamp("actual_start_date", { withTimezone: true }),
  actualEndDate: timestamp("actual_end_date", { withTimezone: true }),
  location: varchar("location", { length: 300 }),
  isVirtual: boolean("is_virtual").default(false),
  meetingLink: text("meeting_link"),
  
  // Participation
  unionAttendees: jsonb("union_attendees").$type<Array<{
    memberId?: string;
    name: string;
    role: string;
  }>>(),
  employerAttendees: jsonb("employer_attendees").$type<Array<{
    name: string;
    title: string;
  }>>(),
  
  // Agenda and outcomes
  agenda: jsonb("agenda").$type<Array<{
    item: string;
    estimatedDuration: number;
    presenter?: string;
  }>>(),
  outcomes: jsonb("outcomes").$type<Array<{
    item: string;
    outcome: string;
    followUpRequired?: boolean;
  }>>(),
  
  // Summary
  summary: text("summary"),
  nextSteps: text("next_steps"),
  
  // Related items
  proposalsDiscussed: jsonb("proposals_discussed").$type<string[]>(), // Proposal IDs
  bargainingNoteId: uuid("bargaining_note_id"), // Link to detailed notes
  
  // Status
  status: varchar("status", { length: 50 }).default("scheduled"), // scheduled, in_progress, completed, cancelled
  cancelled: boolean("cancelled").default(false),
  cancellationReason: text("cancellation_reason"),
  
  // Attachments
  attachments: jsonb("attachments").$type<Array<{
    filename: string;
    url: string;
    fileType: string;
    uploadedAt: string;
  }>>(),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }),
}, (table) => ({
  negotiationIdx: index("negotiation_sessions_negotiation_idx").on(table.negotiationId),
  scheduledDateIdx: index("negotiation_sessions_scheduled_idx").on(table.scheduledDate),
  sessionNumberIdx: index("negotiation_sessions_number_idx").on(table.sessionNumber),
  statusIdx: index("negotiation_sessions_status_idx").on(table.status),
}));

/**
 * Bargaining Team Members
 * 
 * Tracks who is on the bargaining committee for each negotiation.
 */
export const bargainingTeamMembers = pgTable("bargaining_team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").notNull().references(() => negotiations.id, { onDelete: "cascade" }),
  
  // Member details
  memberId: uuid("member_id"), // Link to profiles if member
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  
  // Role
  role: teamRoleEnum("role").notNull(),
  isChief: boolean("is_chief").default(false),
  
  // Affiliation
  organization: varchar("organization", { length: 300 }),
  title: varchar("title", { length: 200 }),
  worksite: varchar("worksite", { length: 200 }),
  
  // Availability
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }),
  
  // Special skills/expertise
  expertise: jsonb("expertise").$type<string[]>(), // e.g., ["benefits", "pensions", "health_safety"]
  notes: text("notes"),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  negotiationIdx: index("bargaining_team_negotiation_idx").on(table.negotiationId),
  memberIdx: index("bargaining_team_member_idx").on(table.memberId),
  roleIdx: index("bargaining_team_role_idx").on(table.role),
  activeIdx: index("bargaining_team_active_idx").on(table.isActive),
}));

// ============================================================================
// Relations
// ============================================================================

export const negotiationsRelations = relations(negotiations, ({ many, one }) => ({
  proposals: many(bargainingProposals),
  tentativeAgreements: many(tentativeAgreements),
  sessions: many(negotiationSessions),
  teamMembers: many(bargainingTeamMembers),
  expiringCba: one(collectiveAgreements, {
    fields: [negotiations.expiringCbaId],
    references: [collectiveAgreements.id],
    relationName: "expiringCba"
  }),
  resultingCba: one(collectiveAgreements, {
    fields: [negotiations.resultingCbaId],
    references: [collectiveAgreements.id],
    relationName: "resultingCba"
  }),
}));

export const bargainingProposalsRelations = relations(bargainingProposals, ({ one, many }) => ({
  negotiation: one(negotiations, {
    fields: [bargainingProposals.negotiationId],
    references: [negotiations.id],
  }),
  parentProposal: one(bargainingProposals, {
    fields: [bargainingProposals.parentProposalId],
    references: [bargainingProposals.id],
    relationName: "proposalHierarchy"
  }),
  counterOffers: many(bargainingProposals, {
    relationName: "proposalHierarchy"
  }),
}));

export const tentativeAgreementsRelations = relations(tentativeAgreements, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [tentativeAgreements.negotiationId],
    references: [negotiations.id],
  }),
}));

export const negotiationSessionsRelations = relations(negotiationSessions, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [negotiationSessions.negotiationId],
    references: [negotiations.id],
  }),
}));

export const bargainingTeamMembersRelations = relations(bargainingTeamMembers, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [bargainingTeamMembers.negotiationId],
    references: [negotiations.id],
  }),
}));
