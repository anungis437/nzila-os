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

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const sourceTypeEnum = pgEnum("cba_intel_source_type", [
  "federal_labour",
  "provincial_labour_board",
  "provincial_ministry",
  "quebec_labour",
  "legal_arbitration",
  "union_bulletin",
  "stats_benchmark",
  "academic",
  "news",
]);

export const sourceFormatEnum = pgEnum("cba_intel_source_format", [
  "html",
  "pdf",
  "feed",
  "search_result",
  "legal_decision",
  "bulletin",
  "csv",
  "api",
]);

export const collectionMethodEnum = pgEnum("cba_intel_collection_method", [
  "manual_upload",
  "scheduled_fetch",
  "api_sync",
  "rss_feed",
  "email_ingest",
]);

export const sourceHealthEnum = pgEnum("cba_intel_source_health", [
  "healthy",
  "degraded",
  "unreachable",
  "unknown",
]);

export const trustTierEnum = pgEnum("cba_intel_trust_tier", [
  "official",      // Government / labour board direct
  "authoritative", // CanLII, official union publications
  "curated",       // Manually verified collections
  "unverified",    // Automated fetch, not reviewed
]);

// ---------------------------------------------------------------------------
// Source Registry
// ---------------------------------------------------------------------------

export const cbaIntelSources = pgTable(
  "cba_intel_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identity
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    name: varchar("name", { length: 300 }).notNull(),
    nameEn: varchar("name_en", { length: 300 }).notNull(),
    nameFr: varchar("name_fr", { length: 300 }),
    description: text("description"),

    // Classification
    sourceType: sourceTypeEnum("source_type").notNull(),
    formatTypes: jsonb("format_types").$type<string[]>().notNull().default([]),
    collectionMethod: collectionMethodEnum("collection_method").notNull(),
    trustTier: trustTierEnum("trust_tier").notNull().default("unverified"),

    // Coverage
    jurisdictions: jsonb("jurisdictions").$type<string[]>().notNull().default([]),
    sectors: jsonb("sectors").$type<string[]>().default([]),

    // Endpoints
    baseUrl: text("base_url").notNull(),
    apiEndpoint: text("api_endpoint"),
    feedUrl: text("feed_url"),

    // Cadence & freshness
    updateCadence: varchar("update_cadence", { length: 60 }),
    expectedUpdateDays: integer("expected_update_days"),

    // Health tracking
    healthStatus: sourceHealthEnum("health_status").notNull().default("unknown"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),

    // Legal / robots
    robotsNotes: text("robots_notes"),
    termsUrl: text("terms_url"),
    redistributionNotes: text("redistribution_notes"),

    // Provenance rules
    provenanceRules: jsonb("provenance_rules").$type<{
      requiresCitation?: boolean;
      requiresReviewBeforePublish?: boolean;
      maxCacheHours?: number;
      attributionTemplate?: string;
    }>(),

    // Lifecycle
    isActive: boolean("is_active").notNull().default(true),
    adapterKey: varchar("adapter_key", { length: 120 }),
    config: jsonb("config").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_sources_type").on(t.sourceType),
    index("idx_cba_intel_sources_health").on(t.healthStatus),
    index("idx_cba_intel_sources_active").on(t.isActive),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const cbaIntelSourcesRelations = relations(cbaIntelSources, ({ many }) => ({
  ingestionJobs: many(cbaIntelIngestionJobs),
  documents: many(cbaIntelDocuments),
}));

// Forward-declare for relation wiring (tables defined in sibling modules)
import { cbaIntelIngestionJobs } from "./ingestion";
import { cbaIntelDocuments } from "./documents";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelSource = typeof cbaIntelSources.$inferSelect;
export type NewCbaIntelSource = typeof cbaIntelSources.$inferInsert;
