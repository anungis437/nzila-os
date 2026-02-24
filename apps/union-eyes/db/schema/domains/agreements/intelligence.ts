import { pgTable, uuid, varchar, text, timestamp, integer, decimal, jsonb, pgEnum, index, boolean } from "drizzle-orm/pg-core";
import { collectiveAgreements } from "./collective-agreements";
import { cbaClause } from "./clauses";

// Enums for Arbitration and Legal
export const tribunalTypeEnum = pgEnum("tribunal_type", [
  "fpslreb", // Federal Public Sector Labour Relations and Employment Board
  "provincial_labour_board",
  "private_arbitrator",
  "court_federal",
  "court_provincial",
  "other"
]);

export const decisionTypeEnum = pgEnum("decision_type", [
  "grievance",
  "unfair_practice",
  "certification",
  "judicial_review",
  "interpretation",
  "scope_bargaining",
  "other"
]);

export const outcomeEnum = pgEnum("outcome", [
  "grievance_upheld",
  "grievance_denied",
  "partial_success",
  "dismissed",
  "withdrawn",
  "settled"
]);

export const precedentValueEnum = pgEnum("precedent_value", [
  "high",
  "medium",
  "low"
]);

// Export enum types
export type DecisionTypeEnum = typeof decisionTypeEnum.enumValues[number];
export type OutcomeEnum = typeof outcomeEnum.enumValues[number];
export type PrecedentValueEnum = typeof precedentValueEnum.enumValues[number];

// Arbitration Decisions table
export const arbitrationDecisions = pgTable("arbitration_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Case identification
  caseNumber: varchar("case_number", { length: 100 }).notNull().unique(),
  caseTitle: varchar("case_title", { length: 500 }).notNull(),
  tribunal: tribunalTypeEnum("tribunal").notNull(),
  decisionType: decisionTypeEnum("decision_type").notNull(),
  
  // Decision details
  decisionDate: timestamp("decision_date", { withTimezone: true }).notNull(),
  filingDate: timestamp("filing_date", { withTimezone: true }),
  hearingDate: timestamp("hearing_date", { withTimezone: true }),
  
  // Adjudicators
  arbitrator: varchar("arbitrator", { length: 200 }).notNull(),
  panelMembers: jsonb("panel_members").$type<string[]>(),
  
  // Parties
  grievor: varchar("grievor", { length: 300 }),
  union: varchar("union", { length: 300 }).notNull(),
  employer: varchar("employer", { length: 300 }).notNull(),
  
  // Outcome and remedy
  outcome: outcomeEnum("outcome").notNull(),
  remedy: jsonb("remedy").$type<{
    monetaryAward?: number;
    currency?: string;
    reinstatement?: boolean;
    correctiveAction?: string;
    policyChange?: string;
    backPay?: { amount: number; period: string };
    interestAwarded?: boolean;
    costsAwarded?: { amount: number; party: string };
    otherRemedies?: string[];
  }>(),
  
  // Legal and precedent analysis
  keyFindings: jsonb("key_findings").$type<string[]>(),
  issueTypes: jsonb("issue_types").$type<string[]>(), // e.g., ["termination", "just_cause", "progressive_discipline"]
  precedentValue: precedentValueEnum("precedent_value").notNull(),
  
  // Citations and references
  legalCitations: jsonb("legal_citations").$type<Array<{
    citation: string;
    type: string; // statute, regulation, case_law
    relevance: string;
  }>>(),
  relatedDecisions: jsonb("related_decisions").$type<string[]>(), // Array of decision IDs
  cbaReferences: jsonb("cba_references").$type<Array<{
    cbaId: string;
    clauseIds?: string[];
    relevance: string;
  }>>(),
  
  // Content
  fullText: text("full_text").notNull(),
  summary: text("summary"),
  headnote: text("headnote"),
  precedentSummary: text("precedent_summary"),
  reasoning: text("reasoning"),
  keyFacts: text("key_facts"),
  
  // Classification
  sector: varchar("sector", { length: 100 }),
  jurisdiction: varchar("jurisdiction", { length: 50 }),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  
  // Analytics
  citationCount: integer("citation_count").default(0),
  viewCount: integer("view_count").default(0),
  
  // AI capabilities
  embedding: text("embedding"), // Vector embedding as text
  
  // Public access
  isPublic: boolean("is_public").default(true),
  accessRestrictions: text("access_restrictions"),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  importedFrom: varchar("imported_from", { length: 200 }), // Source database/system
}, (table) => ({
  tribunalIdx: index("arbitration_tribunal_idx").on(table.tribunal),
  decisionDateIdx: index("arbitration_decision_date_idx").on(table.decisionDate),
  arbitratorIdx: index("arbitration_arbitrator_idx").on(table.arbitrator),
  outcomeIdx: index("arbitration_outcome_idx").on(table.outcome),
  precedentIdx: index("arbitration_precedent_idx").on(table.precedentValue),
  jurisdictionIdx: index("arbitration_jurisdiction_idx").on(table.jurisdiction),
  caseNumberIdx: index("arbitration_case_number_idx").on(table.caseNumber),
}));

