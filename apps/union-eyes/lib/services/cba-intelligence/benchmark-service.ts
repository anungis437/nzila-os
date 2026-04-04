import { db } from "@/db/db";
import {
  cbaIntelBenchmarkSnapshots,
  cbaIntelAgreements,
  cbaIntelWageAdjustments,
  cbaIntelClauses,
} from "@/db/schema";
import { eq, and, sql, desc, type SQL, ne, ilike } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelBenchmarkSnapshot = typeof cbaIntelBenchmarkSnapshots.$inferSelect;

export interface BenchmarkFilters {
  jurisdiction?: string;
  sector?: string;
  union?: string;
  employerClass?: string;
  minComparables?: number;
}

export interface ComparableAgreement {
  agreementId: string;
  employer: string;
  union: string;
  jurisdiction: string;
  sector: string;
  latestWageIncreasePct: number | null;
  termMonths: number | null;
  clauseFamilies: string[];
  comparability: "exact" | "approximate" | "insufficient_confidence";
}

export interface BenchmarkResult {
  targetAgreementId: string;
  comparables: ComparableAgreement[];
  comparableCount: number;
  medianWageIncrease: number | null;
  avgTermMonths: number | null;
  clauseFamilyCoverage: Record<string, number>;
  targetWageIncrease: number | null;
  targetTermMonths: number | null;
  targetWagePercentile: number | null;
  /** true when sample size is below minComparables threshold */
  insufficientData?: boolean;
  /** the minComparables threshold that wasn't met */
  requiredComparables?: number;
}

// ---------------------------------------------------------------------------
// Find comparable agreements for a target agreement
// ---------------------------------------------------------------------------

