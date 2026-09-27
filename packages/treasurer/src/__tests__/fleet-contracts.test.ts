import { describe, expect, it } from 'vitest'

import { treasurerAgent } from '../agent'
import {
  assertPersonalDomain,
  dispatchCommand,
  ingestCorporateCapitalCatalog,
} from '../boundaries'
import {
  certifiedFromVerifierVerdict,
  fleetCertifiedFromImplementerAssessment,
} from '../certification-authority'
import { advanceDecision, mutateThesis, recordExternalConfirmation, requestTransaction, reviseThesis } from '../decision'
import { treatEnvelopeAsAuthorization, treatEnvelopeAsCommitted } from '../envelope'
import {
  AS_OF,
  constraints,
  decisionReadyCase,
  investmentAuthorization,
  sampleEnvelope,
  sampleThesis,
} from '../fixtures'
import { TREASURER_IDENTITY } from '../kernel'
import { buildEvidence } from '../integrity'
import { capacityFromNorthstarAmbition, decideDreamShouldExist, reportToNorthstar } from '../northstar'
import { certificationFromGates, evaluateGates, repoRootFromHere } from '../verifier'

describe('CAPITAL contract', () => {
  it('keeps personal capital distinct from corporate CAPITAL', () => {
    const catalog = ingestCorporateCapitalCatalog({ products: [{ id: 'union-eyes', decision: 'FUND NOW' }] })
    expect(catalog.ok).toBe(false)
    expect(assertPersonalDomain('CORPORATE').ok).toBe(false)
    const personal = assertPersonalDomain('PERSONAL')
    expect(personal.ok).toBe(true)
    expect(TREASURER_IDENTITY.key).toBe('treasurer')
    expect(TREASURER_IDENTITY.capitalDomain).toBe('PERSONAL')
    expect(TREASURER_IDENTITY.productionAuthority).toBe('NO')
    expect(TREASURER_IDENTITY.financialTransactionAuthority).toBe('NEVER')
  })
})

describe('COMMAND contract', () => {
  it('does not dispatch COMMAND and cannot execute a transaction', () => {
    expect(dispatchCommand({ kind: 'BUY' }).ok).toBe(false)
    expect(requestTransaction('BUY').ok).toBe(false)
    expect(requestTransaction('SELL').ok).toBe(false)
    const run = treasurerAgent.run({ kind: 'BUY' })
    expect(run.ok).toBe(false)
    expect(run.transactionExecuted).toBe(false)
    expect(run.investmentAuthorized).toBe(false)
    expect(run.financialTransactionAuthority).toBe('NEVER')
  })
})

describe('NORTHSTAR contract surface', () => {
  it('reports capacity and refuses dream authority without a NORTHSTAR runtime', () => {
    expect(decideDreamShouldExist().ok).toBe(false)
    expect(
      capacityFromNorthstarAmbition({
        id: 'dream',
        name: 'studio',
        fundingNeedMinor: 10_000,
        currency: 'CAD',
        asOf: AS_OF,
      }).ok,
    ).toBe(false)
    const report = reportToNorthstar({
      snapshot: null,
      asOf: AS_OF,
      riskConstraints: null,
      liquidityFloorMinor: null,
      decisions: [],
      envelopes: [],
      ambitions: [{ id: 'dream', name: 'studio', fundingNeedMinor: 10_000, currency: 'CAD', asOf: AS_OF }],
      scenarios: [],
    })
    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.dreamExistenceDecision).toBe('NOT_TREASURER_AUTHORITY')
    expect(report.value.availableDeployableCapitalMinor).toBeNull()
  })
})

describe('CHRONICLE contract', () => {
  it('appends thesis history and refuses a rewrite of a sealed version', () => {
    const thesis = sampleThesis()
    expect(mutateThesis([thesis], thesis.id, thesis.version, 'rewritten after the fact').ok).toBe(false)
    const revised = reviseThesis([thesis], {
      id: thesis.id,
      epistemicClass: 'THESIS',
      statement: 'Synthetic quality compounder, revised only by appending a version.',
      sourceIds: ['src-1'],
    })
    expect(revised.ok).toBe(true)
    if (!revised.ok) return
    expect(revised.value).toHaveLength(2)
    expect(revised.value[0]).toEqual(thesis)
    expect(revised.value[1].version).toBe(2)
    expect(revised.value[1].priorHash).toBe(thesis.contentHash)
  })
})

