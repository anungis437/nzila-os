/**
 * Phase 5B: Inter-Union Features - Shared Clause Library Schema
 * Created: November 19, 2025
 * Purpose: Enable cross-union collaboration through shared CBA clauses
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
import { organizations } from "../schema-organizations";
import { cba } from "./cba-schema";
import { cbaClause } from "./cba-clauses-schema";

// ============================================================================
// SHARED CLAUSE LIBRARY
// ============================================================================

export const sharedClauseLibrary = pgTable("shared_clause_library", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Source information
  sourceOrganizationId: uuid("source_organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sourceCbaId: uuid("source_cba_id")
    .references(() => cba.id),
  originalClauseId: uuid("original_clause_id"), // FK to cba_clauses (not enforced yet)
  
  // Clause content
  clauseNumber: varchar("clause_number", { length: 50 }),
  clauseTitle: varchar("clause_title", { length: 500 }).notNull(),
  clauseText: text("clause_text").notNull(),
  clauseType: varchar("clause_type", { length: 100 }).notNull(), // wages, benefits, hours, etc.
  
  // Anonymization
  isAnonymized: boolean("is_anonymized").default(false),
  originalEmployerName: varchar("original_employer_name", { length: 200 }),
  anonymizedEmployerName: varchar("anonymized_employer_name", { length: 200 }),
  
  // Sharing controls
  sharingLevel: varchar("sharing_level", { length: 50 }).notNull().default("private"),
    // private, federation, congress, public
  sharedWithOrgIds: uuid("shared_with_org_ids").array(),
  
  // Metadata
  effectiveDate: date("effective_date"),
  expiryDate: date("expiry_date"),
  sector: varchar("sector", { length: 100 }), // public, private, education, healthcare, etc.
  province: varchar("province", { length: 2 }), // ON, QC, BC, AB, MB, SK, etc.
  
  // Engagement metrics
  viewCount: integer("view_count").default(0),
  citationCount: integer("citation_count").default(0),
  comparisonCount: integer("comparison_count").default(0),
  
  // Versioning
  version: integer("version").default(1),
  previousVersionId: uuid("previous_version_id")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .references((): any => sharedClauseLibrary.id),
  
  // Audit
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("idx_shared_clauses_org").on(table.sourceOrganizationId),
  typeIdx: index("idx_shared_clauses_type").on(table.clauseType),
  sharingIdx: index("idx_shared_clauses_sharing").on(table.sharingLevel),
  sectorIdx: index("idx_shared_clauses_sector").on(table.sector),
  provinceIdx: index("idx_shared_clauses_province").on(table.province),
}));

// Tags for categorization
export const clauseLibraryTags = pgTable("clause_library_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  clauseId: uuid("clause_id")
    .notNull()
    .references(() => sharedClauseLibrary.id, { onDelete: "cascade" }),
  tagName: varchar("tag_name", { length: 100 }).notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  clauseIdx: index("idx_clause_tags_clause").on(table.clauseId),
  nameIdx: index("idx_clause_tags_name").on(table.tagName),
}));

// Comparison history
export const clauseComparisonsHistory = pgTable("clause_comparisons_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  clauseIds: uuid("clause_ids").array().notNull(),
  comparisonNotes: text("comparison_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_clause_comparisons_user").on(table.userId),
  orgIdx: index("idx_clause_comparisons_org").on(table.organizationId),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const sharedClauseLibraryRelations = relations(sharedClauseLibrary, ({ one, many }) => ({
  sourceOrganization: one(organizations, {
    fields: [sharedClauseLibrary.sourceOrganizationId],
    references: [organizations.id],
  }),
  sourceCba: one(cba, {
    fields: [sharedClauseLibrary.sourceCbaId],
    references: [cba.id],
  }),
  originalClause: one(cbaClause, {
    fields: [sharedClauseLibrary.originalClauseId],
    references: [cbaClause.id],
  }),
  previousVersion: one(sharedClauseLibrary, {
    fields: [sharedClauseLibrary.previousVersionId],
    references: [sharedClauseLibrary.id],
  }),
  tags: many(clauseLibraryTags),
}));

export const clauseLibraryTagsRelations = relations(clauseLibraryTags, ({ one }) => ({
  clause: one(sharedClauseLibrary, {
    fields: [clauseLibraryTags.clauseId],
    references: [sharedClauseLibrary.id],
  }),
}));

export const clauseComparisonsHistoryRelations = relations(clauseComparisonsHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [clauseComparisonsHistory.organizationId],
    references: [organizations.id],
  }),
}));

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type SharedClause = typeof sharedClauseLibrary.$inferSelect;
export type NewSharedClause = typeof sharedClauseLibrary.$inferInsert;

export type ClauseLibraryTag = typeof clauseLibraryTags.$inferSelect;
export type NewClauseLibraryTag = typeof clauseLibraryTags.$inferInsert;

export type ClauseComparison = typeof clauseComparisonsHistory.$inferSelect;
export type NewClauseComparison = typeof clauseComparisonsHistory.$inferInsert;

// Sharing level enum
export type SharingLevel = "private" | "federation" | "congress" | "public";

// Clause type enum (common types)
export type ClauseType = 
  | "wages"
  | "benefits"
  | "hours_of_work"
  | "overtime"
  | "vacation"
  | "sick_leave"
  | "grievance_procedure"
  | "discipline"
  | "seniority"
  | "health_safety"
  | "job_security"
  | "pension"
  | "other";

// Province codes (Canada)
export type ProvinceCode = 
  | "ON" | "QC" | "BC" | "AB" | "MB" | "SK" 
  | "NS" | "NB" | "PE" | "NL" | "YT" | "NT" | "NU";

// Sector types
export type SectorType = 
  | "public"
  | "private"
  | "education"
  | "healthcare"
  | "construction"
  | "manufacturing"
  | "retail"
  | "transportation"
  | "hospitality"
  | "other";

