/**
 * Synthetic fixtures only. These are not holdings, prices, or authorizations.
 */
import { TREASURER_IDENTITY } from './kernel'
import { buildEvidence } from './integrity'
import { sealRiskConstraints, sealThesis } from './decision'
import type {
  BenchmarkRef,
  CapitalEnvelope,
  DecisionCase,
  EvidenceRef,
  HumanAuthorization,
  PortfolioSnapshot,
  Position,
  RiskConstraints,
  Thesis,
} from './schemas'
import { createEnvelope } from './envelope'
import { advanceDecision, openIdea } from './decision'

export const AS_OF = '2026-09-01'
export const STALE_AS_OF = '2020-01-01'

export function marketEvidence(input: {
  id: string
  instrumentId: string
  marketValueMinor: number
  currency?: string
  observedAt?: string
  epistemicClass?: EvidenceRef['epistemicClass']
  sourceType?: EvidenceRef['sourceType']
  origin?: EvidenceRef['origin']
}): EvidenceRef {
  return buildEvidence({
    id: input.id,
    epistemicClass: input.epistemicClass ?? 'FACT',
    sourceType: input.sourceType ?? 'CUSTODIAN_STATEMENT',
    sourceName: 'synthetic-custodian',
    observedAt: input.observedAt ?? AS_OF,
    origin: input.origin ?? 'EXTERNAL',
    payload: {
      instrumentId: input.instrumentId,
      marketValueMinor: input.marketValueMinor,
      currency: input.currency ?? 'CAD',
    },
  })
}

export function cashEvidence(amountMinor: number, observedAt = AS_OF): EvidenceRef {
  return buildEvidence({
    id: 'cash-evidence',
    epistemicClass: 'FACT',
    sourceType: 'CUSTODIAN_STATEMENT',
    sourceName: 'synthetic-custodian',
    observedAt,
    origin: 'EXTERNAL',
    payload: { kind: 'CASH', amountMinor, currency: 'CAD' },
  })
}

export function position(input: {
  id: string
  instrumentId: string
  marketValueMinor: number
  exposureGroupId: string
  evidenceId: string
  asOf?: string
  quantity?: number
}): Position {
  return {
    id: input.id,
    instrumentId: input.instrumentId,
    accountId: 'personal-taxable',
    capitalDomain: 'PERSONAL',
    ownerPrincipalId: TREASURER_IDENTITY.principalId,
    quantity: input.quantity ?? 1,
    marketValueMinor: input.marketValueMinor,
    currency: 'CAD',
    exposureGroupId: input.exposureGroupId,
    priceEvidenceId: input.evidenceId,
    asOf: input.asOf ?? AS_OF,
  }
}

export function constraints(overrides: Partial<Omit<RiskConstraints, 'contentHash'>> = {}): RiskConstraints {
  return sealRiskConstraints({
    id: 'risk-1',
    version: 1,
    maxPositionWeightBps: 5_000,
    maxGroupWeightBps: 5_000,
    minLiquidityMinor: 1_000,
    currency: 'CAD',
    maxDrawdownBps: 3_000,
    ...overrides,
  })
}

export function snapshot(options?: {
  positions?: Position[]
  evidence?: EvidenceRef[]
  cashMinor?: number
  asOf?: string
  cashEvidenceId?: string
}): PortfolioSnapshot {
  const asOf = options?.asOf ?? AS_OF
  const cashMinor = options?.cashMinor ?? 4_000
  const equity = marketEvidence({ id: 'ev-eq', instrumentId: 'SYN-EQ', marketValueMinor: 3_000, observedAt: asOf })
  const bond = marketEvidence({ id: 'ev-bd', instrumentId: 'SYN-BD', marketValueMinor: 3_000, observedAt: asOf })
  const positions = options?.positions ?? [
    position({ id: 'p-eq', instrumentId: 'SYN-EQ', marketValueMinor: 3_000, exposureGroupId: 'equity', evidenceId: 'ev-eq', asOf }),
    position({ id: 'p-bd', instrumentId: 'SYN-BD', marketValueMinor: 3_000, exposureGroupId: 'bond', evidenceId: 'ev-bd', asOf }),
  ]
  const evidence = options?.evidence ?? [equity, bond, cashEvidence(cashMinor, asOf)]
  return {
    id: 'snap-1',
    asOf,
    capitalDomain: 'PERSONAL',
    ownerPrincipalId: TREASURER_IDENTITY.principalId,
    baseCurrency: 'CAD',
    positions,
    cashMinor,
    cashCurrency: 'CAD',
    cashEvidenceId: options?.cashEvidenceId ?? 'cash-evidence',
    evidence,
  }
}

