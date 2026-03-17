/**
 * Evidence Contract — canonical interface for evidence export.
 *
 * Apps produce evidence packs for audit trails, compliance
 * reviews, and proof-of-execution records.
 */

export type EvidenceFormat = 'json' | 'pdf' | 'csv'

export interface EvidenceArtifact {
  artifact_id: string
  type: string
  format: EvidenceFormat
  size_bytes: number
  hash: string
  generated_at: string
}

export interface EvidenceExport {
  app: string
  org_id: string
  export_id: string
  artifacts: EvidenceArtifact[]
  chain_hash: string
  exported_at: string
}

export interface EvidenceContract {
  export(orgId: string, fromDate: string, toDate: string): Promise<EvidenceExport>
}
