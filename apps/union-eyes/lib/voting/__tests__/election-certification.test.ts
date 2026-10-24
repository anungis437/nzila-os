import { describe, expect, it } from 'vitest'
import { checkElectionUpdate } from '../election-certification'

describe('council election certification (UE-CONV-K-009)', () => {
  it('lets an uncertified election be corrected', () => {
    expect(checkElectionUpdate({}, { winners: [], totalVotes: 10, verifiedBy: 'Auditor' })).toEqual({ ok: true })
    expect(checkElectionUpdate({ verifiedBy: null, verificationDate: null }, { candidates: [] })).toEqual({ ok: true })
  })

  it.each([
    [{ verifiedBy: 'Independent Auditor' }],
    [{ verificationDate: '2026-10-01' }],
    [{ verificationDate: new Date('2026-10-01') }],
  ])('locks every result field once certified (%j)', (existing) => {
    for (const field of ['electionYear', 'electionDate', 'positionsAvailable', 'candidates', 'winners', 'totalVotes', 'participationRate', 'verifiedBy', 'verificationDate']) {
      expect(checkElectionUpdate(existing, { [field]: 'changed' })).toMatchObject({ ok: false, code: 'CERTIFIED_RESULTS_LOCKED' })
    }
  })

  it('still lets a dispute be recorded against a certified result', () => {
    expect(checkElectionUpdate({ verifiedBy: 'Independent Auditor' }, { contestedResults: true })).toEqual({ ok: true })
    expect(checkElectionUpdate({ verifiedBy: 'Independent Auditor' }, { contestedResults: true, totalVotes: 1 })).toMatchObject({ ok: false })
  })
})