export async function findComparableAgreements(
  targetAgreementId: string,
  filters: BenchmarkFilters = {},
): Promise<BenchmarkResult> {
  try {
    // Get the target agreement
    const [target] = await db
      .select()
      .from(cbaIntelAgreements)
      .where(eq(cbaIntelAgreements.id, targetAgreementId))
      .limit(1);

    if (!target) throw new Error(`Agreement not found: ${targetAgreementId}`);

    // Build filters for comparable agreements — same jurisdiction/sector unless overridden
    const conditions: SQL[] = [
      ne(cbaIntelAgreements.id, targetAgreementId),
      eq(cbaIntelAgreements.reviewStatus, "approved"),
    ];

    const jurisdiction = filters.jurisdiction ?? target.jurisdiction;
    if (jurisdiction) {
      conditions.push(ilike(cbaIntelAgreements.jurisdiction, jurisdiction));
    }
    const sector = filters.sector ?? target.sector;
    if (sector) {
      conditions.push(ilike(cbaIntelAgreements.sector, sector));
    }
    if (filters.union) {
      conditions.push(ilike(cbaIntelAgreements.unionNormalized, `%${filters.union}%`));
    }
    if (filters.employerClass) {
      conditions.push(ilike(cbaIntelAgreements.employerNormalized, `%${filters.employerClass}%`));
    }

    const comparableRows = await db
      .select()
      .from(cbaIntelAgreements)
      .where(and(...conditions))
      .orderBy(desc(cbaIntelAgreements.createdAt))
      .limit(50);

    // Get wage data and clauses for target + comparables
    const allIds = [targetAgreementId, ...comparableRows.map((r) => r.id)];

    const wageRows = await db
      .select()
      .from(cbaIntelWageAdjustments)
      .where(sql`${cbaIntelWageAdjustments.agreementId} = ANY(${allIds})`);

    const clauseRows = await db
      .select({
        agreementId: cbaIntelClauses.agreementId,
        clauseFamily: cbaIntelClauses.clauseFamily,
      })
      .from(cbaIntelClauses)
      .where(sql`${cbaIntelClauses.agreementId} = ANY(${allIds})`);

    // Index wages & clauses by agreement
    const wagesByAgreement = new Map<string, typeof wageRows>();
    for (const w of wageRows) {
      const arr = wagesByAgreement.get(w.agreementId) ?? [];
      arr.push(w);
      wagesByAgreement.set(w.agreementId, arr);
    }

    const clausesByAgreement = new Map<string, Set<string>>();
    for (const c of clauseRows) {
      const s = clausesByAgreement.get(c.agreementId) ?? new Set();
      if (c.clauseFamily) s.add(c.clauseFamily);
      clausesByAgreement.set(c.agreementId, s);
    }

    // Build comparable list
    const comparables: ComparableAgreement[] = comparableRows.map((row) => {
      const wages = wagesByAgreement.get(row.id) ?? [];
      const latestWage = wages.sort((a, b) =>
        (b.effectiveDate?.getTime() ?? 0) - (a.effectiveDate?.getTime() ?? 0),
      )[0];
      const clauses = clausesByAgreement.get(row.id) ?? new Set();

      const sameJurisdiction = row.jurisdiction?.toLowerCase() === jurisdiction?.toLowerCase();
      const sameSector = row.sector?.toLowerCase() === sector?.toLowerCase();

      return {
        agreementId: row.id,
        employer: row.employerNormalized ?? "Unknown",
        union: row.unionNormalized ?? "Unknown",
        jurisdiction: row.jurisdiction ?? "",
        sector: row.sector ?? "",
        latestWageIncreasePct: latestWage?.adjustmentPercent
          ? Number(latestWage.adjustmentPercent)
          : null,
        termMonths: row.termMonths,
        clauseFamilies: [...clauses],
        comparability: sameJurisdiction && sameSector
          ? "exact"
          : sameJurisdiction || sameSector
            ? "approximate"
            : "insufficient_confidence",
      };
    });

    const minComparables = filters.minComparables ?? 5;
    const filtered = comparables.filter(
      (c) => c.comparability !== "insufficient_confidence",
    );

    // Guard: reject benchmarks with insufficient sample size
    if (filtered.length < minComparables) {
      logger.warn("Benchmark: insufficient comparable agreements", {
        targetAgreementId,
        found: filtered.length,
        required: minComparables,
      });
      return {
        targetAgreementId,
        comparables: filtered,
        comparableCount: filtered.length,
        medianWageIncrease: null,
        avgTermMonths: null,
        clauseFamilyCoverage: {},
        targetWageIncrease: null,
        targetTermMonths: target.termMonths,
        targetWagePercentile: null,
        insufficientData: true,
        requiredComparables: minComparables,
      };
    }

    // Compute aggregates
    const wageIncreases = filtered
      .map((c) => c.latestWageIncreasePct)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);

    const termValues = filtered
      .map((c) => c.termMonths)
      .filter((v): v is number => v != null);

    const medianWageIncrease =
      wageIncreases.length > 0
        ? wageIncreases[Math.floor(wageIncreases.length / 2)]
        : null;

    const avgTermMonths =
      termValues.length > 0
        ? Math.round(termValues.reduce((a, b) => a + b, 0) / termValues.length)
        : null;

    // Clause family coverage: % of comparables with each family
    const clauseFamilyCoverage: Record<string, number> = {};
    if (filtered.length > 0) {
      const allFamilies = new Set(filtered.flatMap((c) => c.clauseFamilies));
      for (const family of allFamilies) {
        const count = filtered.filter((c) => c.clauseFamilies.includes(family)).length;
        clauseFamilyCoverage[family] = Math.round((count / filtered.length) * 100);
      }
    }

    // Target's own position
    const targetWages = wagesByAgreement.get(targetAgreementId) ?? [];
    const targetLatestWage = targetWages.sort((a, b) =>
      (b.effectiveDate?.getTime() ?? 0) - (a.effectiveDate?.getTime() ?? 0),
    )[0];
    const targetWageIncrease = targetLatestWage?.adjustmentPercent
      ? Number(targetLatestWage.adjustmentPercent)
      : null;

    // Compute percentile of target within the comparable set
    let targetWagePercentile: number | null = null;
    if (targetWageIncrease != null && wageIncreases.length > 0) {
      const belowCount = wageIncreases.filter((w) => w < targetWageIncrease).length;
      targetWagePercentile = Math.round((belowCount / wageIncreases.length) * 100);
    }

    return {
      targetAgreementId,
      comparables: filtered,
      comparableCount: filtered.length,
      medianWageIncrease,
      avgTermMonths,
      clauseFamilyCoverage,
      targetWageIncrease,
      targetTermMonths: target.termMonths,
      targetWagePercentile,
    };
  } catch (error) {
    logger.error("Error computing benchmark", { error, targetAgreementId });
    throw error instanceof Error ? error : new Error("Failed to compute benchmark");
  }
}

