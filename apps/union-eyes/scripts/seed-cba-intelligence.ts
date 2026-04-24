/**
 * Seed: CBA Intelligence Demo Data
 *
 * Creates sample public-source registry entries, ingestion jobs, documents,
 * and extracted findings for the CBA Intelligence feature.
 *
 * Idempotent: checks for existing records before inserting.
 *
 * @deprecated Since 2026-04 — prefer the unified `@nzila/staging-seed`
 *   framework once it covers CBA Intelligence shapes. This script is
 *   retained for `docs/governance/CBA_INTELLIGENCE_VALIDATION_REPORT.md`
 *   record-count parity (4 sources, 3 documents, 3 findings, 1 review).
 *
 * Usage:
 *   npx tsx apps/union-eyes/scripts/seed-cba-intelligence.ts
 */

// eslint-disable-next-line no-console
console.warn(
  '[seed-cba-intelligence] DEPRECATED: prefer `pnpm seed:staging --app=union-eyes` ' +
    'once CBA Intelligence coverage lands in the framework. Retained for validation parity.',
);

import { db } from "../db/db";
import {
  cbaIntelSources,
  cbaIntelIngestionJobs,
  cbaIntelDocuments,
  cbaIntelFindings,
  cbaIntelExtractionRuns,
  cbaIntelReviewDecisions,
} from "../db/schema";
import { eq } from "drizzle-orm";

// ── Fixed IDs for determinism ───────────────────────────────────────────────

const _DEMO_ORG_ID = "458a56cb-251a-4c91-a0b5-81bb8ac39087";
const REVIEWER_ID = "demo-admin-001";

const SOURCES = [
  {
    slug: "fslrb-decisions",
    name: "Federal Public Sector Labour Relations and Employment Board",
    nameEn: "Federal Public Sector Labour Relations and Employment Board",
    nameFr: "Commission des relations de travail et de l'emploi dans le secteur public fédéral",
    description: "Decisions and rulings from the FPSLREB covering federal public-sector CBAs.",
    sourceType: "federal_labour" as const,
    formatTypes: ["html", "pdf"],
    collectionMethod: "scheduled_fetch" as const,
    trustTier: "official" as const,
    jurisdictions: ["CA-FED"],
    sectors: ["public_sector"],
    baseUrl: "https://decisions.fpslreb-crtespf.gc.ca",
    updateCadence: "weekly",
    expectedUpdateDays: 7,
    healthStatus: "healthy" as const,
    isActive: true,
    adapterKey: "html-bulletin",
  },
  {
    slug: "olrb-decisions",
    name: "Ontario Labour Relations Board",
    nameEn: "Ontario Labour Relations Board",
    nameFr: "Commission des relations de travail de l'Ontario",
    description: "Labour relations decisions from the OLRB.",
    sourceType: "provincial_labour_board" as const,
    formatTypes: ["html"],
    collectionMethod: "scheduled_fetch" as const,
    trustTier: "official" as const,
    jurisdictions: ["CA-ON"],
    sectors: ["public_sector", "private_sector"],
    baseUrl: "https://www.olrb.gov.on.ca",
    updateCadence: "weekly",
    expectedUpdateDays: 7,
    healthStatus: "healthy" as const,
    isActive: true,
    adapterKey: "html-bulletin",
  },
  {
    slug: "canlii-arbitration",
    name: "CanLII Arbitration Decisions",
    nameEn: "CanLII Arbitration Decisions",
    nameFr: "Décisions d'arbitrage CanLII",
    description: "Arbitration awards from the Canadian Legal Information Institute.",
    sourceType: "legal_arbitration" as const,
    formatTypes: ["html"],
    collectionMethod: "api_sync" as const,
    trustTier: "authoritative" as const,
    jurisdictions: ["CA-FED", "CA-ON", "CA-QC", "CA-BC", "CA-AB"],
    sectors: [],
    baseUrl: "https://www.canlii.org",
    updateCadence: "daily",
    expectedUpdateDays: 1,
    healthStatus: "healthy" as const,
    isActive: true,
    adapterKey: "canlii-api",
  },
  {
    slug: "statscan-wages",
    name: "Statistics Canada — Wage Settlements",
    nameEn: "Statistics Canada — Wage Settlements",
    nameFr: "Statistique Canada — Règlements salariaux",
    description: "Major wage settlement data published by Statistics Canada.",
    sourceType: "stats_benchmark" as const,
    formatTypes: ["csv"],
    collectionMethod: "scheduled_fetch" as const,
    trustTier: "official" as const,
    jurisdictions: ["CA-FED"],
    sectors: [],
    baseUrl: "https://www150.statcan.gc.ca",
    updateCadence: "quarterly",
    expectedUpdateDays: 90,
    healthStatus: "healthy" as const,
    isActive: true,
    adapterKey: "csv-stats",
  },
];

