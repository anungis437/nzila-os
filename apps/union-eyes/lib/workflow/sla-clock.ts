/**
 * Where the SLA clock of a claim starts: the last change of its STATUS (claims.status_changed_at, kept by the database from platform
 * 0049), never the last edit. A claim whose status history is unknown (it predates the column) starts at its creation, so an edit
 * can neither restart nor hide its clock; the answer says which basis it used.
 */
export type SlaClockBasis = 'status_change' | 'creation_unknown_history' | 'unavailable'

export function slaClockStart(
  claim: { statusChangedAt?: Date | null; createdAt?: Date | null },
  now: Date,
): { startedAt: Date; basis: SlaClockBasis } {
  if (claim.statusChangedAt) return { startedAt: claim.statusChangedAt, basis: 'status_change' }
  if (claim.createdAt) return { startedAt: claim.createdAt, basis: 'creation_unknown_history' }
  return { startedAt: now, basis: 'unavailable' }
}
