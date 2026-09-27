/**
 * Investment decision lifecycle.
 * No stage transition implies that a transaction occurred.
 * ANALYSIS_COMPLETE, DECISION_READY, HUMAN_AUTHORIZED, and
 * TRANSACTION_EXTERNALLY_CONFIRMED are independent.
 */
import {
  TREASURER_IDENTITY,
  canonicalJson,
  fail,
  ok,
  parseIsoDate,
  scanInjection,
  sha256,
  type LifecycleStage,
  type Result,
} from './kernel'
import { validateSnapshot, verifyEvidence } from './integrity'
import {
  benchmarkSchema,
  humanAuthorizationSchema,
  thesisSchema,
  type BenchmarkRef,
  type CapitalEnvelope,
  type DecisionCase,
  type EvidenceRef,
  type HumanAuthorization,
  type RiskConstraints,
  type Thesis,
} from './schemas'

const NEXT: Record<LifecycleStage, readonly LifecycleStage[]> = {
  IDEA: ['RESEARCH'],
  RESEARCH: ['THESIS'],
  THESIS: ['UNDERWRITING'],
  UNDERWRITING: ['EVIDENCE_GATE'],
  EVIDENCE_GATE: ['HUMAN_DECISION'],
  HUMAN_DECISION: ['AUTHORIZED', 'REJECTED', 'DEFERRED'],
  AUTHORIZED: ['MONITORING'],
  REJECTED: [],
  DEFERRED: ['RESEARCH', 'UNDERWRITING'],
  MONITORING: ['THESIS_REVIEW'],
  THESIS_REVIEW: ['EXIT', 'REALLOCATION', 'HOLD', 'UNDERWRITING'],
  EXIT: [],
  REALLOCATION: ['MONITORING'],
  HOLD: ['MONITORING', 'THESIS_REVIEW'],
}

export function riskConstraintsHash(constraints: Omit<RiskConstraints, 'contentHash'>): string {
  return sha256(
    canonicalJson({
      id: constraints.id,
      version: constraints.version,
      maxPositionWeightBps: constraints.maxPositionWeightBps,
      maxGroupWeightBps: constraints.maxGroupWeightBps,
      minLiquidityMinor: constraints.minLiquidityMinor,
      currency: constraints.currency,
      maxDrawdownBps: constraints.maxDrawdownBps,
    }),
  )
}

export function sealRiskConstraints(constraints: Omit<RiskConstraints, 'contentHash'>): RiskConstraints {
  return { ...constraints, contentHash: riskConstraintsHash(constraints) }
}

export function benchmarkHash(benchmark: BenchmarkRef): string {
  return sha256(canonicalJson(benchmark))
}

export function thesisHash(thesis: Omit<Thesis, 'contentHash'>): string {
  return sha256(
    canonicalJson({
      id: thesis.id,
      version: thesis.version,
      epistemicClass: thesis.epistemicClass,
      statement: thesis.statement,
      sourceIds: thesis.sourceIds,
      priorHash: thesis.priorHash,
    }),
  )
}

export function sealThesis(thesis: Omit<Thesis, 'contentHash'>): Result<Thesis> {
  if (thesis.epistemicClass !== 'THESIS') return fail('EPISTEMIC_CONFLATION', 'thesis class must be THESIS')
  const injection = scanInjection([thesis.statement])
  if (injection) return fail('INJECTION_REJECTED', injection)
  const sealed = { ...thesis, contentHash: thesisHash(thesis) }
  const parsed = thesisSchema.safeParse(sealed)
  if (!parsed.success) return fail('MALFORMED', 'thesis is malformed')
  return ok(parsed.data)
}

export function reviseThesis(existing: readonly Thesis[], next: Omit<Thesis, 'contentHash' | 'priorHash' | 'version'>): Result<readonly Thesis[]> {
  const prior = existing.filter((item) => item.id === next.id)
  const latest = prior[prior.length - 1]
  const version = prior.length + 1
  if (latest && next.statement === latest.statement) {
    return fail('THESIS_IMMUTABLE', 'thesis revision must change the statement; prior text stays immutable')
  }
  const sealed = sealThesis({
    ...next,
    version,
    priorHash: latest ? latest.contentHash : null,
  })
  if (!sealed.ok) return sealed
  return ok([...existing, sealed.value])
}

export function mutateThesis(existing: readonly Thesis[], id: string, version: number, statement: string): Result<never> {
  const found = existing.find((item) => item.id === id && item.version === version)
  if (!found) return fail('MISSING_EVIDENCE', 'thesis version does not exist')
  if (found.statement !== statement) {
    return fail('THESIS_IMMUTABLE', 'prior thesis versions cannot be rewritten')
  }
  return fail('THESIS_IMMUTABLE', 'prior thesis versions are immutable')
}

