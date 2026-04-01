import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  decimal,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cbaIntelAgreements } from "./extraction";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const comparabilityEnum = pgEnum("cba_intel_comparability", [
  "exact",
  "approximate",
  "insufficient_confidence",
]);

// ---------------------------------------------------------------------------
// Benchmark Snapshots
// ---------------------------------------------------------------------------

export const cbaIntelBenchmarkSnapshots = pgTable(
  "cba_intel_benchmark_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Target agreement
    targetAgreementId: uuid("target_agreement_id")
      .notNull()
      .references(() => cbaIntelAgreements.id, { onDelete: "cascade" }),

    // Scope used for comparison
    filterJurisdiction: varchar("filter_jurisdiction", { length: 40 }),
    filterSector: varchar("filter_sector", { length: 200 }),
    filterUnion: varchar("filter_union", { length: 300 }),
    filterEmployerClass: varchar("filter_employer_class", { length: 200 }),

    // Results
    comparableCount: integer("comparable_count").notNull(),
    comparables: jsonb("comparables").$type<Array<{
      agreementId: string;
      title: string;
      employer: string;
      union: string;
      jurisdiction: string;
      sector: string;
      comparability: string;
      wageIncreasePct: number | null;
      termMonths: number | null;
      clauseFamiliesPresent: string[];
      reviewCoverage: number;
      freshnessStatus: string;
    }>>().notNull(),

    // Aggregate metrics
    medianWageIncrease: decimal("median_wage_increase", { precision: 6, scale: 3 }),
    avgTermMonths: decimal("avg_term_months", { precision: 6, scale: 1 }),
    clauseFamilyCoverage: jsonb("clause_family_coverage").$type<
      Record<string, { count: number; total: number; pct: number }>
    >(),

    // Target position
    targetWageIncrease: decimal("target_wage_increase", { precision: 6, scale: 3 }),
    targetTermMonths: integer("target_term_months"),
    wagePercentile: decimal("wage_percentile", { precision: 5, scale: 2 }),

    // Metadata
    snapshotVersion: integer("snapshot_version").notNull().default(1),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    computedBy: varchar("computed_by", { length: 255 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_bench_target").on(t.targetAgreementId),
    index("idx_cba_intel_bench_computed").on(t.computedAt),
    index("idx_cba_intel_bench_jurisdiction").on(t.filterJurisdiction),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const cbaIntelBenchmarkSnapshotsRelations = relations(
  cbaIntelBenchmarkSnapshots,
  ({ one }) => ({
    targetAgreement: one(cbaIntelAgreements, {
      fields: [cbaIntelBenchmarkSnapshots.targetAgreementId],
      references: [cbaIntelAgreements.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelBenchmarkSnapshot = typeof cbaIntelBenchmarkSnapshots.$inferSelect;
export type NewCbaIntelBenchmarkSnapshot = typeof cbaIntelBenchmarkSnapshots.$inferInsert;
