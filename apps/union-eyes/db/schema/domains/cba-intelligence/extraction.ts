import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cbaIntelDocuments } from "./documents";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const extractionMethodEnum = pgEnum("cba_intel_extraction_method", [
  "deterministic",
  "llm_gpt4",
  "llm_gpt4_vision",
  "hybrid",
  "manual",
]);

export const extractionStatusEnum = pgEnum("cba_intel_extraction_status", [
  "pending",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
]);

export const clauseFamilyEnum = pgEnum("cba_intel_clause_family", [
  "wages",
  "premiums",
  "hours_of_work",
  "overtime",
  "scheduling",
  "leave_general",
  "vacation",
  "sick_leave",
  "health_benefits",
  "pension",
  "mileage_travel",
  "remote_hybrid",
  "grievance",
  "arbitration",
  "seniority",
  "job_posting_bidding",
  "health_safety",
  "training",
  "discipline_discharge",
  "contracting_out",
  "union_rights",
  "management_rights",
  "layoffs_recall",
  "technological_change",
  "equity_harassment",
  "other",
]);

// ---------------------------------------------------------------------------
// Extraction Runs
// ---------------------------------------------------------------------------

export const cbaIntelExtractionRuns = pgTable(
  "cba_intel_extraction_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => cbaIntelDocuments.id, { onDelete: "cascade" }),

    // Method
    extractionMethod: extractionMethodEnum("extraction_method").notNull(),
    modelVersion: varchar("model_version", { length: 60 }),
    promptVersion: varchar("prompt_version", { length: 60 }),

    // Status
    status: extractionStatusEnum("status").notNull().default("pending"),
    findingsCount: integer("findings_count").default(0),
    errorCount: integer("error_count").default(0),
    errors: jsonb("errors").$type<Array<{ field: string; message: string }>>(),

    // Timing
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),

    // Audit
    triggeredBy: varchar("triggered_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_runs_doc").on(t.documentId),
    index("idx_cba_intel_runs_status").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Extraction Findings (individual extracted facts)
// ---------------------------------------------------------------------------

export const cbaIntelFindings = pgTable(
  "cba_intel_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    extractionRunId: uuid("extraction_run_id")
      .notNull()
      .references(() => cbaIntelExtractionRuns.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => cbaIntelDocuments.id, { onDelete: "cascade" }),

    // Classification
    findingType: varchar("finding_type", { length: 60 }).notNull(),
    clauseFamily: clauseFamilyEnum("clause_family"),

    // Content
    label: varchar("label", { length: 300 }).notNull(),
    value: text("value"),
    valueStructured: jsonb("value_structured").$type<Record<string, unknown>>(),

    // Provenance
    sourceSpanStart: integer("source_span_start"),
    sourceSpanEnd: integer("source_span_end"),
    sourceSection: varchar("source_section", { length: 200 }),
    sourcePageNumber: integer("source_page_number"),
    citationText: text("citation_text"),

    // Confidence
    confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull(),
    isInferred: boolean("is_inferred").notNull().default(false),
    extractionMethod: extractionMethodEnum("extraction_method").notNull(),

    // Hash for dedup
    contentHash: varchar("content_hash", { length: 64 }).notNull(),

    // Review linkage (set when review is completed)
    reviewStatus: varchar("review_status", { length: 30 }).default("pending_review"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_findings_run").on(t.extractionRunId),
    index("idx_cba_intel_findings_doc").on(t.documentId),
    index("idx_cba_intel_findings_type").on(t.findingType),
    index("idx_cba_intel_findings_family").on(t.clauseFamily),
    index("idx_cba_intel_findings_hash").on(t.contentHash),
    index("idx_cba_intel_findings_review").on(t.reviewStatus),
  ],
);

// ---------------------------------------------------------------------------
// Extracted Agreements (structured agreement metadata from findings)
// ---------------------------------------------------------------------------

