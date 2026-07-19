/**
 * CBA Intelligence — Ingestion Scheduler
 *
 * Manages periodic ingestion runs with configurable schedules,
 * backoff for failing sources, and freshness tracking.
 *
 * Designed for use with:
 *  - Node.js setInterval/setTimeout in long-running processes
 *  - Vercel Cron (via API route + cron config)
 *  - External cron triggers (GitHub Actions, Azure Functions Timer)
 *
 * The scheduler coordinates:
 *  1. Which sources are due for re-ingestion
 *  2. Exponential backoff for sources with repeated failures
 *  3. Post-ingestion extraction pipeline trigger
 *  4. Freshness log updates
 */

import { db } from "@/db/db";
import { cbaIntelSources, cbaIntelIngestionJobs, cbaIntelFreshnessLog } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import {
  cbaIntelSourceFreshness,
} from "@/lib/observability/metrics";
import { runFullIngestion, type FullIngestionResult } from "./ingestion-orchestrator";
import { runBulkExtraction } from "./extraction-orchestrator";
import { computeFreshnessStatus } from "./freshness-service";

// ---------------------------------------------------------------------------
// Schedule configuration
// ---------------------------------------------------------------------------

export interface ScheduleConfig {
  /** Default interval between ingestion runs (ms). Default: 24h */
  defaultIntervalMs: number;
  /** Maximum backoff interval for failing sources (ms). Default: 7 days */
  maxBackoffMs: number;
  /** Whether to run extraction after ingestion. Default: true */
  runExtractionAfter: boolean;
  /** Whether to update freshness logs after ingestion. Default: true */
  updateFreshness: boolean;
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  defaultIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
  maxBackoffMs: 7 * 24 * 60 * 60 * 1000,   // 7 days
  runExtractionAfter: true,
  updateFreshness: true,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// ---------------------------------------------------------------------------
// Source readiness check
// ---------------------------------------------------------------------------

interface SourceScheduleInfo {
  sourceId: string;
  sourceName: string;
  lastRunAt: Date | null;
  consecutiveFailures: number;
  isDue: boolean;
  nextRunAt: Date;
}

async function getSourceSchedules(
  config: ScheduleConfig,
): Promise<SourceScheduleInfo[]> {
  const sources = await db
    .select()
    .from(cbaIntelSources)
    .where(eq(cbaIntelSources.isActive, true));

  const schedules: SourceScheduleInfo[] = [];

  for (const source of sources) {
    // Get last successful or failed job for this source
    const [lastJob] = await db
      .select()
      .from(cbaIntelIngestionJobs)
      .where(eq(cbaIntelIngestionJobs.sourceId, source.id))
      .orderBy(desc(cbaIntelIngestionJobs.createdAt))
      .limit(1);

    const lastRunAt = lastJob?.completedAt ? new Date(lastJob.completedAt) : null;

    // Count consecutive failures
    const recentJobs = await db
      .select({ status: cbaIntelIngestionJobs.status })
      .from(cbaIntelIngestionJobs)
      .where(eq(cbaIntelIngestionJobs.sourceId, source.id))
      .orderBy(desc(cbaIntelIngestionJobs.createdAt))
      .limit(5);

    let consecutiveFailures = 0;
    for (const job of recentJobs) {
      if (job.status === "failed") {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // Compute next run time with exponential backoff
    const backoffMultiplier = Math.pow(2, consecutiveFailures);
    const intervalMs = Math.min(
      config.defaultIntervalMs * backoffMultiplier,
      config.maxBackoffMs,
    );

    const nextRunAt = lastRunAt
      ? new Date(lastRunAt.getTime() + intervalMs)
      : new Date(0); // Never run = run immediately

    const isDue = new Date() >= nextRunAt;

    schedules.push({
      sourceId: source.id,
      sourceName: source.name,
      lastRunAt,
      consecutiveFailures,
      isDue,
      nextRunAt,
    });
  }

  return schedules;
}

// ---------------------------------------------------------------------------
// Scheduled run
// ---------------------------------------------------------------------------

export interface ScheduledRunResult {
  scheduledAt: string;
  ingestion: FullIngestionResult | null;
  extraction: {
    processed: number;
    succeeded: number;
    failed: number;
  } | null;
  freshnessUpdate: boolean;
  skippedReason?: string;
}

export async function runScheduledIngestion(
  config: Partial<ScheduleConfig> = {},
): Promise<ScheduledRunResult> {
  const mergedConfig = { ...DEFAULT_SCHEDULE, ...config };

  if (isRunning) {
    logger.warn("Scheduled ingestion: already running, skipping");
    return {
      scheduledAt: new Date().toISOString(),
      ingestion: null,
      extraction: null,
      freshnessUpdate: false,
      skippedReason: "Already running",
    };
  }

  isRunning = true;
  const scheduledAt = new Date().toISOString();

  try {
    logger.info("Scheduled ingestion: starting", { config: mergedConfig });

    // Check which sources are due
    const schedules = await getSourceSchedules(mergedConfig);
    const dueSources = schedules.filter((s) => s.isDue);

    logger.info("Scheduled ingestion: source status", {
      total: schedules.length,
      due: dueSources.length,
      backoff: schedules.filter((s) => s.consecutiveFailures > 0).length,
    });

    if (dueSources.length === 0) {
      logger.info("Scheduled ingestion: no sources due, skipping");
      return {
        scheduledAt,
        ingestion: null,
        extraction: null,
        freshnessUpdate: false,
        skippedReason: "No sources due for ingestion",
      };
    }

    // Run full ingestion
    const ingestionResult = await runFullIngestion();

    // Run extraction if configured
    let extractionResult: { processed: number; succeeded: number; failed: number } | null = null;
    if (mergedConfig.runExtractionAfter && ingestionResult.totalDocumentsIngested > 0) {
      logger.info("Scheduled ingestion: running extraction pipeline");
      const { processed, succeeded, failed } = await runBulkExtraction();
      extractionResult = { processed, succeeded, failed };
    }

    // Update freshness logs
    let freshnessUpdated = false;
    if (mergedConfig.updateFreshness) {
      try {
        await updateFreshnessLogs();
        freshnessUpdated = true;
      } catch (error) {
        logger.error("Failed to update freshness logs", { error });
      }
    }

    logger.info("Scheduled ingestion: completed", {
      sources: ingestionResult.totalSources,
      documents: ingestionResult.totalDocumentsIngested,
      extraction: extractionResult,
    });

    return {
      scheduledAt,
      ingestion: ingestionResult,
      extraction: extractionResult,
      freshnessUpdate: freshnessUpdated,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Scheduled ingestion: failed", { error: msg });
    throw error;
  } finally {
    isRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Freshness log helper
// ---------------------------------------------------------------------------

async function updateFreshnessLogs(): Promise<void> {
  const sources = await db
    .select()
    .from(cbaIntelSources)
    .where(eq(cbaIntelSources.isActive, true));

  for (const source of sources) {
    const [lastJob] = await db
      .select()
      .from(cbaIntelIngestionJobs)
      .where(
        and(
          eq(cbaIntelIngestionJobs.sourceId, source.id),
          eq(cbaIntelIngestionJobs.status, "completed"),
        ),
      )
      .orderBy(desc(cbaIntelIngestionJobs.createdAt))
      .limit(1);

    if (!lastJob?.completedAt) continue;

    const lastChecked = new Date(lastJob.completedAt);
    const daysSinceLastSuccess = Math.round(
      (Date.now() - lastChecked.getTime()) / (1000 * 60 * 60 * 24),
    );
    const freshnessStatus = computeFreshnessStatus(daysSinceLastSuccess);

    // Emit freshness gauge (1=fresh, 2=aging, 3=stale, 4=expired, 0=unknown)
    const freshnessValue =
      freshnessStatus === "fresh" ? 1 :
      freshnessStatus === "aging" ? 2 :
      freshnessStatus === "stale" ? 3 :
      freshnessStatus === "expired" ? 4 : 0;
    cbaIntelSourceFreshness.set(
      { source_slug: source.slug ?? source.id },
      freshnessValue,
    );

    await db.insert(cbaIntelFreshnessLog).values({
      sourceId: source.id,
      freshnessStatus,
      daysSinceLastSuccess,
      documentCount: lastJob.documentsFound ?? 0,
      staleDocumentCount: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Timer-based scheduler (for long-running processes)
// ---------------------------------------------------------------------------

export function startScheduler(
  config: Partial<ScheduleConfig> = {},
): void {
  const mergedConfig = { ...DEFAULT_SCHEDULE, ...config };

  if (schedulerTimer) {
    logger.warn("Scheduler already running, stopping previous instance");
    stopScheduler();
  }

  logger.info("Starting CBA intelligence ingestion scheduler", {
    intervalMs: mergedConfig.defaultIntervalMs,
  });

  // Run immediately on start
  runScheduledIngestion(mergedConfig).catch((error) => {
    logger.error("Initial scheduled run failed", { error });
  });

  // Then run on interval
  schedulerTimer = setInterval(
    () => {
      runScheduledIngestion(mergedConfig).catch((error) => {
        logger.error("Scheduled run failed", { error });
      });
    },
    mergedConfig.defaultIntervalMs,
  );
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("CBA intelligence ingestion scheduler stopped");
  }
}

export function isSchedulerRunning(): boolean {
  return schedulerTimer !== null;
}

export function isIngestionInProgress(): boolean {
  return isRunning;
}

export const __test__ = {
  getSourceSchedules,
  updateFreshnessLogs,
  getDefaultSchedule: () => DEFAULT_SCHEDULE,
  setRunning: (value: boolean) => {
    isRunning = value;
  },
};