export function openIdea(id: string, asOf: string): Result<DecisionCase> {
  const date = parseIsoDate(asOf)
  if (!date.ok) return date
  if (!id) return fail('MALFORMED', 'decision id is required')
  return ok({
    id,
    stage: 'IDEA',
    analysisComplete: false,
    decisionReady: false,
    humanAuthorized: false,
    transactionExternallyConfirmed: false,
    investmentAuthorized: false,
    transactionExecuted: false,
    amountMinor: 0,
  })
}

export interface AdvanceInput {
  readonly decision: DecisionCase
  readonly to: LifecycleStage
  readonly asOf: string
  readonly snapshot?: unknown
  readonly thesis?: Thesis
  readonly underwriting?: {
    readonly downsideCaseId: string
    readonly liquidityNote: string
    readonly concentrationNote: string
  }
  readonly authorization?: HumanAuthorization
  readonly riskConstraints?: RiskConstraints
  readonly benchmark?: BenchmarkRef
  readonly envelope?: CapitalEnvelope
}

function textsOf(input: AdvanceInput): string[] {
  return [
    input.thesis?.statement ?? '',
    input.underwriting?.liquidityNote ?? '',
    input.underwriting?.concentrationNote ?? '',
    input.authorization?.statement ?? '',
    input.benchmark?.name ?? '',
  ]
}

function base(decision: DecisionCase, stage: LifecycleStage): DecisionCase {
  return {
    ...decision,
    stage,
    transactionExecuted: false,
  }
}

export function advanceDecision(input: AdvanceInput): Result<DecisionCase> {
  const date = parseIsoDate(input.asOf)
  if (!date.ok) return date
  if (input.decision.transactionExecuted !== false) {
    return fail('TRANSACTION_AUTHORITY_NEVER', 'a decision record cannot claim TREASURER executed a transaction')
  }
  const injection = scanInjection(textsOf(input))
  if (injection) return fail('INJECTION_REJECTED', injection)
  const allowed = NEXT[input.decision.stage]
  if (!allowed.includes(input.to)) {
    return fail('ILLEGAL_TRANSITION', `${input.decision.stage} cannot transition to ${input.to}`)
  }

  if (input.to === 'RESEARCH' || input.to === 'MONITORING') {
    return ok(base(input.decision, input.to))
  }

  if (input.to === 'THESIS') {
    if (!input.thesis) return fail('MISSING_EVIDENCE', 'thesis required')
    if (input.thesis.epistemicClass !== 'THESIS') return fail('EPISTEMIC_CONFLATION', 'thesis is not a THESIS')
    if (input.thesis.contentHash !== thesisHash(input.thesis)) return fail('MALFORMED', 'thesis hash mismatch')
    return ok({ ...base(input.decision, 'THESIS'), thesisId: input.thesis.id })
  }

  if (input.to === 'UNDERWRITING') {
    if (!input.decision.thesisId) return fail('MISSING_EVIDENCE', 'underwriting requires a thesis')
    const note = input.underwriting
    if (!note?.downsideCaseId || !note.liquidityNote || !note.concentrationNote) {
      return fail('MISSING_EVIDENCE', 'underwriting requires downside, liquidity, and concentration')
    }
    return ok({ ...base(input.decision, 'UNDERWRITING'), analysisComplete: true, decisionReady: false })
  }

  if (input.to === 'EVIDENCE_GATE') {
    if (!input.decision.analysisComplete) return fail('MISSING_EVIDENCE', 'analysis is not complete')
    if (!input.benchmark) return fail('MISSING_EVIDENCE', 'benchmark required')
    const benchmark = benchmarkSchema.safeParse(input.benchmark)
    if (!benchmark.success) return fail('MALFORMED', 'benchmark is malformed')
    return ok({
      ...base(input.decision, 'EVIDENCE_GATE'),
      benchmarkId: benchmark.data.id,
      benchmarkHash: benchmarkHash(benchmark.data),
      decisionReady: false,
      humanAuthorized: false,
      investmentAuthorized: false,
    })
  }

  if (input.to === 'HUMAN_DECISION') {
    if (!input.riskConstraints) return fail('MISSING_RISK_CONSTRAINT', 'risk constraints are required')
    if (input.riskConstraints.contentHash !== riskConstraintsHash(input.riskConstraints)) {
      return fail('MALFORMED', 'risk constraint hash mismatch')
    }
    if (!input.decision.benchmarkHash) return fail('MISSING_EVIDENCE', 'benchmark was not locked at the evidence gate')
    const validated = validateSnapshot(input.snapshot, input.asOf, input.riskConstraints)
    if (!validated.ok) return validated
    return ok({
      ...base(input.decision, 'HUMAN_DECISION'),
      analysisComplete: true,
      decisionReady: true,
      humanAuthorized: false,
      investmentAuthorized: false,
      transactionExternallyConfirmed: false,
      riskConstraintsHash: input.riskConstraints.contentHash,
    })
  }

  if (input.to === 'AUTHORIZED' || input.to === 'REJECTED' || input.to === 'DEFERRED') {
    return applyHumanDecision(input)
  }

  if (input.to === 'EXIT' || input.to === 'REALLOCATION' || input.to === 'HOLD') {
    const auth = requireHuman(input.authorization, input.decision.id, 'THESIS_REVIEW')
    if (!auth.ok) return auth
    const next = base(input.decision, input.to)
    if (input.to === 'EXIT') {
      return ok({ ...next, amountMinor: 0, investmentAuthorized: false })
    }
    return ok(next)
  }

  return fail('ILLEGAL_TRANSITION', `unsupported transition to ${input.to}`)
}

