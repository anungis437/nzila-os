/**
 * IngestionAdapter — reads UE ingestion_batches from the shared DB.
 *
 * Maps ingestion_batches rows into canonical IngestionRun objects.
 * Falls back gracefully if the UE tables don't exist (e.g. local dev).
 */
import "server-only";

import { logger } from "@/lib/telemetry";
import { db } from "@nzila/db";
import { auditLog } from "@nzila/db";
import { desc, eq, count, sql } from "drizzle-orm";
import { ingestionBatches, dataQualityWarnings } from "./schemas";
import type { IngestionRun } from "@nzila/deal-engine/types";
import type { IngestionAdapter as IIngestionAdapter, IngestionFilters } from "@nzila/deal-engine/adapters";

function mapStatus(raw: string): IngestionRun["status"] {
  const map: Record<string, IngestionRun["status"]> = {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    partial: "partial",
    retrying: "retrying",
  };
  return map[raw] ?? "pending";
}

function deriveTrustSignal(succeeded: number, total: number): IngestionRun["trustSignal"] {
  if (total === 0) return null;
  const ratio = succeeded / total;
  if (ratio >= 0.95) return "verified";
  if (ratio >= 0.5) return "partial";
  return "unverified";
}

function mapBatchToIngestionRun(
  batch: typeof ingestionBatches.$inferSelect,
  warningCount: number,
): IngestionRun {
  return {
    id: batch.id,
    pilotId: null,
    migrationId: null,
    accountName: `${batch.sourceSystem} (org:${batch.organizationId.slice(0, 8)})`,
    sourceSystem: batch.sourceSystem,
    status: mapStatus(batch.status),
    processedCount: batch.processed,
    failedCount: batch.failed,
    warningCount,
    duplicateCount: 0,
    retryCount: 0,
    trustSignal: deriveTrustSignal(batch.succeeded, batch.totalRecords),
    startedAt: batch.startedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
  };
}

export class DbIngestionAdapter implements IIngestionAdapter {
  async getIngestionRuns(filters?: IngestionFilters): Promise<IngestionRun[]> {
    let query = db.select().from(ingestionBatches).orderBy(desc(ingestionBatches.createdAt)).limit(100);

    if (filters?.status) {
      query = query.where(eq(ingestionBatches.status, filters.status)) as typeof query;
    }

    const batches = await query;

    // Batch-fetch warning counts
    const batchIds = batches.map((b) => b.id);
    const warningCounts = new Map<string, number>();

    if (batchIds.length > 0) {
      try {
        const warnings = await db
          .select({
            batchId: dataQualityWarnings.batchId,
            count: count(),
          })
          .from(dataQualityWarnings)
          .where(sql`${dataQualityWarnings.batchId} = ANY(${batchIds})`)
          .groupBy(dataQualityWarnings.batchId);

        for (const w of warnings) {
          if (w.batchId) warningCounts.set(w.batchId, w.count);
        }
      } catch (err) {
        logger.error("[ADAPTER:ingestion] warning counts fetch failed", { error: err });
      }
    }

    return batches.map((b) => mapBatchToIngestionRun(b, warningCounts.get(b.id) ?? 0));
  }

  async getIngestionRunById(id: string): Promise<IngestionRun | null> {
    const [batch] = await db
      .select()
      .from(ingestionBatches)
      .where(eq(ingestionBatches.id, id))
      .limit(1);

    if (!batch) return null;

    let warningCount = 0;
    try {
      const [wc] = await db
        .select({ count: count() })
        .from(dataQualityWarnings)
        .where(eq(dataQualityWarnings.batchId, id));
      warningCount = wc?.count ?? 0;
    } catch (err) {
      logger.error("[ADAPTER:ingestion] getIngestionRunById warning count failed", { id, error: err });
    }

    return mapBatchToIngestionRun(batch, warningCount);
  }

  async retry(id: string, actor: string): Promise<IngestionRun | null> {
    const run = await this.getIngestionRunById(id);
    if (!run) return null;

    // Record the retry intent in audit_log (actual re-run is triggered externally)
    await db.insert(auditLog).values({
      action: "ingestion_retry_requested",
      actorId: actor,
      entityType: "ingestion_run",
      metadata: {
        runId: id,
        source: run.sourceSystem,
        previousStatus: run.status,
      },
    });

    return { ...run, status: "running" };
  }
}
