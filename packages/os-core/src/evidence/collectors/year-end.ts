/**
 * Evidence Collector: Year-End Compliance Pack
 *
 * Aggregates all evidence categories into a final year-end pack summary.
 * Acts as an index that references the full collection of artifacts.
 */
import type { EvidenceArtifact } from '../types'

export interface YearEndPackOptions {
  year: number
  /** Unique IDs of all evidence packs included in this year-end bundle */
  evidencePackIds: string[]
  /** Blob container where year-end artifacts are stored */
  blobContainer: string
  /** Summary statistics from sub-collectors */
  securityPassed: boolean
  schemaDriftDetected: boolean
  mlDriftedModelCount: number
  aiEvalPassRate: number
  incidentSimCount: number
  stripeReconciled: boolean
  retentionRunCount: number
  auditEventCount: number
}

export function collectYearEndEvidence(opts: YearEndPackOptions): EvidenceArtifact[] {
  const allPassed =
    opts.securityPassed &&
    !opts.schemaDriftDetected &&
    opts.mlDriftedModelCount === 0 &&
    opts.aiEvalPassRate >= 0.9 &&
    opts.stripeReconciled

  return [
    {
      type: 'year-end-summary',
      periodLabel: `${opts.year}`,
      year: opts.year,
      evidencePackCount: opts.evidencePackIds.length,
      evidencePackIds: opts.evidencePackIds,
      blobContainer: opts.blobContainer,
      checks: {
        securityPassed: opts.securityPassed,
        schemaDriftDetected: opts.schemaDriftDetected,
        mlDriftedModelCount: opts.mlDriftedModelCount,
        aiEvalPassRate: opts.aiEvalPassRate,
        incidentSimCount: opts.incidentSimCount,
        stripeReconciled: opts.stripeReconciled,
        retentionRunCount: opts.retentionRunCount,
        auditEventCount: opts.auditEventCount,
      },
      overallPassed: allPassed,
      collectedAt: new Date().toISOString(),
    },
  ]
}