function requireHuman(
  authorization: HumanAuthorization | undefined,
  decisionId: string,
  purpose: HumanAuthorization['purpose'],
): Result<HumanAuthorization> {
  if (!authorization) return fail('AUTHORIZATION_REQUIRED', 'human authorization is required')
  const parsed = humanAuthorizationSchema.safeParse(authorization)
  if (!parsed.success) return fail('MALFORMED', 'authorization record is malformed')
  if (parsed.data.epistemicClass !== 'AUTHORIZATION') {
    return fail('EPISTEMIC_CONFLATION', 'authorization cannot be classified as another epistemic state')
  }
  if (
    parsed.data.principalId !== TREASURER_IDENTITY.principalId ||
    parsed.data.principalName !== TREASURER_IDENTITY.principalName
  ) {
    return fail('AUTHORIZATION_REQUIRED', 'only the Principal can authorize')
  }
  if (parsed.data.purpose !== purpose || parsed.data.decisionId !== decisionId) {
    return fail('AUTHORIZATION_REQUIRED', 'authorization does not match this decision')
  }
  const decided = parseIsoDate(parsed.data.decidedAt)
  if (!decided.ok) return decided
  return ok(parsed.data)
}

function applyHumanDecision(input: AdvanceInput): Result<DecisionCase> {
  const purpose =
    input.to === 'AUTHORIZED' ? 'INVESTMENT' : input.to === 'REJECTED' ? 'INVESTMENT_REJECT' : 'INVESTMENT_DEFER'
  const auth = requireHuman(input.authorization, input.decision.id, purpose)
  if (!auth.ok) return auth
  if (!input.decision.decisionReady) return fail('AUTHORIZATION_REQUIRED', 'decision is not DECISION_READY')
  if (!input.riskConstraints || auth.value.riskConstraintsHash !== input.riskConstraints.contentHash) {
    return fail('AUTHORIZATION_REQUIRED', 'authorization does not bind the current risk constraints')
  }
  if (input.decision.riskConstraintsHash && input.decision.riskConstraintsHash !== auth.value.riskConstraintsHash) {
    return fail('RISK_CONSTRAINT_CHANGE_DENIED', 'risk constraints changed without a constraint authorization')
  }
  if (input.to !== 'AUTHORIZED') {
    return ok({
      ...base(input.decision, input.to),
      humanAuthorized: false,
      investmentAuthorized: false,
      transactionExternallyConfirmed: false,
      authorizationId: auth.value.id,
    })
  }
  if (auth.value.amountMinor === undefined || !auth.value.currency) {
    return fail('MISSING_EVIDENCE', 'authorized amount and currency are required')
  }
  if (input.envelope && auth.value.amountMinor > input.envelope.ceilingMinor) {
    return fail('FAIL_CLOSED', 'authorized amount exceeds the envelope ceiling')
  }
  if (input.envelope && input.envelope.investmentAuthorized) {
    return fail('ENVELOPE_IS_NOT_AUTHORIZATION', 'envelope authorization flag cannot be true')
  }
  return ok({
    ...base(input.decision, 'AUTHORIZED'),
    analysisComplete: true,
    decisionReady: true,
    humanAuthorized: true,
    investmentAuthorized: true,
    transactionExternallyConfirmed: false,
    transactionExecuted: false,
    amountMinor: auth.value.amountMinor,
    currency: auth.value.currency,
    authorizationId: auth.value.id,
    envelopeId: input.envelope?.id ?? input.decision.envelopeId,
  })
}

