import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkElectionUpdate, planCertifiedSupersession, type CertifiedElection, type LoadedCorrectionGrant } from '../election-certification'

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

  it('plans a successor from the stored certified row and does not persist it', () => {
    const existing: CertifiedElection = {
      id: 'election-1',
      electionYear: 2026,
      electionDate: '2026-10-01',
      positionsAvailable: 2,
      candidates: [{ name: 'A' }],
      winners: [{ name: 'A' }],
      totalVotes: 10,
      participationRate: 40,
      verifiedBy: 'Independent Auditor',
      verificationDate: '2026-10-02',
    }
    const grant: LoadedCorrectionGrant = {
      loadedBy: 'authority-kernel',
      action: 'election:supersede_certified_result',
      electionId: 'election-1',
      issued: true,
    }
    expect(planCertifiedSupersession({ ...existing, verifiedBy: null, verificationDate: null }, grant)).toMatchObject({ ok: false, code: 'NOT_CERTIFIED' })
    expect(planCertifiedSupersession(existing, null)).toMatchObject({ ok: false, code: 'CORRECTION_UNISSUED' })
    expect(planCertifiedSupersession(existing, { ...grant, electionId: 'other' })).toMatchObject({ ok: false, code: 'CORRECTION_UNISSUED' })
    const planned = planCertifiedSupersession(existing, grant)
    expect(planned).toMatchObject({
      ok: true,
      persisted: false,
      proposedSuccessor: {
        supersedesElectionId: 'election-1',
        winners: existing.winners,
        totalVotes: 10,
        verifiedBy: null,
        verificationDate: null,
        contestedResults: false,
      },
    })
    expect(checkElectionUpdate(existing, { winners: [{ name: 'B' }], totalVotes: 1 })).toMatchObject({ ok: false, code: 'CERTIFIED_RESULTS_LOCKED' })
  })

  it('keeps the election item route from inserting a successor over a certified row', () => {
    const source = readFileSync(join(__dirname, '..', '..', '..', 'app', 'api', 'elections', '[id]', 'route.ts'), 'utf8')
    expect(source).toContain('checkElectionUpdate')
    expect(source).not.toContain('planCertifiedSupersession')
    expect(source).not.toContain('.insert(')
  })

  it('keeps the succession route from accepting a grant in the request, and the council vote route at 501', () => {
    const succession = readFileSync(join(__dirname, '..', '..', '..', 'app', 'api', 'elections', '[id]', 'succession', 'route.ts'), 'utf8')
    const vote = readFileSync(join(__dirname, '..', '..', '..', 'app', 'api', 'elections', '[id]', 'vote', 'route.ts'), 'utf8')
    expect(succession).toContain('loadCertifiedSupersessionGrant')
    expect(succession).toContain('recordCertifiedSupersession')
    expect(succession).not.toContain('request.json')
    expect(succession).not.toContain('issued: true')
    expect(succession).not.toContain('councilElections')
    expect(succession).not.toContain('db.select')
    expect(vote).toContain('notImplemented')
    expect(vote).not.toContain('recordCertifiedSupersession')
  })
})