// Arbitrator profiles (for predictive analytics)
export const arbitratorProfiles = pgTable("arbitrator_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  name: varchar("name", { length: 200 }).notNull().unique(),
  
  // Statistics
  totalDecisions: integer("total_decisions").notNull().default(0),
  grievorSuccessRate: decimal("grievor_success_rate", { precision: 5, scale: 2 }), // Percentage
  employerSuccessRate: decimal("employer_success_rate", { precision: 5, scale: 2 }),
  
  // Monetary awards
  averageAwardAmount: decimal("average_award_amount", { precision: 12, scale: 2 }),
  medianAwardAmount: decimal("median_award_amount", { precision: 12, scale: 2 }),
  highestAwardAmount: decimal("highest_award_amount", { precision: 12, scale: 2 }),
  
  // Remedies
  commonRemedies: jsonb("common_remedies").$type<Array<{
    remedy: string;
    count: number;
    percentage: number;
  }>>(),
  
  // Specializations
  specializations: jsonb("specializations").$type<string[]>(), // e.g., ["termination", "harassment", "wage_disputes"]
  primarySectors: jsonb("primary_sectors").$type<string[]>(),
  jurisdictions: jsonb("jurisdictions").$type<string[]>(),
  
  // Decision timeframes
  avgDecisionDays: integer("avg_decision_days"),
  medianDecisionDays: integer("median_decision_days"),
  decisionRangeMin: integer("decision_range_min"),
  decisionRangeMax: integer("decision_range_max"),
  
  // Patterns and trends
  decisionPatterns: jsonb("decision_patterns").$type<{
    reinstatementRate?: number;
    backPayAwardRate?: number;
    costsAwardedRate?: number;
    settlementEncouragementRate?: number;
  }>(),
  
  // Contact and background
  contactInfo: jsonb("contact_info").$type<{
    email?: string;
    phone?: string;
    website?: string;
    firm?: string;
  }>(),
  biography: text("biography"),
  credentials: jsonb("credentials").$type<string[]>(),
  
  // Active status
  isActive: boolean("is_active").default(true),
  lastDecisionDate: timestamp("last_decision_date", { withTimezone: true }),
  
  // Analytics
  updated: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("arbitrator_profiles_name_idx").on(table.name),
  activeIdx: index("arbitrator_profiles_active_idx").on(table.isActive),
}));

