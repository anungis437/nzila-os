import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  canonicalCertificationHasStaleYes,
  certifiedFromVerifierVerdict,
  fleetCertifiedFromImplementerAssessment,
  fleetCertifiedFromLocalRedTeam,
  fleetCertifiedFromPackageTests,
  rejectCertificationSpoof,
} from '../certification-authority'

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
      RESOLVED_ATTACKS_BLOCKED: 'PASS',
      TREASURER_REGRESSION: 'PASS',
    })
    const record = certificationFromGates(gates)
    expect(record.RECORD_KIND).toBe('IMPLEMENTER_ASSESSMENT')
    expect(record.IMPLEMENTER_ASSESSMENT).toBe('IMPLEMENTER_PASS')
    expect(record.FLEET_CERTIFIED).toBe('NO')
    expect(record.TREASURER_CERTIFIED).toBe('NO')
    expect(record.TREASURER_REGRESSION).toBe('PASS_PACKAGE_LOCAL')
    expect(record.PRODUCTION_AUTHORITY).toBe('NO')
    expect(record.FINANCIAL_TRANSACTION_AUTHORITY).toBe('NEVER')
    expect(record.notes.join('\n')).toContain('IMPLEMENTER_PASS is not FLEET_CERTIFIED')
    expect(record.notes.join('\n')).toContain('not a full-repo PASS')
    expect(record.notes.join('\n')).toContain('eef575eec5600a28c041126785490e0f79d42b19 is INVALID')
    expect(record.notes.join('\n')).toContain('28ac10067df4fd571a87d0119b0f86e88b2f4175 is INVALID')
    expect(record.RESOLVED_ATTACKS_BLOCKED).toBe('PASS')
    expect(record.notes.join('\n')).toContain('RESOLVED_ATTACKS_BLOCKED records only')
    expect(record.acceptedLimitations).toContain('NO_CRYPTOGRAPHIC_PRINCIPAL_BINDING')
    expect(record.acceptedLimitations).toContain('RELATEDNESS_REQUIRES_ISSUER_EVIDENCE')
    expect(record.acceptedLimitations).not.toContain('NO_ISSUER_REGISTRY_RELATED_ASSETS')
    expect(record.acceptedLimitations).not.toContain(
      'EXTERNAL_CONFIRMATION_DOES_NOT_REQUIRE_PRIOR_IN_MODULE_AUTHORIZATION',
    )
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
    expect(markdown).not.toContain('FLEET_CERTIFIED: YES')
  })

  it('keeps implementer, red-team, and package results distinct from fleet certification', () => {
    const gates = evaluateGates(root)
    const record = certificationFromGates(gates)
    expect(record.IMPLEMENTER_ASSESSMENT).toBe('IMPLEMENTER_PASS')
    expect(fleetCertifiedFromImplementerAssessment('IMPLEMENTER_PASS')).toBe('NO')
    expect(fleetCertifiedFromLocalRedTeam(true)).toBe('NO')
    expect(fleetCertifiedFromPackageTests(true)).toBe('NO')
    expect(record.FLEET_CERTIFIED).toBe('NO')
    expect(record.TREASURER_CERTIFIED).toBe('NO')
    expect(certifiedFromVerifierVerdict('NO')).toBe('NO')
    const spoof = rejectCertificationSpoof({
      IMPLEMENTER_ASSESSMENT: 'IMPLEMENTER_PASS',
      TREASURER_CERTIFIED: 'YES',
      FLEET_CERTIFIED: 'YES',
    })
    expect(spoof.accepted).toBe(false)
    expect(spoof.code).toBe('CERT_SPOOF_REJECTED')
    expect(spoof.TREASURER_CERTIFIED).toBe('NO')
    expect(spoof.FLEET_CERTIFIED).toBe('NO')
  })

  it('has no stale fleet YES in the canonical certification artifacts', () => {
    const json = readFileSync(join(root, 'governance/personal-capital/treasurer/certification-record.json'), 'utf8')
    const markdown = readFileSync(
      join(root, 'governance/personal-capital/treasurer/TREASURER_CERTIFICATION_RECORD.md'),
      'utf8',
    )
    expect(canonicalCertificationHasStaleYes(json)).toBe(false)
    expect(canonicalCertificationHasStaleYes(markdown)).toBe(false)
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
      asOf: AS_OF,
      riskConstraints: null,
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
      asOf: AS_OF,
      riskConstraints: risk,
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
    expect(report.value.availableDeployableClass).toBe('FACT')
  })

  it('does not treat an unvalidated snapshot as FACT deployable capacity', () => {
    const forged = reportToNorthstar({
      snapshot: { id: 'forged', cashMinor: 9_000_000, capitalDomain: 'PERSONAL', baseCurrency: 'CAD' },
      asOf: AS_OF,
      riskConstraints: constraints(),
      liquidityFloorMinor: 0,
      decisions: [],
      envelopes: [],
      ambitions: [{ id: 'dream', name: 'studio', fundingNeedMinor: 1, currency: 'CAD', asOf: AS_OF }],
      scenarios: [],
    })
    expect(forged.ok).toBe(true)
    if (!forged.ok) return
    expect(forged.value.availableDeployableClass).not.toBe('FACT')
    expect(forged.value.availableDeployableCapitalMinor).toBeNull()
    expect(forged.value.ambitionFundingGaps[0].status).toBe('UNKNOWN')
  })
})
