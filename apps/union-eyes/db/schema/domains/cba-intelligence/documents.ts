import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cbaIntelSources } from "./source-registry";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const documentTypeEnum = pgEnum("cba_intel_doc_type", [
  "full_agreement",
  "settlement_summary",
  "wage_reopener",
  "memorandum_of_agreement",
  "arbitration_decision",
  "bulletin",
  "news_article",
  "statistical_report",
  "other",
]);

export const documentProcessingStatusEnum = pgEnum("cba_intel_doc_processing_status", [
  "fetched",
  "normalized",
  "parsed",
  "extracted",
  "reviewed",
  "failed",
]);

// ---------------------------------------------------------------------------
// Source Documents
// ---------------------------------------------------------------------------

export const cbaIntelDocuments = pgTable(
  "cba_intel_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => cbaIntelSources.id, { onDelete: "cascade" }),

    // Identity
    sourceUrl: text("source_url").notNull(),
    sourceDocId: varchar("source_doc_id", { length: 255 }),
    title: varchar("title", { length: 500 }),

    // Classification
    documentType: documentTypeEnum("document_type").notNull(),
    language: varchar("language", { length: 10 }).notNull().default("en"),

    // Content
    rawContent: text("raw_content"),
    normalizedText: text("normalized_text"),
    parsedMetadata: jsonb("parsed_metadata").$type<Record<string, unknown>>(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),

    // Processing
    processingStatus: documentProcessingStatusEnum("processing_status")
      .notNull()
      .default("fetched"),
    pageCount: integer("page_count"),
    wordCount: integer("word_count"),

    // Versioning
    version: integer("version").notNull().default(1),
    previousVersionId: uuid("previous_version_id"),
    isLatest: boolean("is_latest").notNull().default(true),

    // Freshness
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ingestionJobId: uuid("ingestion_job_id"),

    // Jurisdiction
    jurisdiction: varchar("jurisdiction", { length: 40 }),
    sector: varchar("sector", { length: 200 }),

    // Summary-only flag
    isSummaryOnly: boolean("is_summary_only").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_docs_source").on(t.sourceId),
    index("idx_cba_intel_docs_hash").on(t.contentHash),
    index("idx_cba_intel_docs_status").on(t.processingStatus),
    index("idx_cba_intel_docs_jurisdiction").on(t.jurisdiction),
    index("idx_cba_intel_docs_type").on(t.documentType),
    index("idx_cba_intel_docs_latest").on(t.isLatest),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const cbaIntelDocumentsRelations = relations(cbaIntelDocuments, ({ one, many }) => ({
  source: one(cbaIntelSources, {
    fields: [cbaIntelDocuments.sourceId],
    references: [cbaIntelSources.id],
  }),
  extractionRuns: many(cbaIntelExtractionRuns),
}));

// Forward import for relation wiring
import { cbaIntelExtractionRuns } from "./extraction";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelDocument = typeof cbaIntelDocuments.$inferSelect;
export type NewCbaIntelDocument = typeof cbaIntelDocuments.$inferInsert;
