/**
 * Migration Metrics (§10)
 *
 * Aggregation functions for migration observability:
 * - Batch listing with search/filter
 * - Per-batch metrics (success/failure/skip rates)
 * - Duplicate detection rate
 * - Retry success tracking
 * - Data quality warning summaries
 */

import { db } from '@/db/db';
import { sql, eq, and, desc, count } from 'drizzle-orm';
import {
  ingestionBatches,
  ingestionRecords,
  duplicateGroups,
  dataQualityWarnings,
} from '@/db/schema/ingestion-schema';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BatchSummary {
  id: string;
  sourceSystem: string;
  status: string;
  totalRecords: number;
  succeeded: number;
  failed: number;
  skipped: number;
  createdBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  durationMs: number | null;
}

export interface BatchDetail extends BatchSummary {
  errorSummary: unknown;
  metadata: unknown;
  records: RecordSummary[];
  warnings: WarningEntry[];
}

export interface RecordSummary {
  id: string;
  recordIndex: number;
  recordType: string;
  externalId: string | null;
  status: string;
  resolvedId: string | null;
  errorMessage: string | null;
  fingerprint: string | null;
  processedAt: string | null;
}

export interface WarningEntry {
  id: string;
  severity: string;
  category: string;
  fieldName: string | null;
  message: string;
  resolved: boolean;
  createdAt: string;
}

export interface MetricsSummary {
  totalBatches: number;
  totalRecords: number;
  totalSucceeded: number;
  totalFailed: number;
  totalSkipped: number;
  successRate: number;
  failureRate: number;
  duplicateGroupsTotal: number;
  duplicateGroupsPending: number;
  qualityWarningsTotal: number;
  qualityWarningsUnresolved: number;
}

// ─── Batch Listing ──────────────────────────────────────────────────────────

export async function listBatches(
  organizationId: string,
  opts: { status?: string; limit?: number; offset?: number } = {},
): Promise<{ batches: BatchSummary[]; total: number }> {
  const { status, limit = 20, offset = 0 } = opts;
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safeOffset = Math.max(0, offset);

  const conditions = [eq(ingestionBatches.organizationId, organizationId)];
  if (status) {
    conditions.push(eq(ingestionBatches.status, status));
  }

  const whereClause = and(...conditions);

  const [totalResult] = await db
    .select({ count: count() })
    .from(ingestionBatches)
    .where(whereClause);

  const rows = await db
    .select()
    .from(ingestionBatches)
    .where(whereClause)
    .orderBy(desc(ingestionBatches.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);

  const batches: BatchSummary[] = rows.map((row) => ({
    id: row.id,
    sourceSystem: row.sourceSystem,
    status: row.status,
    totalRecords: row.totalRecords,
    succeeded: row.succeeded,
    failed: row.failed,
    skipped: row.skipped,
    createdBy: row.createdBy,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    durationMs:
      row.startedAt && row.completedAt
        ? row.completedAt.getTime() - row.startedAt.getTime()
        : null,
  }));

  return { batches, total: totalResult?.count ?? 0 };
}

// ─── Batch Detail ───────────────────────────────────────────────────────────

export async function getBatchDetail(
  batchId: string,
  organizationId: string,
): Promise<BatchDetail | null> {
  const [batch] = await db
    .select()
    .from(ingestionBatches)
    .where(
      and(
        eq(ingestionBatches.id, batchId),
        eq(ingestionBatches.organizationId, organizationId),
      ),
    );

  if (!batch) return null;

  const records = await db
    .select()
    .from(ingestionRecords)
    .where(eq(ingestionRecords.batchId, batchId))
    .orderBy(ingestionRecords.recordIndex);

  const warnings = await db
    .select()
    .from(dataQualityWarnings)
    .where(eq(dataQualityWarnings.batchId, batchId))
    .orderBy(desc(dataQualityWarnings.createdAt));

  return {
    id: batch.id,
    sourceSystem: batch.sourceSystem,
    status: batch.status,
    totalRecords: batch.totalRecords,
    succeeded: batch.succeeded,
    failed: batch.failed,
    skipped: batch.skipped,
    createdBy: batch.createdBy,
    startedAt: batch.startedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
    durationMs:
      batch.startedAt && batch.completedAt
        ? batch.completedAt.getTime() - batch.startedAt.getTime()
        : null,
    errorSummary: batch.errorSummary,
    metadata: batch.metadata,
    records: records.map((r) => ({
      id: r.id,
      recordIndex: r.recordIndex,
      recordType: r.recordType,
      externalId: r.externalId,
      status: r.status,
      resolvedId: r.resolvedId,
      errorMessage: r.errorMessage,
      fingerprint: r.fingerprint,
      processedAt: r.processedAt?.toISOString() ?? null,
    })),
    warnings: warnings.map((w) => ({
      id: w.id,
      severity: w.severity,
      category: w.category,
      fieldName: w.fieldName,
      message: w.message,
      resolved: w.resolved,
      createdAt: w.createdAt.toISOString(),
    })),
  };
}

// ─── Metrics Summary ─────────────────────────────────────────────────────────

export async function getMetricsSummary(organizationId: string): Promise<MetricsSummary> {
  const [batchAgg] = await db
    .select({
      totalBatches: count(),
      totalRecords: sql<number>`COALESCE(SUM(${ingestionBatches.totalRecords}), 0)`,
      totalSucceeded: sql<number>`COALESCE(SUM(${ingestionBatches.succeeded}), 0)`,
      totalFailed: sql<number>`COALESCE(SUM(${ingestionBatches.failed}), 0)`,
      totalSkipped: sql<number>`COALESCE(SUM(${ingestionBatches.skipped}), 0)`,
    })
    .from(ingestionBatches)
    .where(eq(ingestionBatches.organizationId, organizationId));

  const [dupAgg] = await db
    .select({
      total: count(),
      pending: sql<number>`COUNT(*) FILTER (WHERE ${duplicateGroups.status} = 'pending')`,
    })
    .from(duplicateGroups)
    .where(eq(duplicateGroups.organizationId, organizationId));

  const [warnAgg] = await db
    .select({
      total: count(),
      unresolved: sql<number>`COUNT(*) FILTER (WHERE ${dataQualityWarnings.resolved} = false)`,
    })
    .from(dataQualityWarnings)
    .where(eq(dataQualityWarnings.organizationId, organizationId));

  const totalRecords = Number(batchAgg?.totalRecords ?? 0);
  const totalSucceeded = Number(batchAgg?.totalSucceeded ?? 0);
  const totalFailed = Number(batchAgg?.totalFailed ?? 0);

  return {
    totalBatches: Number(batchAgg?.totalBatches ?? 0),
    totalRecords,
    totalSucceeded,
    totalFailed,
    totalSkipped: Number(batchAgg?.totalSkipped ?? 0),
    successRate: totalRecords > 0 ? Math.round((totalSucceeded / totalRecords) * 10000) / 100 : 0,
    failureRate: totalRecords > 0 ? Math.round((totalFailed / totalRecords) * 10000) / 100 : 0,
    duplicateGroupsTotal: Number(dupAgg?.total ?? 0),
    duplicateGroupsPending: Number(dupAgg?.pending ?? 0),
    qualityWarningsTotal: Number(warnAgg?.total ?? 0),
    qualityWarningsUnresolved: Number(warnAgg?.unresolved ?? 0),
  };
}