export function recordExternalConfirmation(
  decision: DecisionCase,
  evidence: EvidenceRef,
  asOf: string,
  claimedTreasurerExecuted?: boolean,
): Result<DecisionCase> {
  if (claimedTreasurerExecuted === true) {
    return fail('TRANSACTION_AUTHORITY_NEVER', 'TREASURER cannot be the executor of a transaction')
  }
  if (decision.stage !== 'AUTHORIZED' || decision.investmentAuthorized !== true) {
    return fail(
      'AUTHORIZATION_REQUIRED',
      'external confirmation requires stage AUTHORIZED and investmentAuthorized; confirmation does not create either',
    )
  }
  const verified = verifyEvidence(evidence, asOf)
  if (!verified.ok) return verified
  if (evidence.origin !== 'EXTERNAL') {
    return fail('MISSING_EVIDENCE', 'external confirmation must originate outside TREASURER')
  }
  if (evidence.sourceType !== 'BROKER_CONFIRMATION' && evidence.sourceType !== 'CUSTODIAN_STATEMENT') {
    return fail('MISSING_EVIDENCE', 'external confirmation requires broker or custodian evidence')
  }
  if (evidence.epistemicClass !== 'FACT') {
    return fail('EPISTEMIC_CONFLATION', 'a transaction confirmation must be FACT evidence, not an estimate')
  }
  return ok({
    ...decision,
    transactionExternallyConfirmed: true,
    transactionExecuted: false,
    externalConfirmationId: evidence.id,
    investmentAuthorized: decision.investmentAuthorized,
    humanAuthorized: decision.humanAuthorized,
  })
}

export function markProposedTradeExecuted(): Result<never> {
  return fail('TRANSACTION_AUTHORITY_NEVER', 'TREASURER cannot mark a proposed trade executed')
}

export function requestTransaction(side: 'BUY' | 'SELL'): Result<never> {
  return fail('TRANSACTION_AUTHORITY_NEVER', `TREASURER cannot ${side}; financial transaction authority is NEVER`)
}

export function assumeAuthorization(): Result<never> {
  return fail('AUTHORIZATION_REQUIRED', 'TREASURER never assumes authorization')
}

export function changeRiskConstraints(
  current: RiskConstraints,
  next: Omit<RiskConstraints, 'contentHash'>,
  authorization: HumanAuthorization | undefined,
): Result<RiskConstraints> {
  if (!authorization) {
    return fail('RISK_CONSTRAINT_CHANGE_DENIED', 'risk constraints cannot change without human authorization')
  }
  const sealed = sealRiskConstraints(next)
  if (authorization.riskConstraintsHash !== sealed.contentHash) {
    return fail('RISK_CONSTRAINT_CHANGE_DENIED', 'authorization hash does not match the proposed constraints')
  }
  const auth = requireHuman(authorization, authorization.decisionId, 'RISK_CONSTRAINT_CHANGE')
  if (!auth.ok) return auth
  return ok(sealed)
}

export function rewriteBenchmark(decision: DecisionCase, benchmark: BenchmarkRef): Result<never> {
  const locked = decision.stage === 'AUTHORIZED' || decision.stage === 'MONITORING' || decision.stage === 'THESIS_REVIEW' || decision.stage === 'HOLD' || decision.stage === 'EXIT' || decision.stage === 'REALLOCATION'
  if (locked && decision.benchmarkHash && decision.benchmarkHash !== benchmarkHash(benchmark)) {
    return fail('BENCHMARK_LOCKED', 'benchmark cannot be rewritten after authorization')
  }
  if (decision.benchmarkHash === benchmarkHash(benchmark)) {
    return fail('BENCHMARK_LOCKED', 'benchmark is already locked')
  }
  return fail('BENCHMARK_LOCKED', 'benchmark changes require a new decision')
}

export function committedCapitalMinor(decisions: readonly DecisionCase[], currency: string): Result<number> {
  let sum = 0
  for (const decision of decisions) {
    if (!decision.investmentAuthorized) continue
    if (decision.stage === 'EXIT' || decision.stage === 'REJECTED') continue
    if (decision.currency !== currency) return fail('INCONSISTENT_CURRENCY', 'committed capital currency mismatch')
    sum += decision.amountMinor
    if (!Number.isSafeInteger(sum)) return fail('MALFORMED', 'committed capital overflow')
  }
  return ok(sum)
}

export const ANALYSIS_INDEPENDENCE = {
  analysisCompleteDoesNotAuthorize: true,
  decisionReadyDoesNotAuthorize: true,
  humanAuthorizedDoesNotExecute: true,
  externalConfirmationDoesNotAuthorize: true,
} as const
