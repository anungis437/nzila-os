/**
 * Nzila OS — Data Lifecycle Proof Section
 *
 * Extends the governance proof pack with data lifecycle manifest
 * summaries so proof packs answer procurement data lifecycle questions.
 *
 * Includes:
 *   - Per-app manifest summary (retention classes, residency, backup)
 *   - Overall compliance status (every app has a valid manifest)
 *   - Manifest hashes for integrity verification
 *
 * @module @nzila/platform-proof/data-lifecycle
 */
import { computeSignatureHash } from './proof'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AppManifestSummary {
  readonly appId: string
  readonly appName: string
  readonly version: string
  readonly dataCategoryCount: number
  readonly containsPii: boolean
  readonly containsFinancial: boolean
  readonly highestRetentionClass: string
  readonly residencyType: string
  readonly residencyRegions: readonly string[]
  readonly backupFrequency: string
  readonly rtoHours: number
  readonly rpoHours: number
  readonly manifestHash: string
}

export interface DataLifecycleProofSection {
  readonly sectionId: string
  readonly sectionType: 'data_lifecycle'
  readonly generatedAt: string
  /** Per-app manifest summaries */
  readonly appSummaries: readonly AppManifestSummary[]
  /** Total apps with manifests */
  readonly totalAppsWithManifests: number
  /** Total apps missing manifests */
  readonly totalAppsMissingManifests: number
  /** Apps missing manifests */
  readonly missingApps: readonly string[]
  /** Overall manifest compliance */
  readonly allAppsCompliant: boolean
  /** HMAC signature */
  readonly signatureHash: string
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface DataLifecycleProofPorts {
  /** Get all manifest summaries */
  readonly fetchManifestSummaries: () => Promise<readonly AppManifestSummary[]>
  /** Get list of all app IDs that should have manifests */
  readonly fetchAllAppIds: () => Promise<readonly string[]>
}

// ── Section Generator ───────────────────────────────────────────────────────

/**
 * Generate a data lifecycle proof section.
 *
 * This does not persist — callers attach the section
 * to the main proof pack payload before persisting.
 */
export async function generateDataLifecycleProofSection(
  ports: DataLifecycleProofPorts,
): Promise<DataLifecycleProofSection> {
  const [summaries, allAppIds] = await Promise.all([
    ports.fetchManifestSummaries(),
    ports.fetchAllAppIds(),
  ])

  const manifestAppIds = new Set(summaries.map((s) => s.appId))
  const missingApps = allAppIds.filter((id) => !manifestAppIds.has(id))

  const generatedAt = new Date().toISOString()

  const sigPayload: Record<string, string> = {
    sectionType: 'data_lifecycle',
    generatedAt,
    totalAppsWithManifests: String(summaries.length),
    totalAppsMissingManifests: String(missingApps.length),
    allAppsCompliant: String(missingApps.length === 0),
    manifestHashes: summaries.map((s) => s.manifestHash).sort().join(','),
  }

  const signatureHash = computeSignatureHash(sigPayload)

  return {
    sectionId: `dl-proof-${Date.now()}`,
    sectionType: 'data_lifecycle',
    generatedAt,
    appSummaries: summaries,
    totalAppsWithManifests: summaries.length,
    totalAppsMissingManifests: missingApps.length,
    missingApps,
    allAppsCompliant: missingApps.length === 0,
    signatureHash,
  }
}
