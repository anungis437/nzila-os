/**
 * Append-only version history of a shared clause (platform 0052, cache 0042).
 *
 * Called inside the caller's tenant transaction, with the change itself and its audit record, so a change that commits always has its
 * prior text on file and a failed insert abandons the change. A retried request cannot record the same version twice (unique on
 * clause, version and kind).
 */
import { createHash } from 'node:crypto'
import { sharedClauseVersions } from '@/db/schema/domains/agreements/shared-library'
import type { RLSTx } from '@/lib/db/with-rls-context'

export const clauseTextSha256 = (text: string | null | undefined) =>
  createHash('sha256').update(text ?? '', 'utf8').digest('hex')

export interface ClauseSnapshot {
  id: string
  version: number | null
  clauseNumber: string | null
  clauseTitle: string
  clauseText: string
  clauseType: string
  sharingLevel: string
}

export async function recordClauseVersion(
  tx: RLSTx,
  input: { organizationId: string; recordedBy: string; kind: 'replaced' | 'deleted'; clause: ClauseSnapshot },
): Promise<void> {
  const { clause } = input
  await tx
    .insert(sharedClauseVersions)
    .values({
      organizationId: input.organizationId,
      clauseId: clause.id,
      version: clause.version ?? 1,
      changeKind: input.kind,
      clauseNumber: clause.clauseNumber,
      clauseTitle: clause.clauseTitle,
      clauseText: clause.clauseText,
      clauseType: clause.clauseType,
      sharingLevel: clause.sharingLevel,
      textSha256: clauseTextSha256(clause.clauseText),
      recordedBy: input.recordedBy,
    })
    .onConflictDoNothing()
}