// ---------------------------------------------------------------------------
// Persist a benchmark snapshot
// ---------------------------------------------------------------------------

export async function saveBenchmarkSnapshot(
  result: BenchmarkResult,
  computedBy: string,
): Promise<CbaIntelBenchmarkSnapshot> {
  try {
    // Find the target agreement for snapshot metadata
    const [target] = await db
      .select()
      .from(cbaIntelAgreements)
      .where(eq(cbaIntelAgreements.id, result.targetAgreementId))
      .limit(1);

    const [snapshot] = await db
      .insert(cbaIntelBenchmarkSnapshots)
      .values({
        targetAgreementId: result.targetAgreementId,
        filterJurisdiction: target?.jurisdiction,
        filterSector: target?.sector,
        filterUnion: target?.unionNormalized,
        comparableCount: result.comparableCount,
        comparables: result.comparables.map((c) => ({
          agreementId: c.agreementId,
          title: `${c.employer} / ${c.union}`,
          employer: c.employer,
          union: c.union,
          jurisdiction: c.jurisdiction,
          sector: c.sector,
          comparability: c.comparability,
          wageIncreasePct: c.latestWageIncreasePct,
          termMonths: c.termMonths,
          clauseFamiliesPresent: c.clauseFamilies,
          reviewCoverage: 0,
          freshnessStatus: "unknown",
        })),
        medianWageIncrease: result.medianWageIncrease?.toString() ?? null,
        avgTermMonths: result.avgTermMonths?.toString() ?? null,
        clauseFamilyCoverage: Object.fromEntries(
          Object.entries(result.clauseFamilyCoverage).map(([k, v]) => [
            k,
            { count: v, total: 100, pct: v },
          ]),
        ),
        targetWageIncrease: result.targetWageIncrease?.toString() ?? null,
        targetTermMonths: result.targetTermMonths,
        wagePercentile: result.targetWagePercentile?.toString() ?? null,
        computedBy,
      })
      .returning();

    logger.info("Benchmark snapshot saved", {
      snapshotId: snapshot.id,
      targetAgreementId: result.targetAgreementId,
      comparableCount: result.comparableCount,
    });

    return snapshot;
  } catch (error) {
    logger.error("Error saving benchmark snapshot", { error });
    throw new Error("Failed to save benchmark snapshot");
  }
}

// ---------------------------------------------------------------------------
// Get benchmark snapshots for an agreement
// ---------------------------------------------------------------------------

export async function getBenchmarkSnapshots(
  agreementId: string,
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 10, 50);
  const offset = (page - 1) * limit;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelBenchmarkSnapshots)
      .where(eq(cbaIntelBenchmarkSnapshots.targetAgreementId, agreementId));

    const items = await db
      .select()
      .from(cbaIntelBenchmarkSnapshots)
      .where(eq(cbaIntelBenchmarkSnapshots.targetAgreementId, agreementId))
      .orderBy(desc(cbaIntelBenchmarkSnapshots.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  } catch (error) {
    logger.error("Error fetching benchmark snapshots", { error, agreementId });
    throw new Error("Failed to fetch benchmark snapshots");
  }
}
