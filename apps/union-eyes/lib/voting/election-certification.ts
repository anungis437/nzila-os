/**
 * Council election certification rule (UE-CONV-K-009, G12). Once an election carries a verification (an independent
 * auditor's name or date), its candidates, results and turnout are certified evidence and may not be rewritten through
 * an ordinary update. The only change still permitted is raising or clearing the contested flag, which is how a
 * dispute is recorded against a certified result. A correction is a new record that names the certified election.
 * `planCertifiedSupersession` copies the certified facts from the stored row and does not write them. Persistence is
 * `recordCertifiedSupersession` in election-succession.ts, which inserts an uncertified successor and a succession
 * row. No kernel action issues the correction grant, so the HTTP route passes no grant and writes nothing.
 */
export interface ElectionRecord {
  verifiedBy?: string | null
  verificationDate?: string | Date | null
}

const RESULT_FIELDS = ['electionYear', 'electionDate', 'positionsAvailable', 'candidates', 'winners', 'totalVotes', 'participationRate', 'verifiedBy', 'verificationDate'] as const

export type ElectionChange = { ok: true } | { ok: false; code: 'CERTIFIED_RESULTS_LOCKED'; message: string }

export function checkElectionUpdate(existing: ElectionRecord, updates: Record<string, unknown>): ElectionChange {
  const certified = Boolean(existing.verifiedBy) || Boolean(existing.verificationDate)
  if (!certified) return { ok: true }
  if (RESULT_FIELDS.some((field) => updates[field] !== undefined)) {
    return { ok: false, code: 'CERTIFIED_RESULTS_LOCKED', message: 'The results of a certified election cannot be changed. Record a dispute by marking the result contested.' }
  }
  return { ok: true }
}

export interface CertifiedElection extends ElectionRecord {
  id: string
  electionYear: number
  electionDate: string
  positionsAvailable: number
  candidates: unknown
  winners: unknown
  totalVotes: number
  participationRate?: number | null
}

/** Loaded by the authority kernel. A request field is not a grant, and no election action issues one yet. */
export interface LoadedCorrectionGrant {
  loadedBy: 'authority-kernel'
  action: 'election:supersede_certified_result'
  electionId: string
  issued: true
}

export interface ProposedSuccessor {
  supersedesElectionId: string
  electionYear: number
  electionDate: string
  positionsAvailable: number
  candidates: unknown
  winners: unknown
  totalVotes: number
  participationRate: number | null
  verifiedBy: null
  verificationDate: null
  contestedResults: false
}

export type CertifiedSupersession =
  | { ok: false; code: 'NOT_CERTIFIED' | 'CORRECTION_UNISSUED'; message: string }
  | { ok: true; persisted: false; proposedSuccessor: ProposedSuccessor }

function isCorrectionGrant(grant: LoadedCorrectionGrant | null, electionId: string): grant is LoadedCorrectionGrant {
  return Boolean(
    grant &&
      grant.issued === true &&
      grant.loadedBy === 'authority-kernel' &&
      grant.action === 'election:supersede_certified_result' &&
      grant.electionId === electionId,
  )
}

/**
 * Describes a successor and does not persist it. The certified row stays as stored. The HTTP route does not call
 * this with a request body. `recordCertifiedSupersession` is the only writer, and it still requires a kernel grant
 * plus the unqualified succession table.
 */
export function planCertifiedSupersession(existing: CertifiedElection, grant: LoadedCorrectionGrant | null): CertifiedSupersession {
  const certified = Boolean(existing.verifiedBy) || Boolean(existing.verificationDate)
  if (!certified) {
    return { ok: false, code: 'NOT_CERTIFIED', message: 'An uncertified election is corrected through the ordinary update.' }
  }
  if (!isCorrectionGrant(grant, existing.id)) {
    return {
      ok: false,
      code: 'CORRECTION_UNISSUED',
      message: 'A certified result is superseded only by an authority-kernel grant for that election. A request field is not a grant.',
    }
  }
  return {
    ok: true,
    persisted: false,
    proposedSuccessor: {
      supersedesElectionId: existing.id,
      electionYear: existing.electionYear,
      electionDate: existing.electionDate,
      positionsAvailable: existing.positionsAvailable,
      candidates: existing.candidates,
      winners: existing.winners,
      totalVotes: existing.totalVotes,
      participationRate: existing.participationRate ?? null,
      verifiedBy: null,
      verificationDate: null,
      contestedResults: false,
    },
  }
}