export const cbaIntelAgreements = pgTable(
  "cba_intel_agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => cbaIntelDocuments.id, { onDelete: "cascade" }),
    extractionRunId: uuid("extraction_run_id")
      .references(() => cbaIntelExtractionRuns.id),

    // Normalized identity
    title: varchar("title", { length: 500 }).notNull(),
    employerNormalized: varchar("employer_normalized", { length: 300 }).notNull(),
    unionNormalized: varchar("union_normalized", { length: 300 }).notNull(),
    localEntity: varchar("local_entity", { length: 200 }),
    bargainingUnitDescription: text("bargaining_unit_description"),

    // Jurisdiction
    jurisdiction: varchar("jurisdiction", { length: 40 }).notNull(),
    sector: varchar("sector", { length: 200 }),

    // Dates
    effectiveDate: timestamp("effective_date", { withTimezone: true }),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    ratificationDate: timestamp("ratification_date", { withTimezone: true }),
    termMonths: integer("term_months"),

    // Coverage
    employeeCoverage: integer("employee_coverage"),

    // Content flags
    isSummaryOnly: boolean("is_summary_only").notNull().default(false),
    hasFullText: boolean("has_full_text").notNull().default(false),

    // Status
    extractionStatus: varchar("extraction_status", { length: 30 }).notNull().default("extracted"),
    reviewStatus: varchar("review_status", { length: 30 }).notNull().default("pending_review"),

    // Confidence
    overallConfidence: decimal("overall_confidence", { precision: 4, scale: 3 }).notNull(),

    // Provenance
    sourceId: uuid("source_id").references(() => cbaIntelSources.id),
    sourceUrl: text("source_url"),
    contentHash: varchar("content_hash", { length: 64 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_agreements_doc").on(t.documentId),
    index("idx_cba_intel_agreements_jurisdiction").on(t.jurisdiction),
    index("idx_cba_intel_agreements_employer").on(t.employerNormalized),
    index("idx_cba_intel_agreements_union").on(t.unionNormalized),
    index("idx_cba_intel_agreements_expiry").on(t.expiryDate),
    index("idx_cba_intel_agreements_review").on(t.reviewStatus),
  ],
);

// ---------------------------------------------------------------------------
// Extracted Wage Adjustments
// ---------------------------------------------------------------------------

export const cbaIntelWageAdjustments = pgTable(
  "cba_intel_wage_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => cbaIntelAgreements.id, { onDelete: "cascade" }),
    findingId: uuid("finding_id")
      .references(() => cbaIntelFindings.id),

    // Adjustment details
    effectiveDate: timestamp("effective_date", { withTimezone: true }),
    year: integer("year"),
    adjustmentType: varchar("adjustment_type", { length: 60 }).notNull(),
    adjustmentPercent: decimal("adjustment_percent", { precision: 6, scale: 3 }),
    adjustmentFlat: decimal("adjustment_flat", { precision: 12, scale: 2 }),
    description: text("description"),

    // Classification
    classification: varchar("classification", { length: 200 }),
    step: integer("step"),

    // Provenance
    confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull(),
    isInferred: boolean("is_inferred").notNull().default(false),
    citationText: text("citation_text"),
    reviewStatus: varchar("review_status", { length: 30 }).default("pending_review"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_wages_agreement").on(t.agreementId),
    index("idx_cba_intel_wages_year").on(t.year),
    index("idx_cba_intel_wages_type").on(t.adjustmentType),
  ],
);

// ---------------------------------------------------------------------------
// Extracted Clauses (linked to clause families)
// ---------------------------------------------------------------------------

export const cbaIntelClauses = pgTable(
  "cba_intel_clauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => cbaIntelAgreements.id, { onDelete: "cascade" }),
    findingId: uuid("finding_id")
      .references(() => cbaIntelFindings.id),

    clauseFamily: clauseFamilyEnum("clause_family").notNull(),
    clauseNumber: varchar("clause_number", { length: 50 }),
    title: varchar("title", { length: 500 }),
    summary: text("summary"),
    rawText: text("raw_text"),

    // Provenance
    confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull(),
    isInferred: boolean("is_inferred").notNull().default(false),
    contentHash: varchar("content_hash", { length: 64 }),
    reviewStatus: varchar("review_status", { length: 30 }).default("pending_review"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_clauses_agreement").on(t.agreementId),
    index("idx_cba_intel_clauses_family").on(t.clauseFamily),
    index("idx_cba_intel_clauses_review").on(t.reviewStatus),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

import { cbaIntelSources } from "./source-registry";

export const cbaIntelExtractionRunsRelations = relations(
  cbaIntelExtractionRuns,
  ({ one, many }) => ({
    document: one(cbaIntelDocuments, {
      fields: [cbaIntelExtractionRuns.documentId],
      references: [cbaIntelDocuments.id],
    }),
    findings: many(cbaIntelFindings),
  }),
);

export const cbaIntelFindingsRelations = relations(cbaIntelFindings, ({ one }) => ({
  extractionRun: one(cbaIntelExtractionRuns, {
    fields: [cbaIntelFindings.extractionRunId],
    references: [cbaIntelExtractionRuns.id],
  }),
  document: one(cbaIntelDocuments, {
    fields: [cbaIntelFindings.documentId],
    references: [cbaIntelDocuments.id],
  }),
}));

export const cbaIntelAgreementsRelations = relations(
  cbaIntelAgreements,
  ({ one, many }) => ({
    document: one(cbaIntelDocuments, {
      fields: [cbaIntelAgreements.documentId],
      references: [cbaIntelDocuments.id],
    }),
    source: one(cbaIntelSources, {
      fields: [cbaIntelAgreements.sourceId],
      references: [cbaIntelSources.id],
    }),
    wageAdjustments: many(cbaIntelWageAdjustments),
    clauses: many(cbaIntelClauses),
  }),
);

export const cbaIntelWageAdjustmentsRelations = relations(
  cbaIntelWageAdjustments,
  ({ one }) => ({
    agreement: one(cbaIntelAgreements, {
      fields: [cbaIntelWageAdjustments.agreementId],
      references: [cbaIntelAgreements.id],
    }),
  }),
);

export const cbaIntelClausesRelations = relations(cbaIntelClauses, ({ one }) => ({
  agreement: one(cbaIntelAgreements, {
    fields: [cbaIntelClauses.agreementId],
    references: [cbaIntelAgreements.id],
  }),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelExtractionRun = typeof cbaIntelExtractionRuns.$inferSelect;
export type NewCbaIntelExtractionRun = typeof cbaIntelExtractionRuns.$inferInsert;
export type CbaIntelFinding = typeof cbaIntelFindings.$inferSelect;
export type NewCbaIntelFinding = typeof cbaIntelFindings.$inferInsert;
export type CbaIntelAgreement = typeof cbaIntelAgreements.$inferSelect;
export type NewCbaIntelAgreement = typeof cbaIntelAgreements.$inferInsert;
export type CbaIntelWageAdjustment = typeof cbaIntelWageAdjustments.$inferSelect;
export type NewCbaIntelWageAdjustment = typeof cbaIntelWageAdjustments.$inferInsert;
export type CbaIntelClause = typeof cbaIntelClauses.$inferSelect;
export type NewCbaIntelClause = typeof cbaIntelClauses.$inferInsert;
export type ClauseFamily = typeof clauseFamilyEnum.enumValues[number];