async function main() {
  console.log("🌱 Seeding CBA Intelligence demo data...");

  // ── 1. Sources ───────────────────────────────────────────────────────────
  const insertedSources: { id: string; slug: string }[] = [];

  for (const src of SOURCES) {
    const existing = await db
      .select({ id: cbaIntelSources.id })
      .from(cbaIntelSources)
      .where(eq(cbaIntelSources.slug, src.slug));

    if (existing.length > 0) {
      console.log(`  ✓ Source '${src.slug}' already exists`);
      insertedSources.push({ id: existing[0].id, slug: src.slug });
      continue;
    }

    const [inserted] = await db
      .insert(cbaIntelSources)
      .values(src)
      .returning({ id: cbaIntelSources.id });
    insertedSources.push({ id: inserted.id, slug: src.slug });
    console.log(`  + Source '${src.slug}' created`);
  }

  // ── 2. Ingestion job for FSLRB ───────────────────────────────────────────
  const fslrb = insertedSources.find((s) => s.slug === "fslrb-decisions")!;

  const existingJob = await db
    .select({ id: cbaIntelIngestionJobs.id })
    .from(cbaIntelIngestionJobs)
    .where(eq(cbaIntelIngestionJobs.sourceId, fslrb.id));

  let _jobId: string;
  if (existingJob.length > 0) {
    _jobId = existingJob[0].id;
    console.log("  ✓ Ingestion job already exists");
  } else {
    const [job] = await db
      .insert(cbaIntelIngestionJobs)
      .values({
        sourceId: fslrb.id,
        status: "completed",
        documentsFound: 3,
        documentsNew: 3,
        documentsUpdated: 0,
        documentsUnchanged: 0,
        documentsFailed: 0,
        startedAt: new Date("2026-03-15T10:00:00Z"),
        completedAt: new Date("2026-03-15T10:02:30Z"),
        durationMs: 150000,
        triggerType: "manual",
        triggeredBy: REVIEWER_ID,
      })
      .returning({ id: cbaIntelIngestionJobs.id });
    _jobId = job.id;
    console.log("  + Ingestion job created");
  }

  // ── 3. Documents ─────────────────────────────────────────────────────────
  const sampleDocs = [
    {
      sourceId: fslrb.id,
      sourceDocId: "FPSLREB-2026-001",
      sourceUrl: "https://decisions.fpslreb-crtespf.gc.ca/fpslreb/d/2026/001",
      title: "PSAC v. Treasury Board — Wages Group (PA) — 2026 Renewal",
      documentType: "full_agreement" as const,
      rawContent: "Sample raw content for PSAC PA group wage renewal...",
      contentHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      isLatest: true,
      version: 1,
    },
    {
      sourceId: fslrb.id,
      sourceDocId: "FPSLREB-2026-002",
      sourceUrl: "https://decisions.fpslreb-crtespf.gc.ca/fpslreb/d/2026/002",
      title: "CAPE v. Treasury Board — Economics Group (EC) — Arbitration",
      documentType: "arbitration_decision" as const,
      rawContent: "Sample content for CAPE EC group arbitration decision...",
      contentHash: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
      isLatest: true,
      version: 1,
    },
    {
      sourceId: fslrb.id,
      sourceDocId: "FPSLREB-2026-003",
      sourceUrl: "https://decisions.fpslreb-crtespf.gc.ca/fpslreb/d/2026/003",
      title: "PIPSC v. CRA — Audit Group (AU) — Health & Safety",
      documentType: "full_agreement" as const,
      rawContent: "Sample content for PIPSC AU group health safety provisions...",
      contentHash: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
      isLatest: true,
      version: 1,
    },
  ];

  const docIds: string[] = [];
  for (const doc of sampleDocs) {
    const existing = await db
      .select({ id: cbaIntelDocuments.id })
      .from(cbaIntelDocuments)
      .where(eq(cbaIntelDocuments.sourceDocId, doc.sourceDocId));

    if (existing.length > 0) {
      docIds.push(existing[0].id);
      console.log(`  ✓ Document '${doc.sourceDocId}' already exists`);
      continue;
    }

    const [inserted] = await db
      .insert(cbaIntelDocuments)
      .values(doc)
      .returning({ id: cbaIntelDocuments.id });
    docIds.push(inserted.id);
    console.log(`  + Document '${doc.sourceDocId}' created`);
  }

  // ── 4. Extraction runs + Findings ─────────────────────────────────────────
  // Create a seed extraction run for each document
  const runIds: string[] = [];
  for (const docId of docIds) {
    const existingRun = await db
      .select({ id: cbaIntelExtractionRuns.id })
      .from(cbaIntelExtractionRuns)
      .where(eq(cbaIntelExtractionRuns.documentId, docId))
      .limit(1);

    if (existingRun.length > 0) {
      runIds.push(existingRun[0].id);
      continue;
    }

    const [run] = await db
      .insert(cbaIntelExtractionRuns)
      .values({
        documentId: docId,
        extractionMethod: "deterministic",
        status: "completed",
        findingsCount: 1,
        startedAt: new Date("2026-03-15T10:01:00Z"),
        completedAt: new Date("2026-03-15T10:01:30Z"),
        durationMs: 30000,
        triggeredBy: REVIEWER_ID,
      })
      .returning({ id: cbaIntelExtractionRuns.id });
    runIds.push(run.id);
    console.log(`  + Extraction run created for document ${docId}`);
  }

  const sampleFindings = [
    {
      documentId: docIds[0],
      extractionRunId: runIds[0],
      findingType: "wage_adjustment",
      clauseFamily: "wages" as const,
      label: "PA Group Annual Wage Increase — 2026",
      value: "3.5% base salary increase for PA group effective April 1, 2026.",
      confidence: "0.920",
      extractionMethod: "deterministic" as const,
      contentHash: "f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2",
      citationText: "The Board awards a 3.5% annual general increase to the PA classification...",
      reviewStatus: "pending_review",
    },
    {
      documentId: docIds[1],
      extractionRunId: runIds[1],
      findingType: "arbitration_outcome",
      clauseFamily: "remote_hybrid" as const,
      label: "EC Group Binding Arbitration — Remote Work",
      value: "Arbitrator ruled in favour of 3-day per week remote work for EC group.",
      confidence: "0.880",
      extractionMethod: "deterministic" as const,
      contentHash: "a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3",
      citationText: "The arbitrator awards that EC employees be permitted to work remotely...",
      reviewStatus: "pending_review",
    },
    {
      documentId: docIds[2],
      extractionRunId: runIds[2],
      findingType: "provision_change",
      clauseFamily: "health_safety" as const,
      label: "AU Group — Enhanced Ergonomic Assessment Requirements",
      value: "New provision requiring employer-funded ergonomic assessments every 2 years.",
      confidence: "0.850",
      extractionMethod: "deterministic" as const,
      contentHash: "b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4",
      citationText: "The employer shall provide ergonomic workplace assessments at intervals...",
      reviewStatus: "pending_review",
    },
  ];

  for (const finding of sampleFindings) {
    const existing = await db
      .select({ id: cbaIntelFindings.id })
      .from(cbaIntelFindings)
      .where(eq(cbaIntelFindings.contentHash, finding.contentHash));

    if (existing.length > 0) {
      console.log(`  ✓ Finding '${finding.label}' already exists`);
      continue;
    }

    await db.insert(cbaIntelFindings).values(finding);
    console.log(`  + Finding '${finding.label}' created`);
  }

  // ── 5. Review decision (approved) ────────────────────────────────────────
  const allFindings = await db
    .select({ id: cbaIntelFindings.id })
    .from(cbaIntelFindings)
    .limit(1);

  if (allFindings.length > 0) {
    const existingReview = await db
      .select({ id: cbaIntelReviewDecisions.id })
      .from(cbaIntelReviewDecisions)
      .where(eq(cbaIntelReviewDecisions.targetId, allFindings[0].id));

    if (existingReview.length === 0) {
      await db.insert(cbaIntelReviewDecisions).values({
        targetType: "finding",
        targetId: allFindings[0].id,
        decision: "approved",
        reason: "Verified against official FPSLREB decision text.",
        reviewerId: REVIEWER_ID,
        reviewerRole: "officer",
        previousStatus: "pending_review",
      });
      console.log("  + Review decision created (approved)");
    } else {
      console.log("  ✓ Review decision already exists");
    }
  }

  console.log("\n✅ CBA Intelligence seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
