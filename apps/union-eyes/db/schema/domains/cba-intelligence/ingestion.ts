import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cbaIntelSources } from "./source-registry";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ingestionStatusEnum = pgEnum("cba_intel_ingestion_status", [
  "queued",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

export const failureClassEnum = pgEnum("cba_intel_failure_class", [
  "network",
  "auth",
  "parse",
  "rate_limit",
  "schema_mismatch",
  "timeout",
  "unknown",
]);

// ---------------------------------------------------------------------------
// Ingestion Jobs
// ---------------------------------------------------------------------------

export const cbaIntelIngestionJobs = pgTable(
  "cba_intel_ingestion_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => cbaIntelSources.id, { onDelete: "cascade" }),

    // Status
    status: ingestionStatusEnum("status").notNull().default("queued"),
    failureClass: failureClassEnum("failure_class"),

    // Stats
    documentsFound: integer("documents_found").default(0),
    documentsNew: integer("documents_new").default(0),
    documentsUpdated: integer("documents_updated").default(0),
    documentsUnchanged: integer("documents_unchanged").default(0),
    documentsFailed: integer("documents_failed").default(0),

    // Timing
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),

    // Context
    triggerType: varchar("trigger_type", { length: 30 }).notNull().default("scheduled"),
    triggeredBy: varchar("triggered_by", { length: 255 }),
    adapterVersion: varchar("adapter_version", { length: 60 }),

    // Error details
    errorMessage: text("error_message"),
    errorDetails: jsonb("error_details"),

    // Retry
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    parentJobId: uuid("parent_job_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_jobs_source").on(t.sourceId),
    index("idx_cba_intel_jobs_status").on(t.status),
    index("idx_cba_intel_jobs_created").on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const cbaIntelIngestionJobsRelations = relations(
  cbaIntelIngestionJobs,
  ({ one }) => ({
    source: one(cbaIntelSources, {
      fields: [cbaIntelIngestionJobs.sourceId],
      references: [cbaIntelSources.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelIngestionJob = typeof cbaIntelIngestionJobs.$inferSelect;
export type NewCbaIntelIngestionJob = typeof cbaIntelIngestionJobs.$inferInsert;
