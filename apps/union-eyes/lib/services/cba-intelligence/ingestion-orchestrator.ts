/**
 * CBA Intelligence — Ingestion Orchestrator
 *
 * Coordinates the full ingestion pipeline:
 *  1. Loads active sources from the registry
 *  2. Resolves the adapter for each source
 *  3. Runs discover → fetch → persist for each adapter
 *  4. Updates source health and job status
 *
 * Designed for both cron-triggered and manual API invocations.
 */

// @ts-nocheck
import { logger } from "@/lib/logger";
import {
  cbaIntelIngestionJobsTotal,
  cbaIntelIngestionDuration,
  cbaIntelDocumentsIngested,
} from "@/lib/observability/metrics";
import { listSources, updateSourceHealth } from "./source-registry-service";
import {
  createIngestionJob,
  startIngestionJob,
  completeIngestionJob,
  failIngestionJob,
} from "./ingestion-service";
import { upsertDocument, computeContentHash } from "./document-service";
import { getAdapter, getRegisteredAdapterKeys } from "./adapters";
import type { DiscoveredDocument, FetchedContent } from "./adapters/types";
import type { CbaIntelSource } from "./source-registry-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestionRunResult {
  sourceId: string;
  sourceName: string;
  jobId: string;
  status: "completed" | "completed_with_errors" | "failed";
  documentsFound: number;
  documentsNew: number;
  documentsUpdated: number;
  documentsUnchanged: number;
  documentsFailed: number;
  durationMs: number;
  errors: string[];
}

export interface FullIngestionResult {
  startedAt: string;
  completedAt: string;
  totalSources: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  totalDocumentsIngested: number;
  results: IngestionRunResult[];
}

// ---------------------------------------------------------------------------
// Single-source ingestion
// ---------------------------------------------------------------------------

async function ingestSource(source: CbaIntelSource): Promise<IngestionRunResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const stats = {
    documentsFound: 0,
    documentsNew: 0,
    documentsUpdated: 0,
    documentsUnchanged: 0,
    documentsFailed: 0,
  };

  // Create ingestion job
  const job = await createIngestionJob({
    sourceId: source.id,
    status: "queued",
    triggeredBy: "orchestrator",
  });

  const started = await startIngestionJob(job.id);
  if (!started) {
    await failIngestionJob(job.id, "Failed to start job", "internal");
    return {
      sourceId: source.id,
      sourceName: source.name,
      jobId: job.id,
      status: "failed",
      ...stats,
      durationMs: Date.now() - startTime,
      errors: ["Failed to start ingestion job"],
    };
  }

  try {
    // Resolve adapter
    const adapter = getAdapter(source.adapterKey);
    if (!adapter) {
      throw new Error(`No adapter registered for key: ${source.adapterKey}`);
    }

    const config = (source.config as Record<string, unknown>) ?? {};

    // Phase 1: Discover
    logger.info("Ingestion: discovering documents", {
      sourceId: source.id,
      adapter: source.adapterKey,
    });

    const discovered: DiscoveredDocument[] = await adapter.discover(config);
    stats.documentsFound = discovered.length;

    logger.info("Ingestion: discovered documents", {
      sourceId: source.id,
      count: discovered.length,
    });

    // Phase 2: Fetch & persist each document
    // Process sequentially to respect rate limits
    for (const doc of discovered) {
      try {
        const fetched: FetchedContent = await adapter.fetch(doc.sourceUrl, config);

        const contentHash = computeContentHash(fetched.rawContent);

        const result = await upsertDocument({
          sourceId: source.id,
          sourceUrl: doc.sourceUrl,
          title: doc.title ?? null,
          documentType: (doc.documentType as "collective_agreement") ?? "collective_agreement",
          rawContent: fetched.rawContent,
          contentHash,
          language: doc.language ?? "en",
          jurisdiction: doc.jurisdiction ?? source.jurisdiction ?? null,
          wordCount: fetched.wordCount ?? null,
          pageCount: fetched.pageCount ?? null,
          processingStatus: "raw",
        });

        switch (result.action) {
          case "created":
            stats.documentsNew++;
            break;
          case "updated":
            stats.documentsUpdated++;
            break;
          case "unchanged":
            stats.documentsUnchanged++;
            break;
        }
      } catch (fetchError) {
        stats.documentsFailed++;
        const msg =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        errors.push(`Failed to fetch ${doc.sourceUrl}: ${msg}`);
        logger.warn("Ingestion: document fetch failed", {
          sourceUrl: doc.sourceUrl,
          error: msg,
        });
      }
    }

    // Phase 3: Complete job
    await completeIngestionJob(job.id, stats);

    const status =
      stats.documentsFailed > 0 ? "completed_with_errors" : "completed";

    const durationMs = Date.now() - startTime;

    // Emit metrics
    cbaIntelIngestionJobsTotal.inc({ status, source_type: source.sourceType ?? "unknown" });
    cbaIntelIngestionDuration.observe(
      { source_type: source.sourceType ?? "unknown" },
      durationMs / 1000,
    );
    cbaIntelDocumentsIngested.inc(
      { document_type: "collective_agreement", language: "en" },
      stats.documentsNew + stats.documentsUpdated,
    );

    return {
      sourceId: source.id,
      sourceName: source.name,
      jobId: job.id,
      status,
      ...stats,
      durationMs,
      errors,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await failIngestionJob(job.id, msg, "adapter_error");
    await updateSourceHealth(source.id, false);

    cbaIntelIngestionJobsTotal.inc({ status: "failed", source_type: source.sourceType ?? "unknown" });
    cbaIntelIngestionDuration.observe(
      { source_type: source.sourceType ?? "unknown" },
      (Date.now() - startTime) / 1000,
    );

    return {
      sourceId: source.id,
      sourceName: source.name,
      jobId: job.id,
      status: "failed",
      ...stats,
      durationMs: Date.now() - startTime,
      errors: [msg],
    };
  }
}

