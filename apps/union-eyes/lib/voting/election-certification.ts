/**
 * Council election certification rule (UE-CONV-K-009, G12). Once an election carries a verification (an independent
 * auditor's name or date), its candidates, results and turnout are certified evidence and may not be rewritten through
 * an ordinary update. The only change still permitted is raising or clearing the contested flag, which is how a
 * dispute is recorded against a certified result. Re-certifying or correcting a certified result needs a separate,
 * independently authorised procedure that does not exist yet.
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
