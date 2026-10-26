/**
 * Voting-session lifecycle rules (UE-CONV-K-009, Governance Officer G12: voting integrity and certification).
 *
 * A session is an election instrument. Once it has opened, its terms and its ballots are evidence: they may not be
 * rewritten, reopened or deleted by whoever holds a role floor. Cancellation, not deletion, is how a session ends
 * early. Whether an election officer may extend an open session's closing time is an institutional decision that has
 * not been made, so no term of an opened session is editable here.
 */
export type VotingSessionStatus = 'draft' | 'active' | 'paused' | 'closed' | 'cancelled'

const TRANSITIONS: Record<VotingSessionStatus, readonly VotingSessionStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['paused', 'closed', 'cancelled'],
  paused: ['active', 'closed', 'cancelled'],
  closed: [],
  cancelled: [],
}

const TERM_FIELDS = ['title', 'description', 'startTime', 'endTime'] as const

export type SessionChange = { ok: true } | { ok: false; code: 'UNKNOWN_STATUS' | 'ILLEGAL_TRANSITION' | 'TERMS_LOCKED'; message: string }

const isStatus = (value: unknown): value is VotingSessionStatus => typeof value === 'string' && Object.hasOwn(TRANSITIONS, value)

/** Decides a proposed update against the session's current status. Fails closed on an unrecognised status. */
export function checkSessionUpdate(current: string, changes: Record<string, unknown>): SessionChange {
  if (!isStatus(current)) return { ok: false, code: 'UNKNOWN_STATUS', message: 'The session is in a state this operation does not recognise.' }
  const next = changes.status
  if (next !== undefined && next !== current) {
    if (!isStatus(next) || !TRANSITIONS[current].includes(next)) {
      return { ok: false, code: 'ILLEGAL_TRANSITION', message: `A ${current} voting session cannot become ${String(next)}.` }
    }
  }
  const editsTerms = TERM_FIELDS.some((field) => changes[field] !== undefined)
  if (editsTerms && current !== 'draft') {
    return { ok: false, code: 'TERMS_LOCKED', message: 'The terms of a voting session cannot change once it has opened.' }
  }
  return { ok: true }
}

export type SessionDeletion = { ok: true } | { ok: false; code: 'UNKNOWN_STATUS' | 'NOT_DRAFT' | 'HAS_BALLOTS'; message: string }

/** Only a draft with no ballots may be deleted; everything else is cancelled and kept as a record. */
export function checkSessionDeletion(current: string, ballotCount: number): SessionDeletion {
  if (!isStatus(current)) return { ok: false, code: 'UNKNOWN_STATUS', message: 'The session is in a state this operation does not recognise.' }
  if (current !== 'draft') return { ok: false, code: 'NOT_DRAFT', message: 'A voting session that has opened is cancelled, not deleted.' }
  if (ballotCount > 0) return { ok: false, code: 'HAS_BALLOTS', message: 'A voting session with ballots cannot be deleted.' }
  return { ok: true }
}
