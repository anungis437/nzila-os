/**
 * Phase 5B: Inter-Union Features - Arbitration Precedents Schema
 * Created: November 19, 2025
 * Purpose: Shared arbitration case database with privacy controls
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  boolean, 
  integer, 
  date,
  timestamp,
  index
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../../../schema-organizations";
import { arbitrationDecisions } from "../../cba-intelligence-schema";

// ============================================================================
// ARBITRATION PRECEDENTS
// ============================================================================

export const arbitrationPrecedents = pgTable("arbitration_precedents", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Source information
  sourceOrganizationId: uuid("source_organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sourceDecisionId: uuid("source_decision_id")
    .references(() => arbitrationDecisions.id),
  
  // Case identification
  caseNumber: varchar("case_number", { length: 100 }),
  caseTitle: varchar("case_title", { length: 500 }).notNull(),
  decisionDate: date("decision_date").notNull(),
  
  // Parties (anonymized if needed)
  isPartiesAnonymized: boolean("is_parties_anonymized").default(false),
  unionName: varchar("union_name", { length: 200 }),
  employerName: varchar("employer_name", { length: 200 }),
  
  // Arbitrator
  arbitratorName: varchar("arbitrator_name", { length: 200 }).notNull(),
  jurisdiction: varchar("jurisdiction", { length: 50 }).notNull(),
  
  // Case details
  grievanceType: varchar("grievance_type", { length: 100 }).notNull(),
  issueSummary: text("issue_summary").notNull(),
  unionPosition: text("union_position"),
  employerPosition: text("employer_position"),
  
  // Decision
  outcome: varchar("outcome", { length: 50 }).notNull(),
  decisionSummary: text("decision_summary").notNull(),
  reasoning: text("reasoning"),
  
  // Precedent value
  precedentialValue: varchar("precedential_value", { length: 20 }).default('medium'),
  keyPrinciples: text("key_principles").array(),
  relatedLegislation: text("related_legislation"),
  citedCases: uuid("cited_cases").array(),
  citationCount: integer("citation_count").default(0),
  
  // Documents
  documentUrl: varchar("document_url", { length: 500 }),
  documentPath: varchar("document_path", { length: 500 }),
  redactedDocumentUrl: varchar("redacted_document_url", { length: 500 }),
  redactedDocumentPath: varchar("redacted_document_path", { length: 500 }),
  hasRedactedVersion: boolean("has_redacted_version").default(false),
  
  // Sharing controls
  sharingLevel: varchar("sharing_level", { length: 50 }).notNull().default("federation"),
  sharedWithOrgIds: uuid("shared_with_org_ids").array(),
  
  // Metadata
  sector: varchar("sector", { length: 100 }),
  province: varchar("province", { length: 2 }),
  
  // Engagement metrics
  viewCount: integer("view_count").default(0),
  downloadCount: integer("download_count").default(0),
  
  // Audit
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("idx_precedents_org").on(table.sourceOrganizationId),
  typeIdx: index("idx_precedents_type").on(table.grievanceType),
  outcomeIdx: index("idx_precedents_outcome").on(table.outcome),
  arbitratorIdx: index("idx_precedents_arbitrator").on(table.arbitratorName),
  jurisdictionIdx: index("idx_precedents_jurisdiction").on(table.jurisdiction),
  sharingIdx: index("idx_precedents_sharing").on(table.sharingLevel),
  levelIdx: index("idx_precedents_level").on(table.precedentialValue),
  sectorIdx: index("idx_precedents_sector").on(table.sector),
}));

// Tags for precedents
export const precedentTags = pgTable("precedent_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  precedentId: uuid("precedent_id")
    .notNull()
    .references(() => arbitrationPrecedents.id, { onDelete: "cascade" }),
  tagName: varchar("tag_name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  precedentIdx: index("idx_precedent_tags_precedent").on(table.precedentId),
  nameIdx: index("idx_precedent_tags_name").on(table.tagName),
}));

// Citation tracking
export const precedentCitations = pgTable("precedent_citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  precedentId: uuid("precedent_id")
    .notNull()
    .references(() => arbitrationPrecedents.id, { onDelete: "cascade" }),
  
  // Where it was cited
  citingClaimId: uuid("citing_claim_id"), // FK to claims (not enforced yet)
  citingPrecedentId: uuid("citing_precedent_id")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .references((): any => arbitrationPrecedents.id, { onDelete: "set null" }),
  citingOrganizationId: uuid("citing_organization_id")
    .notNull()
    .references(() => organizations.id),
  
  // Context of citation
  citationContext: text("citation_context"),
  citationType: varchar("citation_type", { length: 50 }),
  
  // Audit
  citedBy: varchar("cited_by", { length: 255 }).notNull(),
  citedAt: timestamp("cited_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  precedentIdx: index("idx_citations_precedent").on(table.precedentId),
  claimIdx: index("idx_citations_claim").on(table.citingClaimId),
  orgIdx: index("idx_citations_org").on(table.citingOrganizationId),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const arbitrationPrecedentsRelations = relations(arbitrationPrecedents, ({ one, many }) => ({
  sourceOrganization: one(organizations, {
    fields: [arbitrationPrecedents.sourceOrganizationId],
    references: [organizations.id],
  }),
  sourceDecision: one(arbitrationDecisions, {
    fields: [arbitrationPrecedents.sourceDecisionId],
    references: [arbitrationDecisions.id],
  }),
  tags: many(precedentTags),
  citations: many(precedentCitations),
}));

export const precedentTagsRelations = relations(precedentTags, ({ one }) => ({
  precedent: one(arbitrationPrecedents, {
    fields: [precedentTags.precedentId],
    references: [arbitrationPrecedents.id],
  }),
}));

export const precedentCitationsRelations = relations(precedentCitations, ({ one }) => ({
  precedent: one(arbitrationPrecedents, {
    fields: [precedentCitations.precedentId],
    references: [arbitrationPrecedents.id],
  }),
  // citingClaim relation commented out until claims table properly integrated
  citingOrganization: one(organizations, {
    fields: [precedentCitations.citingOrganizationId],
    references: [organizations.id],
  }),
}));

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type ArbitrationPrecedent = typeof arbitrationPrecedents.$inferSelect;
export type NewArbitrationPrecedent = typeof arbitrationPrecedents.$inferInsert;

export type PrecedentTag = typeof precedentTags.$inferSelect;
export type NewPrecedentTag = typeof precedentTags.$inferInsert;

export type PrecedentCitation = typeof precedentCitations.$inferSelect;
export type NewPrecedentCitation = typeof precedentCitations.$inferInsert;

// Outcome types
export type PrecedentOutcome = 
  | "grievance_upheld"
  | "denied"
  | "split_decision"
  | "withdrawn"
  | "settled";

// Precedent level
export type PrecedentLevel = "high" | "medium" | "low";

// Citation types
export type CitationType = 
  | "supporting" 
  | "distinguishing" 
  | "critical" 
  | "informational";

// Grievance types
export type GrievanceType = 
  | "discharge"
  | "discipline"
  | "wages"
  | "hours"
  | "benefits"
  | "health_safety"
  | "discrimination"
  | "harassment"
  | "classification"
  | "seniority"
  | "layoff"
  | "recall"
  | "other";

// Bargaining unit size
export type BargainingUnitSize = "small" | "medium" | "large";

// Jurisdiction (Canadian)
export type Jurisdiction = 
  | "Federal"
  | "ON" | "QC" | "BC" | "AB" | "MB" | "SK" 
  | "NS" | "NB" | "PE" | "NL" | "YT" | "NT" | "NU";

