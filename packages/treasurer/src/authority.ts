/**
 * Authority matrix enforcement.
 * Financial transaction authority is NEVER. Production authority is NO.
 */
import {
  PERMITTED_AUTHORITIES,
  PROHIBITED_AUTHORITIES,
  TREASURER_IDENTITY,
  fail,
  hasAuthority,
  isProhibited,
  ok,
  type Result,
} from './kernel'
import { treatEnvelopeAsAuthorization, treatEnvelopeAsCommitted } from './envelope'
import {
  assumeAuthorization,
  markProposedTradeExecuted,
  requestTransaction,
} from './decision'
import type { CapitalEnvelope } from './schemas'

export interface AuthorityPosture {
  readonly productionAuthority: 'NO'
  readonly financialTransactionAuthority: 'NEVER'
  readonly permitted: readonly string[]
  readonly prohibited: readonly string[]
}

export function authorityPosture(): AuthorityPosture {
  return {
    productionAuthority: TREASURER_IDENTITY.productionAuthority,
    financialTransactionAuthority: TREASURER_IDENTITY.financialTransactionAuthority,
    permitted: PERMITTED_AUTHORITIES,
    prohibited: PROHIBITED_AUTHORITIES,
  }
}

export function exercise(authority: string, envelope?: CapitalEnvelope): Result<{ readonly authority: string; readonly transactionExecuted: false }> {
  if (isProhibited(authority) || !hasAuthority(authority)) {
    return fail('TRANSACTION_AUTHORITY_NEVER', `${authority} is not a TREASURER authority`)
  }
  if (authority === 'EXECUTE_FINANCIAL_TRANSACTION') {
    return fail('TRANSACTION_AUTHORITY_NEVER', 'financial transaction authority is NEVER')
  }
  if (envelope && authority === 'MAINTAIN_ENVELOPE_PLAN') {
    const committed = treatEnvelopeAsCommitted(envelope)
    if (committed.ok) {
      return fail('FAIL_CLOSED', 'envelope commitment must fail closed')
    }
  }
  return ok({ authority, transactionExecuted: false })
}

export function authorizationAttacks(envelope: CapitalEnvelope): readonly Result<never>[] {
  return [
    requestTransaction('BUY'),
    requestTransaction('SELL'),
    markProposedTradeExecuted(),
    assumeAuthorization(),
    treatEnvelopeAsCommitted(envelope),
    treatEnvelopeAsAuthorization(envelope),
  ]
}

export function refuseReturnOnlyOptimization(input: {
  readonly ignoreLiquidity?: boolean
  readonly ignoreDownside?: boolean
}): Result<true> {
  if (input.ignoreLiquidity || input.ignoreDownside) {
    return fail('FAIL_CLOSED', 'TREASURER cannot optimize for return while ignoring liquidity or downside')
  }
  return ok(true)
}
