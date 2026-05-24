/**
 * Proof Center — In-Memory Port Dependencies
 *
 * Provides RealPortsDeps for the procurement proof collectors.
 * In production these would be backed by real databases and services.
 * Currently uses in-memory stores that return real data structure
 * in the shape the collectors expect.
 *
 * NOTE: This adapter returns empty evidence/snapshot maps and a synthetic
 * "healthy" health report. It is suitable for local development and
 * staging dry-runs only. In production it will throw — wire a real
 * DB-backed RealPortsDeps before calling collectProcurementPack().
 *
 * @module @nzila/console/lib/proof-center-ports
 */
import type { RealPortsDeps } from '@nzila/platform-procurement-proof/real-ports'
import type { EvidencePackIndex } from '@nzila/platform-evidence-pack'
import type { ComplianceSnapshot, SnapshotChainEntry } from '@nzila/platform-compliance-snapshots'
import type { HealthReport } from '@nzila/platform-observability'
import { createLogger } from '@nzila/os-core/telemetry'
import { createDbPortDeps } from './proof-center-ports-db'

const logger = createLogger('console.proof-center-ports')

// ── In-Memory Stores ────────────────────────────────────────────────────────
// ga-check:exempt — port adapter stubs, replaced by real DB ports at runtime
const evidencePacks = new Map<string, EvidencePackIndex[]>()
// ga-check:exempt — port adapter stubs, replaced by real DB ports at runtime
const complianceSnapshots = new Map<string, ComplianceSnapshot[]>()
// ga-check:exempt — port adapter stubs, replaced by real DB ports at runtime
const snapshotChains = new Map<string, SnapshotChainEntry[]>()

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve the proof-center port dependencies for the given org.
 *
 * Prefers the live DB-backed adapter (`createDbPortDeps`) whenever a
 * `DATABASE_URL` is configured — this is the path used in staging and
 * production. Falls back to the in-memory stub only when no database is
 * configured AND we are not running in production, so dev/test workflows
 * still work without a Postgres instance. In production with no DB the
 * in-memory path throws (see `createInMemoryPortDeps`).
 */
export function createPortDeps(orgId: string): RealPortsDeps {
  if (process.env.DATABASE_URL) {
    return createDbPortDeps(orgId)
  }
  return createInMemoryPortDeps()
}

export function createInMemoryPortDeps(): RealPortsDeps {  if (process.env.NODE_ENV === 'production') {
    // Fail-closed: emitting an always-empty / always-healthy procurement pack
    // in production would falsify compliance, evidence, integration and
    // sovereignty signals shown in the Proof Center.
    throw new Error(
      'createInMemoryPortDeps() called in production. Wire a real DB-backed RealPortsDeps before invoking procurement-proof collectors.',
    )
  }
  if (typeof console !== 'undefined') {
    logger.warn(
      'using in-memory port deps — evidence packs, compliance snapshots, integrations and health checks are NOT real',
    )
  }  return {
    evidencePack: {
      async listPacks(orgId: string) {
        return evidencePacks.get(orgId) ?? []
      },
      async loadPack(packId: string) {
        for (const packs of evidencePacks.values()) {
          const found = packs.find((p) => p.packId === packId)
          if (found) return found
        }
        return null
      },
    },

    complianceSnapshots: {
      async listSnapshots(orgId: string) {
        return complianceSnapshots.get(orgId) ?? []
      },
      async loadChain(orgId: string) {
        return snapshotChains.get(orgId) ?? []
      },
    },

    integrations: {
      async listProviders() {
        return []
      },
      async getCircuitState() {
        return 'closed' as const
      },
      async getDeliveryStats() {
        return { total: 0, succeeded: 0, failed: 0, avgLatencyMs: 0 }
      },
      async getDlqDepth() {
        return 0
      },
    },

    observability: {
      async runHealthChecks(): Promise<HealthReport> {
        return {
          service: 'nzila-console',
          status: 'healthy',
          checks: [],
          timestamp: new Date().toISOString(),
        }
      },
    },

    sovereignty: {
      deploymentRegion: 'Canada Central',
      dataResidency: 'Canada',
      regulatoryFrameworks: ['PIPEDA', 'Québec Law 25'],
      crossBorderTransfer: false,
    },
  }
}

// ── Seed Helpers (for demo/testing) ─────────────────────────────────────────

export function seedEvidencePack(orgId: string, pack: EvidencePackIndex): void {
  const existing = evidencePacks.get(orgId) ?? []
  existing.push(pack)
  evidencePacks.set(orgId, existing)
}

export function seedComplianceSnapshot(
  orgId: string,
  snapshot: ComplianceSnapshot,
  chainEntry: SnapshotChainEntry,
): void {
  const existingSnapshots = complianceSnapshots.get(orgId) ?? []
  existingSnapshots.push(snapshot)
  complianceSnapshots.set(orgId, existingSnapshots)

  const existingChain = snapshotChains.get(orgId) ?? []
  existingChain.push(chainEntry)
  snapshotChains.set(orgId, existingChain)
}
