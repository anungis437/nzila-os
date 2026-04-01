import { db } from "@/db/db";
import {
  cbaIntelIngestionJobs,
  cbaIntelSources,
  ingestionStatusEnum,
} from "@/db/schema";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { updateSourceHealth } from "./source-registry-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelIngestionJob = typeof cbaIntelIngestionJobs.$inferSelect;
export type NewIngestionJob = typeof cbaIntelIngestionJobs.$inferInsert;

export interface IngestionJobFilters {
  sourceId?: string;
  status?: (typeof ingestionStatusEnum.enumValues)[number];
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listIngestionJobs(
  filters: IngestionJobFilters = {},
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (filters.sourceId) conditions.push(eq(cbaIntelIngestionJobs.sourceId, filters.sourceId));
  if (filters.status) conditions.push(eq(cbaIntelIngestionJobs.status, filters.status));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelIngestionJobs)
      .where(whereClause);

    const items = await db
      .select()
      .from(cbaIntelIngestionJobs)
      .where(whereClause)
      .orderBy(desc(cbaIntelIngestionJobs.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  } catch (error) {
    logger.error("Error listing ingestion jobs", { error, filters });
    throw new Error("Failed to list ingestion jobs");
  }
}

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

export async function getIngestionJobById(id: string): Promise<CbaIntelIngestionJob | null> {
  try {
    const [job] = await db
      .select()
      .from(cbaIntelIngestionJobs)
      .where(eq(cbaIntelIngestionJobs.id, id))
      .limit(1);
    return job ?? null;
  } catch (error) {
    logger.error("Error getting ingestion job", { error, id });
    throw new Error("Failed to get ingestion job");
  }
}

// ---------------------------------------------------------------------------
// Create / Start
// ---------------------------------------------------------------------------

export async function createIngestionJob(data: NewIngestionJob): Promise<CbaIntelIngestionJob> {
  try {
    const [job] = await db.insert(cbaIntelIngestionJobs).values(data).returning();
    return job;
  } catch (error) {
    logger.error("Error creating ingestion job", { error, sourceId: data.sourceId });
    throw new Error("Failed to create ingestion job");
  }
}

export async function startIngestionJob(id: string): Promise<CbaIntelIngestionJob | null> {
  try {
    const [updated] = await db
      .update(cbaIntelIngestionJobs)
      .set({ status: "running", startedAt: new Date() })
      .where(
        and(eq(cbaIntelIngestionJobs.id, id), eq(cbaIntelIngestionJobs.status, "queued")),
      )
      .returning();
    return updated ?? null;
  } catch (error) {
    logger.error("Error starting ingestion job", { error, id });
    throw new Error("Failed to start ingestion job");
  }
}

// ---------------------------------------------------------------------------
// Complete / Fail
// ---------------------------------------------------------------------------

export async function completeIngestionJob(
  id: string,
  stats: {
    documentsFound?: number;
    documentsNew?: number;
    documentsUpdated?: number;
    documentsUnchanged?: number;
    documentsFailed?: number;
  },
): Promise<CbaIntelIngestionJob | null> {
  const now = new Date();
  const hasFailed = (stats.documentsFailed ?? 0) > 0;

  try {
    const job = await getIngestionJobById(id);
    if (!job) return null;

    const durationMs = job.startedAt ? now.getTime() - new Date(job.startedAt).getTime() : null;

    const [updated] = await db
      .update(cbaIntelIngestionJobs)
      .set({
        status: hasFailed ? "completed_with_errors" : "completed",
        completedAt: now,
        durationMs,
        ...stats,
      })
      .where(eq(cbaIntelIngestionJobs.id, id))
      .returning();

    // Update source health
    if (updated) {
      await updateSourceHealth(updated.sourceId, true);
    }

    return updated ?? null;
  } catch (error) {
    logger.error("Error completing ingestion job", { error, id });
    throw new Error("Failed to complete ingestion job");
  }
}

export async function failIngestionJob(
  id: string,
  errorMessage: string,
  failureClass: string,
  errorDetails?: Record<string, unknown>,
): Promise<CbaIntelIngestionJob | null> {
  const now = new Date();

  try {
    const job = await getIngestionJobById(id);
    if (!job) return null;

    const durationMs = job.startedAt ? now.getTime() - new Date(job.startedAt).getTime() : null;
    const shouldRetry = job.retryCount < job.maxRetries;

    const [updated] = await db
      .update(cbaIntelIngestionJobs)
      .set({
        status: shouldRetry ? "queued" : "failed",
        completedAt: shouldRetry ? null : now,
        durationMs,
        errorMessage,
        failureClass: failureClass as typeof cbaIntelIngestionJobs.$inferSelect["failureClass"],
        errorDetails: errorDetails ?? null,
        retryCount: job.retryCount + 1,
      })
      .where(eq(cbaIntelIngestionJobs.id, id))
      .returning();

    if (updated && !shouldRetry) {
      await updateSourceHealth(updated.sourceId, false);
    }

    return updated ?? null;
  } catch (error) {
    logger.error("Error failing ingestion job", { error, id });
    throw new Error("Failed to record ingestion job failure");
  }
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelIngestionJob(id: string): Promise<boolean> {
  try {
    const [updated] = await db
      .update(cbaIntelIngestionJobs)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(
        and(
          eq(cbaIntelIngestionJobs.id, id),
          sql`${cbaIntelIngestionJobs.status} IN ('queued', 'running')`,
        ),
      )
      .returning();
    return !!updated;
  } catch (error) {
    logger.error("Error cancelling ingestion job", { error, id });
    throw new Error("Failed to cancel ingestion job");
  }
}