// Bargaining notes (corporate knowledge preservation)
export const bargainingNotes = pgTable("bargaining_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  cbaId: uuid("cba_id").references(() => collectiveAgreements.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull(),
  
  // Session details
  sessionDate: timestamp("session_date", { withTimezone: true }).notNull(),
  sessionType: varchar("session_type", { length: 100 }).notNull(), // negotiation, ratification, grievance_meeting, strategy
  sessionNumber: integer("session_number"),
  
  // Content
  title: varchar("title", { length: 300 }).notNull(),
  content: text("content").notNull(),
  
  // Participants
  attendees: jsonb("attendees").$type<Array<{
    name: string;
    role: string;
    organization: string;
  }>>(),
  
  // Related items
  relatedClauseIds: jsonb("related_clause_ids").$type<string[]>(),
  relatedDecisionIds: jsonb("related_decision_ids").$type<string[]>(),
  
  // Metadata
  tags: jsonb("tags").$type<string[]>(),
  confidentialityLevel: varchar("confidentiality_level", { length: 50 }).default("internal"), // public, internal, restricted, confidential
  
  // AI capabilities
  embedding: text("embedding"),
  keyInsights: jsonb("key_insights").$type<string[]>(),
  
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
  cbaIdx: index("bargaining_notes_cba_idx").on(table.cbaId),
  organizationIdx: index("bargaining_notes_organization_idx").on(table.organizationId),
  sessionDateIdx: index("bargaining_notes_session_date_idx").on(table.sessionDate),
  sessionTypeIdx: index("bargaining_notes_session_type_idx").on(table.sessionType),
}));

// CBA Footnotes (Bible Gateway-style hyperlinks between clauses)
export const cbaFootnotes = pgTable("cba_footnotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  sourceClauseId: uuid("source_clause_id").notNull().references(() => cbaClause.id, { onDelete: "cascade" }),
  targetClauseId: uuid("target_clause_id").references(() => cbaClause.id, { onDelete: "cascade" }),
  targetDecisionId: uuid("target_decision_id").references(() => arbitrationDecisions.id, { onDelete: "cascade" }),
  
  // Footnote details
  footnoteNumber: integer("footnote_number").notNull(),
  footnoteText: text("footnote_text").notNull(),
  context: text("context"), // Why this cross-reference is relevant
  
  // Link type
  linkType: varchar("link_type", { length: 50 }).notNull(), // see_also, contradicts, clarifies, supersedes, precedent, example
  
  // Position in source
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  
  // Usage
  clickCount: integer("click_count").default(0),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
}, (table) => ({
  sourceIdx: index("cba_footnotes_source_idx").on(table.sourceClauseId),
  targetClauseIdx: index("cba_footnotes_target_clause_idx").on(table.targetClauseId),
  targetDecisionIdx: index("cba_footnotes_target_decision_idx").on(table.targetDecisionId),
}));

// Claim-to-precedent analysis (connects claims module to CBA intelligence)
export const claimPrecedentAnalysis = pgTable("claim_precedent_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: uuid("claim_id").notNull(), // References claims.claim_id
  
  // Matching decisions
  precedentMatches: jsonb("precedent_matches").$type<Array<{
    decisionId: string;
    relevanceScore: number;
    matchingFactors: string[];
    divergingFactors?: string[];
  }>>(),
  
  // Success probability
  successProbability: decimal("success_probability", { precision: 5, scale: 2 }),
  confidenceLevel: varchar("confidence_level", { length: 50 }), // high, medium, low
  
  // Strategy suggestions
  suggestedStrategy: text("suggested_strategy"),
  potentialRemedies: jsonb("potential_remedies").$type<Array<{
    remedy: string;
    likelihood: string;
    estimatedValue?: number;
  }>>(),
  
  // Arbitrator insights
  arbitratorTendencies: jsonb("arbitrator_tendencies").$type<{
    arbitratorId?: string;
    arbitratorName?: string;
    successRate?: number;
    avgAward?: number;
    relevantPatterns?: string[];
  }>(),
  
  // Similar CBAs
  relevantCbaClauseIds: jsonb("relevant_cba_clause_ids").$type<string[]>(),
  
  // Audit
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
  analyzedBy: varchar("analyzed_by", { length: 50 }).notNull().default("ai_system"),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  claimIdx: index("claim_precedent_claim_idx").on(table.claimId),
}));

