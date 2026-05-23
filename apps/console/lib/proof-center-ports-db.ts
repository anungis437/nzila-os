/**
 * Proof Center — DB-backed Port Dependencies
 *
 * Real `RealPortsDeps` implementation for the procurement-proof
 * collectors. Reads live data from the platform Postgres database via
 * Drizzle:
 *
 *   • evidencePack       → `evidence_packs` + `evidence_pack_artifacts`
 *                           joined with `documents` for blob metadata
 *   • complianceSnapshots → `trustcore_compliance_snapshots` (chain is
 *                           computed in-memory by hashing each row in
 *                           order — there is no separate chain table)
 *   • integrations       → `platform_integration_connections`,
 *                           `platform_integration_deliveries`,
 *                           `platform_integration_dlq_entries`
 *   • observability      → live `SELECT 1` probe against the DB
 *   • sovereignty        → environment-driven facts (defaults: Canada)
 *
 * Used by the Proof Center API routes and dashboard page whenever a
 * `DATABASE_URL` is configured. The in-memory variant in
 * `proof-center-ports.ts` is only used as a dev/test fallback.
 *
 * @module @nzila/console/lib/proof-center-ports-db
 */
import { createHash } from 'node:crypto'
import { and, asc, count, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from '@nzila/db'
import {
  documents,
  evidencePackArtifacts,
  evidencePacks,
  platformIntegrationConnections,
  platformIntegrationDeliveries,
  platformIntegrationDlqEntries,
  trustcoreComplianceSnapshots,
} from '@nzila/db/schema'
import type { RealPortsDeps } from '@nzila/platform-procurement-proof/real-ports'
import type {
  EvidenceArtifact,
  EvidencePackIndex,
} from '@nzila/platform-evidence-pack'
import type {
  ComplianceSnapshot,
  SnapshotChainEntry,
  SnapshotStatus,
} from '@nzila/platform-compliance-snapshots'
import type { HealthReport, HealthStatus } from '@nzila/platform-observability'

// ── Helpers ─────────────────────────────────────────────────────────────────

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString()
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function coerceControlsCovered(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function mapSnapshotStatus(raw: string | null | undefined): SnapshotStatus {
  // DB stores trustcore evaluation statuses (`compliant` / `at-risk` /
  // `non-compliant`); the procurement-proof contract uses lifecycle
  // statuses. Treat verified/chained DB rows as `chained`, in-flight
  // ones as `pending`, and any non-compliant evaluation as `failed`.
  switch (raw) {
    case 'compliant':
      return 'chained'
    case 'at-risk':
      return 'collected'
    case 'non-compliant':
      return 'failed'
    case 'pending':
    case 'collected':
    case 'chained':
    case 'verified':
    case 'failed':
      return raw
    default:
      return 'pending'
  }
}

function deriveSnapshotSummary(row: {
  score: number
  riskCount: number
  blockingCount: number
  summary: unknown
}): ComplianceSnapshot['summary'] {
  // Prefer counts embedded in the stored `summary` jsonb when present.
  const stored =
    row.summary && typeof row.summary === 'object'
      ? (row.summary as Record<string, unknown>)
      : {}
  const num = (k: string): number | undefined => {
    const v = stored[k]
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined
  }
  const totalControls = num('totalControls') ?? row.riskCount
  const compliant = num('compliant') ?? Math.max(0, totalControls - row.riskCount)
  const nonCompliant = num('nonCompliant') ?? row.blockingCount
  const partial = num('partial') ?? Math.max(0, row.riskCount - row.blockingCount)
  const notAssessed = num('notAssessed') ?? 0
  return {
    totalControls,
    compliant,
    nonCompliant,
    partial,
    notAssessed,
    complianceScore: row.score,
  }
}

function snapshotRowToDomain(
  row: typeof trustcoreComplianceSnapshots.$inferSelect,
  version: number,
): ComplianceSnapshot {
  return {
    snapshotId: row.id,
    orgId: row.orgId,
    version,
    status: mapSnapshotStatus(row.status),
    collectedAt: toIsoString(row.createdAt),
    collectedBy: row.triggeredBy ?? 'system',
    controls: [],
    summary: deriveSnapshotSummary(row),
    metadata: {
      triggeredBy: row.triggeredBy ?? 'system',
      score: String(row.score),
      confidence: String(row.confidence),
      rawStatus: row.status,
    },
  }
}

function hashSnapshot(snapshot: ComplianceSnapshot, previousHash: string | null): string {
  const payload = JSON.stringify({
    snapshotId: snapshot.snapshotId,
    orgId: snapshot.orgId,
    version: snapshot.version,
    status: snapshot.status,
    collectedAt: snapshot.collectedAt,
    summary: snapshot.summary,
    previousHash,
  })
  return createHash('sha256').update(payload).digest('hex')
}

// ── Public API ──────────────────────────────────────────────────────────────

export function createDbPortDeps(orgId: string): RealPortsDeps {
  return {
    evidencePack: {
      async listPacks(scopedOrgId: string): Promise<readonly EvidencePackIndex[]> {
        const packRows = await db
          .select()
          .from(evidencePacks)
          .where(eq(evidencePacks.orgId, scopedOrgId))
          .orderBy(desc(evidencePacks.createdAt))
          .limit(50)
        const out: EvidencePackIndex[] = []
        for (const row of packRows) {
          out.push(await loadPackIndex(row))
        }
        return out
      },
      async loadPack(packId: string): Promise<EvidencePackIndex | null> {
        const [row] = await db
          .select()
          .from(evidencePacks)
          .where(eq(evidencePacks.packId, packId))
          .limit(1)
        if (!row) return null
        return loadPackIndex(row)
      },
    },

    complianceSnapshots: {
      async listSnapshots(scopedOrgId: string): Promise<readonly ComplianceSnapshot[]> {
        const rows = await db
          .select()
          .from(trustcoreComplianceSnapshots)
          .where(eq(trustcoreComplianceSnapshots.orgId, scopedOrgId))
          .orderBy(asc(trustcoreComplianceSnapshots.createdAt))
          .limit(100)
        return rows.map((row, idx) => snapshotRowToDomain(row, idx + 1))
      },
      async loadChain(scopedOrgId: string): Promise<readonly SnapshotChainEntry[]> {
        const rows = await db
          .select()
          .from(trustcoreComplianceSnapshots)
          .where(eq(trustcoreComplianceSnapshots.orgId, scopedOrgId))
          .orderBy(asc(trustcoreComplianceSnapshots.createdAt))
          .limit(100)
        const chain: SnapshotChainEntry[] = []
        let previousHash: string | null = null
        rows.forEach((row, idx) => {
          const snapshot = snapshotRowToDomain(row, idx + 1)
          const snapshotHash = hashSnapshot(snapshot, previousHash)
          chain.push({
            snapshotId: snapshot.snapshotId,
            orgId: snapshot.orgId,
            version: snapshot.version,
            snapshotHash,
            previousHash,
            chainedAt: snapshot.collectedAt,
          })
          previousHash = snapshotHash
        })
        return chain
      },
    },

    integrations: {
      async listProviders(): Promise<string[]> {
        const rows = await db
          .selectDistinct({ provider: platformIntegrationConnections.provider })
          .from(platformIntegrationConnections)
          .where(eq(platformIntegrationConnections.orgId, orgId))
        return rows.map((r) => r.provider)
      },
      async getCircuitState(provider, scopedOrgId) {
        const rows = await db
          .select({ status: platformIntegrationDeliveries.status })
          .from(platformIntegrationDeliveries)
          .where(
            and(
              eq(platformIntegrationDeliveries.orgId, scopedOrgId),
              eq(
                platformIntegrationDeliveries.provider,
                provider as typeof platformIntegrationDeliveries.provider.enumValues[number],
              ),
            ),
          )
          .orderBy(desc(platformIntegrationDeliveries.createdAt))
          .limit(10)
        if (rows.length === 0) return 'closed'
        const recent = rows.slice(0, 5)
        const recentFailed = recent.filter(
          (r) => r.status === 'failed' || r.status === 'dlq',
        ).length
        if (recentFailed >= 5) return 'open'
        if (recentFailed > 0) return 'half-open'
        return 'closed'
      },
      async getDeliveryStats(provider, sinceMs) {
        const since = new Date(Date.now() - sinceMs)
        const rows = await db
          .select({
            status: platformIntegrationDeliveries.status,
            cnt: count(),
          })
          .from(platformIntegrationDeliveries)
          .where(
            and(
              eq(platformIntegrationDeliveries.orgId, orgId),
              eq(
                platformIntegrationDeliveries.provider,
                provider as typeof platformIntegrationDeliveries.provider.enumValues[number],
              ),
              gte(platformIntegrationDeliveries.createdAt, since),
            ),
          )
          .groupBy(platformIntegrationDeliveries.status)
        let total = 0
        let succeeded = 0
        let failed = 0
        for (const r of rows) {
          const c = Number(r.cnt)
          total += c
          if (r.status === 'sent') succeeded += c
          else if (r.status === 'failed' || r.status === 'dlq') failed += c
        }
        return { total, succeeded, failed, avgLatencyMs: 0 }
      },
      async getDlqDepth(scopedOrgId: string): Promise<number> {
        const [row] = await db
          .select({ cnt: count() })
          .from(platformIntegrationDlqEntries)
          .where(
            and(
              eq(platformIntegrationDlqEntries.orgId, scopedOrgId),
              isNull(platformIntegrationDlqEntries.replayedAt),
            ),
          )
        return row ? Number(row.cnt) : 0
      },
    },

    observability: {
      async runHealthChecks(): Promise<HealthReport> {
        const dbCheck = await probeDatabase()
        const overall: HealthStatus = dbCheck.status
        return {
          service: 'nzila-console',
          status: overall,
          checks: [dbCheck],
          timestamp: new Date().toISOString(),
        }
      },
    },

    sovereignty: {
      deploymentRegion: process.env.NZILA_DEPLOYMENT_REGION ?? 'Canada Central',
      dataResidency: process.env.NZILA_DATA_RESIDENCY ?? 'Canada',
      regulatoryFrameworks: (process.env.NZILA_REGULATORY_FRAMEWORKS ?? 'PIPEDA,Québec Law 25')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      crossBorderTransfer:
        (process.env.NZILA_CROSS_BORDER_TRANSFER ?? 'false').toLowerCase() === 'true',
    },
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

async function loadPackIndex(
  row: typeof evidencePacks.$inferSelect,
): Promise<EvidencePackIndex> {
  const joined = await db
    .select({
      artifactId: evidencePackArtifacts.artifactId,
      artifactType: evidencePackArtifacts.artifactType,
      blobPath: documents.blobPath,
      sha256: documents.sha256,
      sizeBytes: documents.sizeBytes,
      contentType: documents.contentType,
      uploadedAt: documents.uploadedAt,
      classification: documents.classification,
      retentionClass: evidencePackArtifacts.retentionClass,
    })
    .from(evidencePackArtifacts)
    .innerJoin(documents, eq(documents.id, evidencePackArtifacts.documentId))
    .where(eq(evidencePackArtifacts.packId, row.id))

  const artifacts: EvidenceArtifact[] = joined.map((a) => ({
    artifactId: a.artifactId,
    artifactType: a.artifactType,
    sha256: a.sha256,
    sizeBytes: a.sizeBytes != null ? Number(a.sizeBytes) : 0,
    mimeType: a.contentType,
    blobPath: a.blobPath,
    collectedAt: toIsoString(a.uploadedAt),
    metadata: {
      classification: a.classification ?? 'internal',
      retentionClass: a.retentionClass,
    },
  }))

  return {
    packId: row.packId,
    orgId: row.orgId,
    controlFamily: row.controlFamily,
    eventType: row.eventType,
    eventId: row.eventId,
    runId: row.runId,
    createdBy: row.createdBy,
    createdAt: toIsoString(row.createdAt),
    summary: row.summary ?? '',
    controlsCovered: coerceControlsCovered(row.controlsCovered),
    artifacts,
  }
}

async function probeDatabase(): Promise<{
  name: string
  status: HealthStatus
  message?: string
  latencyMs: number
}> {
  const start = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    return {
      name: 'platform-db',
      status: 'healthy',
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      name: 'platform-db',
      status: 'down',
      message: err instanceof Error ? err.message : 'database probe failed',
      latencyMs: Date.now() - start,
    }
  }
}
