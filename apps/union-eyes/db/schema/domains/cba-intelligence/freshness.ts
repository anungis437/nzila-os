import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { cbaIntelSources } from "./source-registry";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const freshnessStatusEnum = pgEnum("cba_intel_freshness_status", [
  "fresh",
  "aging",
  "stale",
  "expired",
  "unknown",
]);

// ---------------------------------------------------------------------------
// Source Freshness Log (periodic health-check results)
// ---------------------------------------------------------------------------

export const cbaIntelFreshnessLog = pgTable(
  "cba_intel_freshness_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => cbaIntelSources.id, { onDelete: "cascade" }),

    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    freshnessStatus: freshnessStatusEnum("freshness_status").notNull(),
    daysSinceLastSuccess: integer("days_since_last_success"),
    documentCount: integer("document_count"),
    staleDocumentCount: integer("stale_document_count"),
    notes: text("notes"),
  },
  (t) => [
    index("idx_cba_intel_freshness_source").on(t.sourceId),
    index("idx_cba_intel_freshness_checked").on(t.checkedAt),
  ],
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelFreshnessLog = typeof cbaIntelFreshnessLog.$inferSelect;
export type FreshnessStatus = typeof freshnessStatusEnum.enumValues[number];
