import { listIngestionJobs } from "./ingestion-service";
import { listExtractionRuns } from "./extraction-service";
import { getReviewQueueCounts } from "./review-service";
import { getFreshnessOverview } from "./freshness-service";

export type HealthLevel = "healthy" | "warning" | "critical";

export interface CbaIntelOperationalHealth {
  level: HealthLevel;
  generatedAt: string;
  throughput: {
    ingestionSuccessRate: number | null;
    extractionSuccessRate: number | null;
  };
  quality: {
    reviewBacklog: number;
    staleSources: number;
    expiredSources: number;
  };
  checks: Array<{
    name: string;
    level: HealthLevel;
    detail: string;
  }>;
}

function ratio(success: number, total: number): number | null {
  if (total <= 0) return null;
  return success / total;
}

function toPercent(value: number | null): string {
  if (value == null) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function mergeLevel(levels: HealthLevel[]): HealthLevel {
  if (levels.includes("critical")) return "critical";
  if (levels.includes("warning")) return "warning";
  return "healthy";
}

export async function getCbaIntelOperationalHealth(): Promise<CbaIntelOperationalHealth> {
  const [ingestion, extraction, review, freshness] = await Promise.all([
    listIngestionJobs({}, { page: 1, limit: 100 }),
    listExtractionRuns({}, { page: 1, limit: 100 }),
    getReviewQueueCounts(),
    getFreshnessOverview(),
  ]);

  const ingestionCompleted = ingestion.items.filter(
    (j) => j.status === "completed" || j.status === "completed_with_errors" || j.status === "failed",
  );
  const ingestionSuccess = ingestionCompleted.filter(
    (j) => j.status === "completed" || j.status === "completed_with_errors",
  ).length;
  const ingestionSuccessRate = ratio(ingestionSuccess, ingestionCompleted.length);

  const extractionCompleted = extraction.items.filter(
    (r) => r.status === "completed" || r.status === "completed_with_errors" || r.status === "failed",
  );
  const extractionSuccess = extractionCompleted.filter(
    (r) => r.status === "completed" || r.status === "completed_with_errors",
  ).length;
  const extractionSuccessRate = ratio(extractionSuccess, extractionCompleted.length);

  const staleSources = freshness.summary.stale;
  const expiredSources = freshness.summary.expired;

  const checks: Array<{ name: string; level: HealthLevel; detail: string }> = [];

  const ingestionLevel: HealthLevel =
    ingestionSuccessRate == null ? "warning" : ingestionSuccessRate < 0.8 ? "critical" : ingestionSuccessRate < 0.95 ? "warning" : "healthy";
  checks.push({
    name: "ingestion_success_rate",
    level: ingestionLevel,
    detail: `Recent ingestion success rate: ${toPercent(ingestionSuccessRate)}`,
  });

  const extractionLevel: HealthLevel =
    extractionSuccessRate == null ? "warning" : extractionSuccessRate < 0.85 ? "critical" : extractionSuccessRate < 0.97 ? "warning" : "healthy";
  checks.push({
    name: "extraction_success_rate",
    level: extractionLevel,
    detail: `Recent extraction success rate: ${toPercent(extractionSuccessRate)}`,
  });

  const backlogLevel: HealthLevel = review.total > 1000 ? "critical" : review.total > 300 ? "warning" : "healthy";
  checks.push({
    name: "review_backlog",
    level: backlogLevel,
    detail: `Pending review items: ${review.total}`,
  });

  const freshnessLevel: HealthLevel = expiredSources > 0 ? "critical" : staleSources > 0 ? "warning" : "healthy";
  checks.push({
    name: "source_freshness",
    level: freshnessLevel,
    detail: `Freshness summary — stale: ${staleSources}, expired: ${expiredSources}`,
  });

  return {
    level: mergeLevel(checks.map((c) => c.level)),
    generatedAt: new Date().toISOString(),
    throughput: {
      ingestionSuccessRate,
      extractionSuccessRate,
    },
    quality: {
      reviewBacklog: review.total,
      staleSources,
      expiredSources,
    },
    checks,
  };
}
