import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { releaseEnvelope } from '../envelope'
import { reportToNorthstar } from '../northstar'
import { advanceDecision } from '../decision'
import {
  AS_OF,
  constraints,
  decisionReadyCase,
  investmentAuthorization,
  sampleEnvelope,
  snapshot,
} from '../fixtures'
import {
  certificationFromGates,
  evaluateGates,
  renderCertificationMarkdown,
  repoRootFromHere,
} from '../verifier'

describe('verifier', () => {
  const root = repoRootFromHere()

  it('passes package-local gates and still withholds certification', () => {
    const gates = evaluateGates(root)
    expect(gates.notes).toEqual([])
    expect(gates).toMatchObject({
      TREASURER_DOCTRINE: 'VALID',
      TREASURER_BOUNDARIES: 'ENFORCED',
      TREASURER_CALCULATIONS: 'VERIFIED',
      TREASURER_AUTHORITY: 'FAIL_CLOSED',
      TREASURER_RED_TEAM: 'PASS',
      TREASURER_REGRESSION: 'PASS',
    })
    const record = certificationFromGates(gates)
    expect(record.TREASURER_CERTIFIED).toBe('NO')
    expect(record.TREASURER_REGRESSION).toBe('PASS_PACKAGE_LOCAL')
    expect(record.PRODUCTION_AUTHORITY).toBe('NO')
    expect(record.FINANCIAL_TRANSACTION_AUTHORITY).toBe('NEVER')
    expect(record.notes.join('\n')).toContain('independent VERIFIER')
    expect(record.notes.join('\n')).toContain('not a full-repo PASS')
    expect(record.notes.join('\n')).toContain('self-certified')
  })

  it('refuses YES when any gate is not passing', () => {
    const gates = evaluateGates(root)
    const denied = certificationFromGates({ ...gates, TREASURER_AUTHORITY: 'OPEN' })
    expect(denied.TREASURER_CERTIFIED).toBe('NO')
    expect(denied.TREASURER_REGRESSION).toBe('PASS_PACKAGE_LOCAL')
    const failedRegression = certificationFromGates({ ...gates, TREASURER_REGRESSION: 'FAIL' })
    expect(failedRegression.TREASURER_REGRESSION).toBe('FAIL')
    expect(failedRegression.TREASURER_CERTIFIED).toBe('NO')
    const markdown = renderCertificationMarkdown(denied)
    expect(markdown).toContain('TREASURER_CERTIFIED: NO')
    expect(markdown).not.toContain('TREASURER_CERTIFIED: YES')
  })

  it('matches the committed certification and red-team artifacts', () => {
    const gates = evaluateGates(root)
    const record = certificationFromGates(gates)
    const onDisk = JSON.parse(
      readFileSync(join(root, 'governance/personal-capital/treasurer/certification-record.json'), 'utf8'),
    )
    expect(onDisk).toEqual(record)
    const markdown = readFileSync(
      join(root, 'governance/personal-capital/treasurer/TREASURER_CERTIFICATION_RECORD.md'),
      'utf8',
    )
    expect(markdown).toBe(renderCertificationMarkdown(record))
  })
})

describe('northstar interface', () => {
  it('withholds capacity when evidence is missing and does not spend envelopes', () => {
    const unknown = reportToNorthstar({
      snapshot: null,
      snapshotIsFreshFact: false,
      liquidityFloorMinor: null,
      decisions: [],
      envelopes: [],
      ambitions: [{ id: 'dream', name: 'studio', fundingNeedMinor: 50_000, currency: 'CAD', asOf: AS_OF }],
      scenarios: [],
    })
    expect(unknown.ok).toBe(true)
    if (!unknown.ok) return
    expect(unknown.value.availableDeployableCapitalMinor).toBeNull()
    expect(unknown.value.ambitionFundingGaps[0].status).toBe('UNKNOWN')
    expect(unknown.value.dreamExistenceDecision).toBe('NOT_TREASURER_AUTHORITY')
  })

  it('reports deployable cash after commitments and ignores released envelope amounts', () => {
    const ready = decisionReadyCase()
    const risk = constraints()
    const authorized = advanceDecision({
      decision: ready,
      to: 'AUTHORIZED',
      asOf: AS_OF,
      riskConstraints: risk,
      authorization: investmentAuthorization({ decisionId: ready.id, riskHash: risk.contentHash, amountMinor: 1_000 }),
      envelope: sampleEnvelope(),
    })
    expect(authorized.ok).toBe(true)
    if (!authorized.ok) return
    const released = releaseEnvelope(sampleEnvelope(), 10)
    expect(released.ok).toBe(true)
    if (!released.ok) return
    const report = reportToNorthstar({
      snapshot: snapshot(),
      snapshotIsFreshFact: true,
      liquidityFloorMinor: 1_000,
      decisions: [authorized.value],
      envelopes: [released.value],
      ambitions: [{ id: 'dream', name: 'studio', fundingNeedMinor: 10_000, currency: 'CAD', asOf: AS_OF }],
      scenarios: [
        {
          id: 'base',
          epistemicClass: 'SCENARIO',
          name: 'base',
          returnBps: 0,
          includesFailedPaths: true,
          droppedPathIds: [],
        },
      ],
      milestones: [{ id: 'm1', note: 'synthetic milestone' }],
    })
    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.committedCapitalMinor).toBe(1_000)
    expect(report.value.availableDeployableCapitalMinor).toBe(2_000)
    expect(report.value.ambitionFundingGaps[0]).toEqual({ ambitionId: 'dream', gapMinor: 8_000, status: 'GAP' })
    expect(report.value.trajectories[0].epistemicClass).toBe('SCENARIO')
    expect(report.value.risks.join(' ')).toContain('planning authority')
  })
})
