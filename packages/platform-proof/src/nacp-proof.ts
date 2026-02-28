/**
 * Nzila OS — NACP Integrity Proof Section
 *
 * Extends the governance proof pack with NACP exam integrity data:
 *   - Seal verification status per terminal event type
 *   - Last sealed events
 *   - Anomalies (missing seals, out-of-order events)
 *   - Export proof hash
 *
 * Pure computation, ports-injected, HMAC-signed.
 *
 * @module @nzila/platform-proof/nacp
 */
import { computeSignatureHash } from './proof'

// ── Types ───────────────────────────────────────────────────────────────────

export interface NacpSealStatus {
  readonly eventType: string
  readonly totalEvents: number
  readonly sealedCount: number
  readonly unsealedCount: number
  readonly lastSealedAt: string | null
  readonly lastSubjectId: string | null
}

export interface NacpAnomaly {
  readonly type: 'missing_seal' | 'out_of_order' | 'chain_break' | 'duplicate_seal'
  readonly subjectId: string
  readonly eventType: string
  readonly detectedAt: string
  readonly description: string
}

export interface NacpIntegrityProofSection {
  readonly sectionId: string
  readonly sectionType: 'nacp_integrity'
  readonly generatedAt: string
  /** Seal verification status per terminal event type */
  readonly sealStatuses: readonly NacpSealStatus[]
  /** Total sealed evidence packs */
  readonly totalSealedPacks: number
  /** Total events missing seals */
  readonly totalMissingSeals: number
  /** Detected anomalies */
  readonly anomalies: readonly NacpAnomaly[]
  /** Hash of the latest export proof (if any) */
  readonly exportProofHash: string | null
  /** Hash chain length (number of entries) */
  readonly hashChainLength: number
  /** Hash chain head (latest chain hash) */
  readonly hashChainHead: string | null
  /** Overall integrity verdict */
  readonly integrityVerdict: 'pass' | 'warn' | 'fail'
  /** HMAC signature */
  readonly signatureHash: string
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface NacpIntegrityProofPorts {
  /** Fetch seal status per terminal event type for an org */
  readonly fetchSealStatuses: (orgId: string) => Promise<readonly NacpSealStatus[]>
  /** Fetch detected anomalies for an org */
  readonly fetchAnomalies: (orgId: string) => Promise<readonly NacpAnomaly[]>
  /** Fetch the latest export proof hash for an org */
  readonly fetchExportProofHash: (orgId: string) => Promise<string | null>
  /** Fetch hash chain length and head for an org */
  readonly fetchHashChainInfo: (orgId: string) => Promise<{
    length: number
    head: string | null
  }>
}

// ── Verdict Computation ─────────────────────────────────────────────────────

function computeVerdict(
  totalMissingSeals: number,
  anomalies: readonly NacpAnomaly[],
): 'pass' | 'warn' | 'fail' {
  const hasChainBreaks = anomalies.some((a) => a.type === 'chain_break')
  if (hasChainBreaks || totalMissingSeals > 0) return 'fail'
  if (anomalies.length > 0) return 'warn'
  return 'pass'
}

// ── Section Generator ───────────────────────────────────────────────────────

/**
 * Generate a NACP integrity proof section.
 *
 * This does not persist — callers attach the section
 * to the main proof pack payload before persisting.
 */
export async function generateNacpIntegrityProofSection(
  orgId: string,
  ports: NacpIntegrityProofPorts,
): Promise<NacpIntegrityProofSection> {
  const [sealStatuses, anomalies, exportProofHash, chainInfo] = await Promise.all([
    ports.fetchSealStatuses(orgId),
    ports.fetchAnomalies(orgId),
    ports.fetchExportProofHash(orgId),
    ports.fetchHashChainInfo(orgId),
  ])

  const totalSealedPacks = sealStatuses.reduce((s, e) => s + e.sealedCount, 0)
  const totalMissingSeals = sealStatuses.reduce((s, e) => s + e.unsealedCount, 0)
  const integrityVerdict = computeVerdict(totalMissingSeals, anomalies)

  const generatedAt = new Date().toISOString()

  const sigPayload: Record<string, string> = {
    sectionType: 'nacp_integrity',
    orgId,
    generatedAt,
    totalSealedPacks: String(totalSealedPacks),
    totalMissingSeals: String(totalMissingSeals),
    anomalyCount: String(anomalies.length),
    exportProofHash: exportProofHash ?? 'none',
    hashChainLength: String(chainInfo.length),
    hashChainHead: chainInfo.head ?? 'none',
    integrityVerdict,
  }

  const signatureHash = computeSignatureHash(sigPayload)

  return {
    sectionId: `nacp-integrity-${orgId}-${Date.now()}`,
    sectionType: 'nacp_integrity',
    generatedAt,
    sealStatuses,
    totalSealedPacks,
    totalMissingSeals,
    anomalies,
    exportProofHash,
    hashChainLength: chainInfo.length,
    hashChainHead: chainInfo.head,
    integrityVerdict,
    signatureHash,
  }
}
