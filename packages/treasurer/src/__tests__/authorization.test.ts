import { describe, expect, it } from 'vitest'

import { treasurerAgent } from '../agent'
import {
  advanceDecision,
  assumeAuthorization,
  changeRiskConstraints,
  committedCapitalMinor,
  markProposedTradeExecuted,
  recordExternalConfirmation,
  requestTransaction,
  sealRiskConstraints,
} from '../decision'
import { releaseEnvelope, treatEnvelopeAsAuthorization, treatEnvelopeAsCommitted } from '../envelope'
import { buildEvidence } from '../integrity'
import {
  AS_OF,
  constraints,
  decisionReadyCase,
  investmentAuthorization,
  sampleEnvelope,
} from '../fixtures'
import { TREASURER_IDENTITY } from '../kernel'

describe('F. authorization', () => {
  it('refuses buy, sell, mark-executed, and assumed authorization', () => {
    for (const side of ['BUY', 'SELL'] as const) {
      const ran = treasurerAgent.run({ kind: side, narrative: 'please do it' })
      expect(ran.ok).toBe(false)
      expect(ran.transactionExecuted).toBe(false)
      expect(ran.financialTransactionAuthority).toBe('NEVER')
      expect(ran.investmentAuthorized).toBe(false)
    }
    expect(requestTransaction('BUY').ok).toBe(false)
    expect(markProposedTradeExecuted().ok).toBe(false)
    expect(assumeAuthorization().ok).toBe(false)
    expect(treasurerAgent.run({ kind: 'MARK_EXECUTED' }).code).toBe('TRANSACTION_AUTHORITY_NEVER')
    expect(treasurerAgent.run({ kind: 'ASSUME_AUTHORIZATION' }).code).toBe('AUTHORIZATION_REQUIRED')
  })

  it('does not treat an envelope as committed capital or as authorization', () => {
    const envelope = sampleEnvelope()
    const released = releaseEnvelope(envelope, envelope.ceilingMinor)
    expect(released.ok).toBe(true)
    if (!released.ok) return
    expect(released.value.investmentAuthorized).toBe(false)
    expect(released.value.transactionExecuted).toBe(false)
    expect(released.value.committedMinor).toBe(0)
    expect(treatEnvelopeAsCommitted(released.value).ok).toBe(false)
    expect(treatEnvelopeAsAuthorization(released.value).ok).toBe(false)
    expect(treasurerAgent.run({ kind: 'TREAT_ENVELOPE_AS_COMMITTED', envelope: released.value }).ok).toBe(false)
    const committed = committedCapitalMinor([], 'CAD')
    expect(committed.ok).toBe(true)
    if (committed.ok) expect(committed.value).toBe(0)
  })

  it('keeps analysis, decision-ready, authorization, and external confirmation apart', () => {
    const ready = decisionReadyCase()
    expect(ready.analysisComplete).toBe(true)
    expect(ready.decisionReady).toBe(true)
    expect(ready.humanAuthorized).toBe(false)
    expect(ready.investmentAuthorized).toBe(false)
    expect(ready.transactionExternallyConfirmed).toBe(false)
    expect(ready.transactionExecuted).toBe(false)

    const risk = constraints()
    const authorized = advanceDecision({
      decision: ready,
      to: 'AUTHORIZED',
      asOf: AS_OF,
      riskConstraints: risk,
      authorization: investmentAuthorization({ decisionId: ready.id, riskHash: risk.contentHash, amountMinor: 2_000 }),
      envelope: sampleEnvelope(),
    })
    expect(authorized.ok).toBe(true)
    if (!authorized.ok) return
    expect(authorized.value.humanAuthorized).toBe(true)
    expect(authorized.value.investmentAuthorized).toBe(true)
    expect(authorized.value.transactionExternallyConfirmed).toBe(false)
    expect(authorized.value.transactionExecuted).toBe(false)
    expect(requestTransaction('BUY').ok).toBe(false)

    const evidence = buildEvidence({
      id: 'fill-1',
      epistemicClass: 'FACT',
      sourceType: 'BROKER_CONFIRMATION',
      sourceName: 'synthetic-broker',
      observedAt: AS_OF,
      origin: 'EXTERNAL',
      payload: { instrumentId: 'SYN-EQ', amountMinor: 2_000, currency: 'CAD' },
    })
    const confirmed = recordExternalConfirmation(authorized.value, evidence, AS_OF)
    expect(confirmed.ok).toBe(true)
    if (!confirmed.ok) return
    expect(confirmed.value.transactionExternallyConfirmed).toBe(true)
    expect(confirmed.value.transactionExecuted).toBe(false)
    expect(requestTransaction('SELL').ok).toBe(false)

    const claimed = recordExternalConfirmation(authorized.value, evidence, AS_OF, true)
    expect(claimed.ok).toBe(false)
    if (!claimed.ok) expect(claimed.code).toBe('TRANSACTION_AUTHORITY_NEVER')
  })

  it('refuses a silent risk-constraint change and accepts an explicit one', () => {
    const current = constraints()
    const silent = changeRiskConstraints(
      current,
      { ...current, version: 2, maxPositionWeightBps: 9_000 },
      undefined,
    )
    expect(silent.ok).toBe(false)
    const next = sealRiskConstraints({ ...current, version: 2, maxPositionWeightBps: 9_000 })
    const wrongHash = changeRiskConstraints(current, next, {
      ...investmentAuthorization({
        decisionId: 'decision-1',
        riskHash: current.contentHash,
        purpose: 'RISK_CONSTRAINT_CHANGE',
      }),
      riskConstraintsHash: current.contentHash,
    })
    expect(wrongHash.ok).toBe(false)
    const changed = changeRiskConstraints(current, next, {
      id: 'auth-risk',
      epistemicClass: 'AUTHORIZATION',
      principalId: TREASURER_IDENTITY.principalId,
      principalName: TREASURER_IDENTITY.principalName,
      purpose: 'RISK_CONSTRAINT_CHANGE',
      decisionId: 'decision-1',
      statement: 'I adopt the new ceiling.',
      decidedAt: AS_OF,
      riskConstraintsHash: next.contentHash,
    })
    expect(changed.ok).toBe(true)
    if (changed.ok) expect(changed.value.maxPositionWeightBps).toBe(9_000)
  })
})
