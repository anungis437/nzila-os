import { pgTable, uuid, varchar, text, timestamp, integer, decimal, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { collectiveAgreements } from "./collective-agreements-schema";

// Enums for CBA Clauses
export const clauseTypeEnum = pgEnum("clause_type", [
  "wages_compensation",
  "benefits_insurance",
  "working_conditions",
  "grievance_arbitration",
  "seniority_promotion",
  "health_safety",
  "union_rights",
  "management_rights",
  "duration_renewal",
  "vacation_leave",
  "hours_scheduling",
  "disciplinary_procedures",
  "training_development",
  "pension_retirement",
  "overtime",
  "job_security",
  "technological_change",
  "workplace_rights",
  "other"
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "monetary_amount",
  "percentage",
  "date",
  "time_period",
  "job_position",
  "location",
  "person",
  "organization",
  "legal_reference",
  "other"
]);

// Export type for ClauseType
export type ClauseType = typeof clauseTypeEnum.enumValues[number];

// Main CBA Clauses table
export const cbaClause = pgTable("cba_clauses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  cbaId: uuid("cba_id").notNull().references(() => collectiveAgreements.id, { onDelete: "cascade" }),
  
  // Clause identification
  clauseNumber: varchar("clause_number", { length: 50 }).notNull(),
  clauseType: clauseTypeEnum("clause_type").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  
  // Content
  content: text("content").notNull(),
  contentPlainText: text("content_plain_text"), // Stripped of formatting for search
  pageNumber: integer("page_number"),
  
  // Hierarchy and structure
  articleNumber: varchar("article_number", { length: 50 }),
  sectionHierarchy: jsonb("section_hierarchy").$type<string[]>(), // e.g., ["Article 12", "Section 12.3", "Subsection 12.3.2"]
  parentClauseId: uuid("parent_clause_id"),
  orderIndex: integer("order_index").notNull().default(0),
  
  // AI/Search capabilities
  embedding: text("embedding"), // Vector embedding as text (JSON array)
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 4 }), // Confidence in clause classification
  
  // Extracted entities (NER results)
  entities: jsonb("entities").$type<Array<{
    type: string;
    value: string;
    startOffset: number;
    endOffset: number;
    confidence: number;
  }>>(),
  
  // Analysis and metadata
  keyTerms: jsonb("key_terms").$type<string[]>(),
  relatedClauseIds: jsonb("related_clause_ids").$type<string[]>(),
  interpretationNotes: text("interpretation_notes"),
  
  // Usage tracking
  viewCount: integer("view_count").default(0),
  citationCount: integer("citation_count").default(0),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cbaIdx: index("cba_clauses_cba_idx").on(table.cbaId),
  typeIdx: index("cba_clauses_type_idx").on(table.clauseType),
  numberIdx: index("cba_clauses_number_idx").on(table.clauseNumber),
  parentIdx: index("cba_clauses_parent_idx").on(table.parentClauseId),
  confidenceIdx: index("cba_clauses_confidence_idx").on(table.confidenceScore),
}));

// Clause comparisons (for market analysis across CBAs)
export const clauseComparisons = pgTable("clause_comparisons", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  comparisonName: varchar("comparison_name", { length: 200 }).notNull(),
  clauseType: clauseTypeEnum("clause_type").notNull(),
  organizationId: uuid("organization_id").notNull(),
  
  // Clauses being compared
  clauseIds: jsonb("clause_ids").$type<string[]>().notNull(),
  
  // Comparison analysis
  analysisResults: jsonb("analysis_results").$type<{
    similarities: Array<{ description: string; clauseIds: string[] }>;
    differences: Array<{ description: string; clauseIds: string[]; impact: string }>;
    bestPractices: Array<{ description: string; clauseId: string; reason: string }>;
    recommendations: string[];
  }>(),
  
  // Market benchmarking
  industryAverage: jsonb("industry_average"),
  marketPosition: varchar("market_position", { length: 50 }), // above_market, at_market, below_market
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
}, (table) => ({
  organizationIdx: index("clause_comparisons_organization_idx").on(table.organizationId),
  typeIdx: index("clause_comparisons_type_idx").on(table.clauseType),
}));

// Wage progressions (specialized tracking for compensation clauses)
export const wageProgressions = pgTable("wage_progressions", {
  id: uuid("id").primaryKey().defaultRandom(),
  cbaId: uuid("cba_id").notNull().references(() => collectiveAgreements.id, { onDelete: "cascade" }),
  clauseId: uuid("clause_id").references(() => cbaClause.id, { onDelete: "set null" }),
  
  // Job classification
  classification: varchar("classification", { length: 200 }).notNull(),
  classificationCode: varchar("classification_code", { length: 50 }),
  
  // Wage structure
  step: integer("step").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  annualSalary: decimal("annual_salary", { precision: 12, scale: 2 }),
  
  // Dates
  effectiveDate: timestamp("effective_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  
  // Additional compensation
  premiums: jsonb("premiums").$type<Array<{
    type: string;
    amount: number;
    percentage?: number;
    conditions: string;
  }>>(),
  
  // Metadata
  notes: text("notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cbaIdx: index("wage_progressions_cba_idx").on(table.cbaId),
  clauseIdx: index("wage_progressions_clause_idx").on(table.clauseId),
  classificationIdx: index("wage_progressions_classification_idx").on(table.classification),
  effectiveDateIdx: index("wage_progressions_effective_date_idx").on(table.effectiveDate),
}));

// Benefit comparisons (specialized tracking for benefits clauses)
export const benefitComparisons = pgTable("benefit_comparisons", {
  id: uuid("id").primaryKey().defaultRandom(),
  cbaId: uuid("cba_id").notNull().references(() => collectiveAgreements.id, { onDelete: "cascade" }),
  clauseId: uuid("clause_id").references(() => cbaClause.id, { onDelete: "set null" }),
  
  benefitType: varchar("benefit_type", { length: 100 }).notNull(), // health, dental, vision, life, disability, etc.
  benefitName: varchar("benefit_name", { length: 200 }).notNull(),
  
  // Coverage details
  coverageDetails: jsonb("coverage_details").$type<{
    employeeCoverage: number | string;
    dependentCoverage?: number | string;
    employerPaidPercentage: number;
    employeePaidPercentage: number;
    waitingPeriod?: string;
    eligibilityCriteria?: string[];
    exclusions?: string[];
  }>(),
  
  // Costs
  monthlyPremium: decimal("monthly_premium", { precision: 10, scale: 2 }),
  annualCost: decimal("annual_cost", { precision: 12, scale: 2 }),
  
  // Comparison
  industryBenchmark: varchar("industry_benchmark", { length: 50 }), // excellent, good, average, below_average
  
  effectiveDate: timestamp("effective_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cbaIdx: index("benefit_comparisons_cba_idx").on(table.cbaId),
  typeIdx: index("benefit_comparisons_type_idx").on(table.benefitType),
}));

