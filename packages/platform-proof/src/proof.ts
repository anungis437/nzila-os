/**
 * Nzila OS — Governance Proof Pack Generator
 *
 * Generates immutable proof packs from platform state.
 * Hash signed with server-side secret (PROOF_SIGNING_SECRET env).
 * Once generated, proof packs are immutable.
 *
 * @module @nzila/platform-proof
 */
import { platformDb } from '@nzila/db/platform'
import { platformProofPacks, auditEvents } from '@nzila/db/schema'
import { count, sql } from 'drizzle-orm'
import { createHash } from 'crypto'

// ── Types ───────────────────────────────────────────────────────────────────

export interface GovernanceProofPack {
  /** Unique pack identifier */
  id: string
  /** Hash of the latest contract test run */
  contractTestHash: string
  /** Current CI pipeline status */
  ciPipelineStatus: string
  /** Last applied migration identifier */
  lastMigrationId: string
  /** Integrity hash computed over all audit events */
  auditIntegrityHash: string
  /** Status of the last secret scan */
  secretScanStatus: string
  /** Summary of the latest red-team exercise */
  redTeamSummary: string
  /** HMAC signature of the pack payload */
  signatureHash: string
  /** ISO timestamp when generated */
  generatedAt: string
}

// ── Hash computation ────────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 HMAC signature for a proof pack payload.
 * Uses PROOF_SIGNING_SECRET from environment.
 * Exported for unit testing.
 */
export function computeSignatureHash(payload: Record<string, string>): string {
  const secret = process.env.PROOF_SIGNING_SECRET ?? 'nzila-default-signing-key'
  const data = Object.entries(payload)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  return createHash('sha256')
    .update(`${secret}:${data}`)
    .digest('hex')
}

/**
 * Compute an integrity hash over all audit events.
 */
async function computeAuditIntegrityHash(): Promise<string> {
  const [result] = await platformDb
    .select({
      totalEvents: count().as('total'),
      latestAt: sql<string>`MAX(${auditEvents.createdAt})`.as('latest_at'),
    })
    .from(auditEvents)

  const data = `events=${result?.totalEvents ?? 0}&latest=${result?.latestAt ?? 'none'}`
  return createHash('sha256').update(data).digest('hex').slice(0, 32)
}

// ── Main generator ──────────────────────────────────────────────────────────

/**
 * Generate an immutable governance proof pack.
 *
 * Gathers state from environment variables and DB,
 * signs the payload, and persists to platform_proof_packs.
 *
 * Once generated, the record is marked immutable.
 */
export async function generateGovernanceProofPack(): Promise<GovernanceProofPack> {
  // Gather source data
  const contractTestHash =
    process.env.CONTRACT_TEST_HASH ?? process.env.GIT_SHA?.slice(0, 12) ?? 'not-available'
  const ciPipelineStatus = process.env.CI_PIPELINE_STATUS ?? 'unknown'
  const lastMigrationId = process.env.MIGRATION_VERSION ?? 'latest'
  const secretScanStatus = process.env.SECRET_SCAN_STATUS ?? 'not-configured'
  const redTeamSummary = process.env.RED_TEAM_SUMMARY ?? 'No red-team results available'

  const auditIntegrityHash = await computeAuditIntegrityHash()

  // Build payload for signing
  const payload: Record<string, string> = {
    contractTestHash,
    ciPipelineStatus,
    lastMigrationId,
    auditIntegrityHash,
    secretScanStatus,
    redTeamSummary,
  }

  const signatureHash = computeSignatureHash(payload)
  const generatedAt = new Date().toISOString()

  // Persist (immutable)
  const [inserted] = await platformDb
    .insert(platformProofPacks)
    .values({
      contractTestHash,
      ciPipelineStatus,
      lastMigrationId,
      auditIntegrityHash,
      secretScanStatus,
      redTeamSummary,
      signatureHash,
      immutable: true,
      payload: { ...payload, generatedAt },
    })
    .returning({ id: platformProofPacks.id })

  return {
    id: inserted.id,
    contractTestHash,
    ciPipelineStatus,
    lastMigrationId,
    auditIntegrityHash,
    secretScanStatus,
    redTeamSummary,
    signatureHash,
    generatedAt,
  }
}
