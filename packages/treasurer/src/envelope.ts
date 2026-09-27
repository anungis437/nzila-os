/**
 * Capital envelopes are planning authority.
 * An envelope is not evidence that an opportunity exists and not authorization to invest.
 */
import { TREASURER_IDENTITY, assertSafeInt, fail, ok, scanInjection, type Result } from './kernel'
import { envelopeUnreleased } from './calculations'
import { capitalEnvelopeSchema, type CapitalEnvelope } from './schemas'

export interface EnvelopeDraft {
  readonly id: string
  readonly currency: string
  readonly ceilingMinor: number
  readonly benchmarkAlternativeId: string
  readonly evidenceGateIds: readonly string[]
  readonly thesisId: string
  readonly downsideCaseIds: readonly string[]
  readonly impairmentScenarioIds: readonly string[]
  readonly liquidityNote: string
  readonly concentrationNote: string
  readonly epistemicClass?: string
}

export function createEnvelope(draft: EnvelopeDraft): Result<CapitalEnvelope> {
  if (draft.epistemicClass && draft.epistemicClass !== 'ASSUMPTION') {
    return fail('EPISTEMIC_CONFLATION', 'a capital envelope is planning authority, not FACT')
  }
  const injection = scanInjection([draft.liquidityNote, draft.concentrationNote])
  if (injection) return fail('INJECTION_REJECTED', injection)
  const ceiling = assertSafeInt(draft.ceilingMinor, 'envelope ceiling must be an integer')
  if (!ceiling.ok) return ceiling
  if (ceiling.value < 0) return fail('ILLOGICAL_QUANTITY', 'envelope ceiling cannot be negative')
  const unreleased = envelopeUnreleased(ceiling.value, 0)
  if (!unreleased.ok) return unreleased
  const candidate = {
    id: draft.id,
    epistemicClass: 'ASSUMPTION' as const,
    capitalDomain: 'PERSONAL' as const,
    ownerPrincipalId: TREASURER_IDENTITY.principalId,
    currency: draft.currency,
    ceilingMinor: ceiling.value,
    releasedMinor: 0,
    unreleasedMinor: unreleased.value,
    committedMinor: 0 as const,
    investmentAuthorized: false as const,
    transactionExecuted: false as const,
    benchmarkAlternativeId: draft.benchmarkAlternativeId,
    evidenceGateIds: [...draft.evidenceGateIds],
    thesisId: draft.thesisId,
    downsideCaseIds: [...draft.downsideCaseIds],
    impairmentScenarioIds: [...draft.impairmentScenarioIds],
    liquidityNote: draft.liquidityNote,
    concentrationNote: draft.concentrationNote,
    status: 'PLANNING' as const,
    decisionIds: [],
  }
  const parsed = capitalEnvelopeSchema.safeParse(candidate)
  if (!parsed.success) return fail('MALFORMED', 'envelope draft is malformed')
  return ok(parsed.data)
}

export function releaseEnvelope(envelope: CapitalEnvelope, amountMinor: number): Result<CapitalEnvelope> {
  const amount = assertSafeInt(amountMinor, 'release amount must be an integer')
  if (!amount.ok) return amount
  if (amount.value <= 0) return fail('ILLOGICAL_QUANTITY', 'release amount must be positive')
  const released = envelope.releasedMinor + amount.value
  const unreleased = envelopeUnreleased(envelope.ceilingMinor, released)
  if (!unreleased.ok) return unreleased
  return ok({
    ...envelope,
    releasedMinor: released,
    unreleasedMinor: unreleased.value,
    committedMinor: 0,
    investmentAuthorized: false,
    transactionExecuted: false,
    status: 'RELEASED_FOR_CONSIDERATION',
  })
}

export function treatEnvelopeAsCommitted(_envelope: CapitalEnvelope): Result<never> {
  return fail(
    'ENVELOPE_IS_NOT_COMMITTED_CAPITAL',
    'a capital envelope is planning authority and is not committed capital',
  )
}

export function treatEnvelopeAsAuthorization(_envelope: CapitalEnvelope): Result<never> {
  return fail('ENVELOPE_IS_NOT_AUTHORIZATION', 'CAPITAL_ENVELOPE_EXISTS is not INVESTMENT_AUTHORIZED')
}
