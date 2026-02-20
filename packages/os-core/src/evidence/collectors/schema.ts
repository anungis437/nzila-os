/**
 * Evidence Collector: Database Schema Validation
 *
 * Produces an evidence artifact proving the current DB schema matches
 * the committed migration state — no surprise drift.
 */
import type { EvidenceArtifact } from '../types'

export interface SchemaEvidenceOptions {
  periodLabel: string
  /** Result from running `pnpm drizzle-kit check` */
  driftPresent: boolean
  driftDetails?: string[]
  /** Result of running migration validation */
  allMigrationsApplied?: boolean
  /** Git commit hash of the schema snapshot */
  schemaSnapshotCommit?: string
  snapshotHash?: string
}

export function collectSchemaEvidence(opts: SchemaEvidenceOptions): EvidenceArtifact[] {
  return [
    {
      type: 'db-schema-validation',
      periodLabel: opts.periodLabel,
      driftPresent: opts.driftPresent,
      driftDetails: opts.driftDetails ?? [],
      allMigrationsApplied: opts.allMigrationsApplied ?? true,
      schemaSnapshotCommit: opts.schemaSnapshotCommit ?? null,
      snapshotHash: opts.snapshotHash ?? null,
      passed: !opts.driftPresent && (opts.allMigrationsApplied ?? true),
      collectedAt: new Date().toISOString(),
    },
  ]
}