export function sampleThesis(): Thesis {
  const sealed = sealThesis({
    id: 'thesis-1',
    version: 1,
    epistemicClass: 'THESIS',
    statement: 'Synthetic quality compounder held for a decade, subject to evidence.',
    sourceIds: ['src-1'],
    priorHash: null,
  })
  if (!sealed.ok) throw new Error(sealed.reason)
  return sealed.value
}

export function sampleBenchmark(): BenchmarkRef {
  return {
    id: 'bench-1',
    name: 'synthetic balanced benchmark',
    epistemicClass: 'ESTIMATE',
    returnBps: 700,
    periodStart: '2026-01-01',
    periodEnd: '2026-09-01',
    currency: 'CAD',
    evidenceId: 'bench-evidence',
  }
}

export function sampleEnvelope(): CapitalEnvelope {
  const created = createEnvelope({
    id: 'env-1',
    currency: 'CAD',
    ceilingMinor: 100_000,
    benchmarkAlternativeId: 'bench-1',
    evidenceGateIds: ['gate-price', 'gate-liquidity'],
    thesisId: 'thesis-1',
    downsideCaseIds: ['down-1'],
    impairmentScenarioIds: ['imp-1'],
    liquidityNote: 'Release does not spend cash.',
    concentrationNote: 'Single-name ceiling still applies.',
  })
  if (!created.ok) throw new Error(created.reason)
  return created.value
}

export function decisionReadyCase(): DecisionCase {
  const thesis = sampleThesis()
  const risk = constraints()
  const idea = openIdea('decision-1', AS_OF)
  if (!idea.ok) throw new Error(idea.reason)
  const research = advanceDecision({ decision: idea.value, to: 'RESEARCH', asOf: AS_OF })
  if (!research.ok) throw new Error(research.reason)
  const withThesis = advanceDecision({ decision: research.value, to: 'THESIS', asOf: AS_OF, thesis })
  if (!withThesis.ok) throw new Error(withThesis.reason)
  const underwriting = advanceDecision({
    decision: withThesis.value,
    to: 'UNDERWRITING',
    asOf: AS_OF,
    underwriting: {
      downsideCaseId: 'down-1',
      liquidityNote: 'Cash floor remains in force.',
      concentrationNote: 'Group ceilings remain in force.',
    },
  })
  if (!underwriting.ok) throw new Error(underwriting.reason)
  const gate = advanceDecision({
    decision: underwriting.value,
    to: 'EVIDENCE_GATE',
    asOf: AS_OF,
    benchmark: sampleBenchmark(),
  })
  if (!gate.ok) throw new Error(gate.reason)
  const ready = advanceDecision({
    decision: gate.value,
    to: 'HUMAN_DECISION',
    asOf: AS_OF,
    snapshot: snapshot(),
    riskConstraints: risk,
  })
  if (!ready.ok) throw new Error(ready.reason)
  return ready.value
}

export function investmentAuthorization(input: {
  decisionId: string
  riskHash: string
  amountMinor?: number
  purpose?: HumanAuthorization['purpose']
}): HumanAuthorization {
  return {
    id: 'auth-1',
    epistemicClass: 'AUTHORIZATION',
    principalId: TREASURER_IDENTITY.principalId,
    principalName: TREASURER_IDENTITY.principalName,
    purpose: input.purpose ?? 'INVESTMENT',
    decisionId: input.decisionId,
    statement: 'I authorize this personal-capital decision and no transaction is executed by TREASURER.',
    decidedAt: AS_OF,
    riskConstraintsHash: input.riskHash,
    amountMinor: input.amountMinor ?? 2_000,
    currency: 'CAD',
  }
}