describe('VERIFIER contract', () => {
  it('emits an implementer assessment and does not issue fleet certification', () => {
    const record = certificationFromGates(evaluateGates(repoRootFromHere()))
    expect(record.RECORD_KIND).toBe('IMPLEMENTER_ASSESSMENT')
    expect(record.IMPLEMENTER_ASSESSMENT).toBe('IMPLEMENTER_PASS')
    expect(fleetCertifiedFromImplementerAssessment(record.IMPLEMENTER_ASSESSMENT)).toBe('NO')
    expect(record.FLEET_CERTIFIED).toBe('NO')
    expect(record.TREASURER_CERTIFIED).toBe('NO')
    expect(certifiedFromVerifierVerdict('NO')).toBe('NO')
  })
})

describe('authority separations', () => {
  it('keeps envelope, authorization, and execution apart', () => {
    const envelope = sampleEnvelope()
    expect(envelope.committedMinor).toBe(0)
    expect(envelope.investmentAuthorized).toBe(false)
    expect(envelope.transactionExecuted).toBe(false)
    expect(treatEnvelopeAsCommitted(envelope).ok).toBe(false)
    expect(treatEnvelopeAsAuthorization(envelope).ok).toBe(false)
    const ready = decisionReadyCase()
    const risk = constraints()
    const authorized = advanceDecision({
      decision: ready,
      to: 'AUTHORIZED',
      asOf: AS_OF,
      riskConstraints: risk,
      authorization: investmentAuthorization({ decisionId: ready.id, riskHash: risk.contentHash }),
      envelope,
    })
    expect(authorized.ok).toBe(true)
    if (!authorized.ok) return
    expect(authorized.value.humanAuthorized).toBe(true)
    expect(authorized.value.investmentAuthorized).toBe(true)
    expect(authorized.value.transactionExecuted).toBe(false)
    expect(authorized.value.transactionExternallyConfirmed).toBe(false)
  })

  it('keeps analysis, decision readiness, and external confirmation apart', () => {
    const ready = decisionReadyCase()
    expect(ready.analysisComplete).toBe(true)
    expect(ready.decisionReady).toBe(true)
    expect(ready.humanAuthorized).toBe(false)
    expect(ready.transactionExternallyConfirmed).toBe(false)
    expect(ready.transactionExecuted).toBe(false)
    const evidence = buildEvidence({
      id: 'conf-contract',
      epistemicClass: 'FACT',
      sourceType: 'BROKER_CONFIRMATION',
      sourceName: 'synthetic-broker',
      observedAt: AS_OF,
      origin: 'EXTERNAL',
      payload: { instrumentId: 'SYN-EQ', amountMinor: 100 },
    })
    const premature = recordExternalConfirmation(ready, evidence, AS_OF, false)
    expect(premature.ok).toBe(false)
    if (!premature.ok) expect(premature.code).toBe('AUTHORIZATION_REQUIRED')
    const risk = constraints()
    const authorized = advanceDecision({
      decision: ready,
      to: 'AUTHORIZED',
      asOf: AS_OF,
      riskConstraints: risk,
      authorization: investmentAuthorization({ decisionId: ready.id, riskHash: risk.contentHash }),
      envelope: sampleEnvelope(),
    })
    expect(authorized.ok).toBe(true)
    if (!authorized.ok) return
    expect(recordExternalConfirmation(authorized.value, evidence, AS_OF, true).ok).toBe(false)
    const recorded = recordExternalConfirmation(authorized.value, evidence, AS_OF, false)
    expect(recorded.ok).toBe(true)
    if (!recorded.ok) return
    expect(recorded.value.transactionExternallyConfirmed).toBe(true)
    expect(recorded.value.transactionExecuted).toBe(false)
    expect(recorded.value.humanAuthorized).toBe(true)
    expect(recorded.value.investmentAuthorized).toBe(true)
  })
})
