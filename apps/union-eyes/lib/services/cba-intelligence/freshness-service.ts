import { db } from "@/db/db";
import {
  cbaIntelFreshnessLog,
  cbaIntelSources,
  cbaIntelDocuments,
} from "@/db/schema";
import { eq, desc, sql, and, lt, type SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelFreshnessEntry = typeof cbaIntelFreshnessLog.$inferSelect;

export type FreshnessStatus = "fresh" | "aging" | "stale" | "expired" | "unknown";

export interface FreshnessThresholds {
  /** Days since last success before "aging" */
  agingDays: number;
  /** Days since last success before "stale" */
  staleDays: number;
  /** Days since last success before "expired" */
  expiredDays: number;
}

const DEFAULT_THRESHOLDS: FreshnessThresholds = {
  agingDays: 14,
  staleDays: 30,
  expiredDays: 90,
};

export interface FreshnessOverview {
  sources: SourceFreshness[];
  summary: {
    fresh: number;
    aging: number;
    stale: number;
    expired: number;
    unknown: number;
    total: number;
  };
}

export interface SourceFreshness {
  sourceId: string;
  sourceName: string;
  sourceSlug: string;
  freshnessStatus: FreshnessStatus;
  daysSinceLastSuccess: number | null;
  documentCount: number;
  staleDocumentCount: number;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  expectedUpdateDays: number | null;
}

// ---------------------------------------------------------------------------
// Compute freshness status from days
// ---------------------------------------------------------------------------

export function computeFreshnessStatus(
  daysSinceLastSuccess: number | null,
  thresholds: FreshnessThresholds = DEFAULT_THRESHOLDS,
): FreshnessStatus {
  if (daysSinceLastSuccess == null) return "unknown";
  if (daysSinceLastSuccess >= thresholds.expiredDays) return "expired";
  if (daysSinceLastSuccess >= thresholds.staleDays) return "stale";
  if (daysSinceLastSuccess >= thresholds.agingDays) return "aging";
  return "fresh";
}

// ---------------------------------------------------------------------------
// Compute freshness for a single source
// ---------------------------------------------------------------------------

export async function computeSourceFreshness(
  sourceId: string,
  thresholds: FreshnessThresholds = DEFAULT_THRESHOLDS,
): Promise<SourceFreshness> {
  try {
    const [source] = await db
      .select()
      .from(cbaIntelSources)
      .where(eq(cbaIntelSources.id, sourceId))
      .limit(1);

    if (!source) throw new Error(`Source not found: ${sourceId}`);

    const daysSinceLastSuccess = source.lastSuccessAt
      ? Math.floor(
          (Date.now() - new Date(source.lastSuccessAt).getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

    // Count documents + stale documents
    const [[{ totalDocs }], [{ staleDocs }]] = await Promise.all([
      db
        .select({ totalDocs: sql<number>`count(*)::int` })
        .from(cbaIntelDocuments)
        .where(eq(cbaIntelDocuments.sourceId, sourceId)),
      db
        .select({ staleDocs: sql<number>`count(*)::int` })
        .from(cbaIntelDocuments)
        .where(
          and(
            eq(cbaIntelDocuments.sourceId, sourceId),
            lt(
              cbaIntelDocuments.lastSeenAt,
              sql`now() - interval '${sql.raw(String(thresholds.staleDays))} days'`,
            ),
          ),
        ),
    ]);

    const freshnessStatus = computeFreshnessStatus(daysSinceLastSuccess, thresholds);

    return {
      sourceId: source.id,
      sourceName: source.nameEn ?? source.slug,
      sourceSlug: source.slug,
      freshnessStatus,
      daysSinceLastSuccess,
      documentCount: totalDocs,
      staleDocumentCount: staleDocs,
      lastCheckedAt: source.lastCheckedAt,
      lastSuccessAt: source.lastSuccessAt,
      expectedUpdateDays: source.expectedUpdateDays,
    };
  } catch (error) {
    logger.error("Error computing source freshness", { error, sourceId });
    throw error instanceof Error ? error : new Error("Failed to compute freshness");
  }
}

// ---------------------------------------------------------------------------
// Compute freshness overview for all active sources
// ---------------------------------------------------------------------------

export async function getFreshnessOverview(
  thresholds: FreshnessThresholds = DEFAULT_THRESHOLDS,
): Promise<FreshnessOverview> {
  try {
    const activeSources = await db
      .select()
      .from(cbaIntelSources)
      .where(eq(cbaIntelSources.isActive, true))
      .orderBy(cbaIntelSources.nameEn);

    const sources: SourceFreshness[] = [];
    const summary = { fresh: 0, aging: 0, stale: 0, expired: 0, unknown: 0, total: 0 };

    for (const source of activeSources) {
      const freshness = await computeSourceFreshness(source.id, thresholds);
      sources.push(freshness);
      summary[freshness.freshnessStatus]++;
      summary.total++;
    }

    return { sources, summary };
  } catch (error) {
    logger.error("Error computing freshness overview", { error });
    throw new Error("Failed to compute freshness overview");
  }
}

// ---------------------------------------------------------------------------
// Log a freshness check
// ---------------------------------------------------------------------------

export async function logFreshnessCheck(
  sourceId: string,
  thresholds: FreshnessThresholds = DEFAULT_THRESHOLDS,
): Promise<CbaIntelFreshnessEntry> {
  try {
    const freshness = await computeSourceFreshness(sourceId, thresholds);

    const [entry] = await db
      .insert(cbaIntelFreshnessLog)
      .values({
        sourceId,
        freshnessStatus: freshness.freshnessStatus,
        daysSinceLastSuccess: freshness.daysSinceLastSuccess,
        documentCount: freshness.documentCount,
        staleDocumentCount: freshness.staleDocumentCount,
      })
      .returning();

    return entry;
  } catch (error) {
    logger.error("Error logging freshness check", { error, sourceId });
    throw new Error("Failed to log freshness check");
  }
}

// ---------------------------------------------------------------------------
// Get freshness history for a source
// ---------------------------------------------------------------------------

export async function getFreshnessHistory(
  sourceId: string,
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelFreshnessLog)
      .where(eq(cbaIntelFreshnessLog.sourceId, sourceId));

    const items = await db
      .select()
      .from(cbaIntelFreshnessLog)
      .where(eq(cbaIntelFreshnessLog.sourceId, sourceId))
      .orderBy(desc(cbaIntelFreshnessLog.checkedAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  } catch (error) {
    logger.error("Error fetching freshness history", { error, sourceId });
    throw new Error("Failed to fetch freshness history");
  }
}