// ---------------------------------------------------------------------------
// Full ingestion run (all active sources)
// ---------------------------------------------------------------------------

export async function runFullIngestion(): Promise<FullIngestionResult> {
  const startedAt = new Date().toISOString();
  logger.info("Starting full CBA intelligence ingestion run");

  // Get all active sources
  const { items: sources } = await listSources(
    { isActive: true },
    { limit: 100 },
  );

  // Filter to sources whose adapter is registered
  const registeredKeys = getRegisteredAdapterKeys();
  const eligibleSources = sources.filter((s) =>
    registeredKeys.includes(s.adapterKey),
  );

  if (eligibleSources.length === 0) {
    logger.warn("No eligible sources found for ingestion");
  }

  const results: IngestionRunResult[] = [];
  let sourcesSucceeded = 0;
  let sourcesFailed = 0;
  let totalDocumentsIngested = 0;

  // Process sources sequentially to avoid hammering endpoints
  for (const source of eligibleSources) {
    try {
      const result = await ingestSource(source);
      results.push(result);

      if (result.status === "failed") {
        sourcesFailed++;
      } else {
        sourcesSucceeded++;
        totalDocumentsIngested +=
          result.documentsNew + result.documentsUpdated;
      }
    } catch (error) {
      sourcesFailed++;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Ingestion: source-level failure", {
        sourceId: source.id,
        error: msg,
      });
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        jobId: "",
        status: "failed",
        documentsFound: 0,
        documentsNew: 0,
        documentsUpdated: 0,
        documentsUnchanged: 0,
        documentsFailed: 0,
        durationMs: 0,
        errors: [msg],
      });
    }
  }

  const completedAt = new Date().toISOString();

  logger.info("Full ingestion run completed", {
    totalSources: eligibleSources.length,
    sourcesSucceeded,
    sourcesFailed,
    totalDocumentsIngested,
  });

  return {
    startedAt,
    completedAt,
    totalSources: eligibleSources.length,
    sourcesSucceeded,
    sourcesFailed,
    totalDocumentsIngested,
    results,
  };
}

// ---------------------------------------------------------------------------
// Single-source ingestion (by source ID)
// ---------------------------------------------------------------------------

export async function runSourceIngestion(
  sourceId: string,
): Promise<IngestionRunResult> {
  const { items: allSources } = await listSources({}, { limit: 100 });
  const source = allSources.find((s) => s.id === sourceId);

  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  if (!source.isActive) {
    throw new Error(`Source is inactive: ${source.name}`);
  }

  return ingestSource(source);
}
