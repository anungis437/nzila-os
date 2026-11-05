/**
 * Voting-session lifecycle rules (UE-CONV-K-009, Governance Officer G12: voting integrity and certification).
 *
 * A session is an election instrument. Once it has opened, its terms and its ballots are evidence: they may not be
 * rewritten, reopened or deleted by whoever holds a role floor. Cancellation, not deletion, is how a session ends
 * early. Extending an open session's closing time is not a role privilege: `checkSessionExtension` accepts only a grant
 * the authority kernel loaded for that session. No such grant is issued, and the session route does not read one from
 * the request, so an opened session's terms stay locked.
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

export type InstrumentChange =
  | { ok: true }
  | { ok: false; code: 'UNKNOWN_STATUS' | 'INSTRUMENT_LOCKED'; message: string }

export class VotingRuleError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'VotingRuleError'
    this.code = code
  }
}

/** Options, eligibility and proxies are part of the instrument. Only a draft may change them. */
export function checkVotingInstrumentChange(current: string): InstrumentChange {
  if (!isStatus(current)) {
    return { ok: false, code: 'UNKNOWN_STATUS', message: 'The session is in a state this operation does not recognise.' }
  }
  if (current !== 'draft') {
    return {
      ok: false,
      code: 'INSTRUMENT_LOCKED',
      message: 'Voting options, eligibility and proxies cannot change once the session has opened.',
    }
  }
  return { ok: true }
}

/**
 * A kernel-loaded extension grant. A mandate id, an officer name, or any other request field is not a grant:
 * `loadedBy` is set only by the authority kernel, and no voting action issues this grant yet.
 */
export interface LoadedSessionExtensionGrant {
  loadedBy: 'authority-kernel'
  action: 'voting:extend_session'
  organizationId: string
  sessionId: string
  issued: true
}

export type ExtensionChange =
  | { ok: true }
  | { ok: false; code: 'UNKNOWN_STATUS' | 'EXTENSION_NOT_OPEN' | 'EXTENSION_TERMINAL' | 'EXTENSION_UNISSUED'; message: string }

function isExtensionGrant(grant: LoadedSessionExtensionGrant | null, organizationId: string, sessionId: string): grant is LoadedSessionExtensionGrant {
  return Boolean(
    grant &&
      grant.issued === true &&
      grant.loadedBy === 'authority-kernel' &&
      grant.action === 'voting:extend_session' &&
      grant.organizationId === organizationId &&
      grant.sessionId === sessionId,
  )
}

/**
 * The only term an open session may gain is a later closing time, and only when the kernel loaded a grant for this
 * session. Closed and cancelled sessions stay terminal. A draft uses the ordinary term edit.
 */
export function checkSessionExtension(
  current: string,
  organizationId: string,
  sessionId: string,
  endTime: unknown,
  grant: LoadedSessionExtensionGrant | null,
): ExtensionChange {
  if (!isStatus(current)) {
    return { ok: false, code: 'UNKNOWN_STATUS', message: 'The session is in a state this operation does not recognise.' }
  }
  if (current === 'draft') {
    return { ok: false, code: 'EXTENSION_NOT_OPEN', message: 'A draft session changes its closing time through the ordinary term edit.' }
  }
  if (current === 'closed' || current === 'cancelled') {
    return { ok: false, code: 'EXTENSION_TERMINAL', message: 'A closed or cancelled voting session cannot be extended.' }
  }
  if (endTime === undefined || endTime === null || endTime === '') {
    return { ok: false, code: 'EXTENSION_UNISSUED', message: 'An extension changes only the closing time.' }
  }
  if (!isExtensionGrant(grant, organizationId, sessionId)) {
    return {
      ok: false,
      code: 'EXTENSION_UNISSUED',
      message: 'An open voting session is extended only by an authority-kernel grant for that session. A request field is not a grant.',
    }
  }
  return { ok: true }
}

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
