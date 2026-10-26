/**
 * The supported authorization adapter between an authenticated application request and the kernel's FINANCIAL duties
 * (UE-CONV-D-001 / D-002 / D-003).
 *
 * CANONICAL WORKFLOW (D-002): the one place a union payment is prepared, approved, executed and reconciled is the kernel
 * financial workflow (`ue_authority_financial_steps`, written by `recordFinancialStep`). It is decided by the kernel's
 * finance policy: a live `financial` mandate naming the transaction's account and the duty, a financial capacity,
 * segregation of duties against the transaction's real participants, amount and currency on record, and no delegation.
 * `services/financial-service` is NOT an approval path of this application and nothing in app/ or lib/ may route a
 * money duty to it (see lib/finance/__tests__/finance-canonical.test.ts).
 *
 * A route asks for a duty on ONE specific transaction (a `public.payments` row registered into the workflow), runs its
 * business mutation, and records the financial step and the audit in the SAME transaction (`performFinancialDuty`):
 * a failed step, a failed business write or a failed audit rolls all of them back together.
 *
 * Answers a route must give (all raised as FinancialDutyError):
 *   501 FINANCE_SOURCE_UNAVAILABLE  public.payments cannot be an authoritative source (missing amount/currency/payer)
 *   403 FINANCIAL_MANDATES_NOT_ISSUED  the institution has issued no live financial mandate yet; the caller is of a
 *                                   financial capacity, so telling them is not an existence oracle for any transaction
 *   404 NOT_FOUND                   no such transaction, another organization's, or one the caller holds no `view` on
 *   403 DUTY_NOT_HELD               the caller can see the transaction but the kernel refuses this duty (recorded)
 *   409 STEP_REFUSED / FACT_MISMATCH  ordering, segregation enforced by the ledger, or amount/currency/payer mismatch
 *   422 INVALID_REQUEST             the request itself is malformed
 *
 * Visibility is the `view` duty: an office that holds any other duty on an account must also hold `view` on it, or the
 * transaction is answered 404 to that office.
 */
import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import type { Action, AuthorityRequest, Decision } from '../ontology'
import { FINANCE_CAPACITIES } from '../policies/finance'
import { enforceAuthority, type EnforcementDeps } from './enforce'
import { AuthorityStoreError, isUuid, type SqlExecutor } from './executor'
import { canonicalMembershipSource } from './identity'
import { financeSourceReadiness, loadFinancialTransaction } from './resources'
import { drizzleExecutor, kernelDeps } from './route-adapter'
import { recordFinancialStep, type FinancialStep } from './workflow'

export type FinancialAction = Extract<
  Action,
  'finance:view' | 'finance:prepare' | 'finance:approve' | 'finance:execute' | 'finance:reconcile' | 'finance:audit'
>

export const FINANCIAL_STEP_ACTION: Record<FinancialStep, FinancialAction> = {
  registered: 'finance:prepare',
  prepared: 'finance:prepare',
  approved: 'finance:approve',
  executed: 'finance:execute',
  reconciled: 'finance:reconcile',
}

export type FinancialDutyCode =
  | 'FINANCE_SOURCE_UNAVAILABLE'
  | 'FINANCIAL_MANDATES_NOT_ISSUED'
  | 'NOT_FOUND'
  | 'DUTY_NOT_HELD'
  | 'SEGREGATION_OF_DUTIES'
  | 'STEP_REFUSED'
  | 'FACT_MISMATCH'
  | 'INVALID_REQUEST'

export const FINANCIAL_DUTY_STATUS: Record<FinancialDutyCode, number> = {
  FINANCE_SOURCE_UNAVAILABLE: 501,
  FINANCIAL_MANDATES_NOT_ISSUED: 403,
  NOT_FOUND: 404,
  DUTY_NOT_HELD: 403,
  SEGREGATION_OF_DUTIES: 403,
  STEP_REFUSED: 409,
  FACT_MISMATCH: 409,
  INVALID_REQUEST: 422,
}

export class FinancialDutyError extends Error {
  readonly status: number
  constructor(
    readonly code: FinancialDutyCode,
    message: string,
    readonly reasons: readonly string[] = [],
    readonly missingColumns: readonly string[] = [],
  ) {
    super(message)
    this.name = 'FinancialDutyError'
    this.status = FINANCIAL_DUTY_STATUS[code]
  }
}

export interface FinancialActionRequest {
  userId: string
  organizationId: string
  /** The `public.payments` id registered into the kernel financial workflow. */
  transactionId: string
  action: FinancialAction
  /** The amount the caller claims, in minor units. A mismatch with the amount on record is refused. */
  amountMinor?: number
  currency?: string
}

const reasonCodes = (d: Decision): string[] => d.reasons.map((r) => r.code)

const resourceOf = (i: FinancialActionRequest): AuthorityRequest['resource'] => ({
  type: 'financial_transaction',
  id: i.transactionId,
  organizationId: i.organizationId,
})

/** A full kernel decision for one financial duty on one transaction, for the authenticated principal of `tx`. */
export function decideFinancialAction(tx: RLSTx, input: FinancialActionRequest, deps: EnforcementDeps = kernelDeps): Promise<Decision> {
  return decideFinancialActionOn(drizzleExecutor(tx), input, deps)
}

export function decideFinancialActionOn(exec: SqlExecutor, input: FinancialActionRequest, deps: EnforcementDeps = kernelDeps): Promise<Decision> {
  return enforceAuthority(
    exec,
    deps,
    {
      principalUserId: input.userId,
      organizationId: input.organizationId,
      action: input.action,
      resource: resourceOf(input),
      ...(input.amountMinor !== undefined ? { amountMinor: input.amountMinor } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
    },
    { authenticated: true },
  )
}

/** Exact conversion of a decimal amount to minor units; refuses anything with more than two decimals or no safe integer. */
export function amountToMinor(amount: number): number {
  const minor = Math.round(amount * 100)
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(minor) || Math.abs(minor / 100 - amount) > 1e-9) {
    throw new FinancialDutyError('INVALID_REQUEST', 'amount must be a non-negative number with at most two decimals')
  }
  return minor
}

async function requireFinanceSource(exec: SqlExecutor): Promise<void> {
  const readiness = await financeSourceReadiness(exec)
  if (!readiness.ready) {
    throw new FinancialDutyError(
      'FINANCE_SOURCE_UNAVAILABLE',
      'Financial duties are unavailable: the payments source has no amount, currency or payer.',
      [],
      readiness.missingColumns,
    )
  }
}

async function liveFinancialMandateCount(exec: SqlExecutor, organizationId: string): Promise<number> {
  const row = (
    await exec.query<{ n: number | string }>(
      `SELECT count(*)::int AS n FROM ue_authority_mandates
        WHERE organization_id = $1::uuid AND kind = 'financial' AND status = 'active' AND revoked_at IS NULL
          AND effective_at <= now() AND expires_at > now()`,
      [organizationId],
    )
  ).rows[0]
  return Number(row?.n ?? 0)
}

/** Refuses when this organization has no live financial mandate. Does not treat a role or an administrator title as one. */
export async function assertLiveFinancialMandate(exec: SqlExecutor, organizationId: string): Promise<void> {
  if (!isUuid(organizationId)) throw new FinancialDutyError('INVALID_REQUEST', 'organizationId must be a uuid')
  if ((await liveFinancialMandateCount(exec, organizationId)) === 0) throw mandatesNotIssuedError()
}

async function holdsFinancialCapacity(exec: SqlExecutor, organizationId: string, userId: string): Promise<boolean> {
  const rows = await canonicalMembershipSource(exec, organizationId, [userId])
  return rows.some(
    (m) => m.userId === userId && m.organizationId === organizationId && m.status === 'active' && m.capacities.some((c) => FINANCE_CAPACITIES.includes(c)),
  )
}

/** Best-effort security evidence for a refusal; the refusal itself never depends on it. */
async function recordRefusal(input: FinancialActionRequest, reasons: readonly string[]): Promise<void> {
  try {
    await auditLog({
      eventType: AuditEventType.AUTH_FAILED,
      severity: AuditSeverity.HIGH,
      userId: input.userId,
      organizationId: input.organizationId,
      resource: 'financial_transaction',
      resourceId: input.transactionId.slice(0, 255),
      action: input.action,
      outcome: 'failure',
      details: { reasons },
    })
  } catch (error) {
    logger.warn('Financial refusal could not be recorded', { error: error instanceof Error ? error.message : String(error) })
  }
}

const mandatesNotIssuedError = () =>
  new FinancialDutyError(
    'FINANCIAL_MANDATES_NOT_ISSUED',
    'No financial mandate has been issued in this organization. Financial duties stay unavailable until the institution issues them.',
  )

async function mandatesNotIssued(exec: SqlExecutor, organizationId: string, userId: string): Promise<boolean> {
  return (await liveFinancialMandateCount(exec, organizationId)) === 0 && (await holdsFinancialCapacity(exec, organizationId, userId))
}

/**
 * Turns a kernel refusal into the response a route must give. Never returns: an allow never reaches it.
 * The caller who cannot `view` the transaction learns nothing about it (404), except that no financial mandate exists
 * at all in their organization, which is institutional state and independent of any transaction id.
 */
async function refuse(exec: SqlExecutor, input: FinancialActionRequest, decision: Decision, deps: EnforcementDeps): Promise<never> {
  if (input.action !== 'finance:view') {
    const view = await decideFinancialActionOn(exec, { userId: input.userId, organizationId: input.organizationId, transactionId: input.transactionId, action: 'finance:view' }, deps)
    if (view.effect === 'allow') {
      await recordRefusal(input, reasonCodes(decision))
      throw new FinancialDutyError('DUTY_NOT_HELD', `The ${input.action} duty is not held for this transaction.`, reasonCodes(decision))
    }
  }
  if (await mandatesNotIssued(exec, input.organizationId, input.userId)) throw mandatesNotIssuedError()
  if (reasonCodes(decision).includes('FACTS_CONTRADICTORY')) {
    logger.warn('Financial transaction facts are contradictory or unloadable', { organizationId: input.organizationId, transactionId: input.transactionId })
  }
  throw new FinancialDutyError('NOT_FOUND', 'Financial transaction not found.')
}


/**
 * The kernel decision for one duty on one transaction, as a throw. On an allow with a claimed amount or currency, the
 * claim must equal the record (checked AFTER authority, so the amount is never an oracle for a caller without a duty).
 */
export async function requireFinancialDuty(tx: RLSTx, input: FinancialActionRequest, deps: EnforcementDeps = kernelDeps): Promise<Decision> {
  return requireFinancialDutyOn(drizzleExecutor(tx), input, deps)
}

export async function requireFinancialDutyOn(exec: SqlExecutor, input: FinancialActionRequest, deps: EnforcementDeps = kernelDeps): Promise<Decision> {
  await requireFinanceSource(exec)
  const { amountMinor, currency, ...bare } = input
  const decision = await decideFinancialActionOn(exec, bare, deps)
  if (decision.effect !== 'allow') return refuse(exec, input, decision, deps)
  if (amountMinor === undefined && currency === undefined) return decision
  const matched = await decideFinancialActionOn(exec, input, deps)
  if (matched.effect !== 'allow') {
    throw new FinancialDutyError('FACT_MISMATCH', 'The amount or currency differs from the transaction on record.', reasonCodes(matched))
  }
  return matched
}

export interface FinancialAudit {
  action: string
  resourceType: string
  resourceId: string
  details?: Record<string, unknown>
}

export interface FinancialDutyInput {
  userId: string
  organizationId: string
  transactionId: string
  step: FinancialStep
  /** Registration only. */
  accountId?: string
  requiredApprovals?: number
  amountMinor?: number
  currency?: string
}

export interface FinancialDutyResult<T> {
  stepId: string
  decision: Decision | null
  result: T
}

const LEDGER_REFUSAL = /SEGREGATION_OF_DUTIES|STATE_NOT_ELIGIBLE|ue_authority_fin_step_uq|ue_authority_fin_approver_uq/

/**
 * Performs one financial step as ONE atomic unit on the caller's transaction: the kernel decision, the step in the
 * financial ledger, the business mutation (`work`) and the business audit record. Any failure, including an audit
 * failure, throws and the caller's transaction rolls everything back.
 */
export async function performFinancialDuty<T = undefined>(
  tx: RLSTx,
  input: FinancialDutyInput,
  work?: (ctx: { decision: Decision | null }) => Promise<{ result: T; audit: FinancialAudit }>,
  defaultAudit?: FinancialAudit,
  deps: EnforcementDeps = kernelDeps,
): Promise<FinancialDutyResult<T>> {
  const exec = drizzleExecutor(tx)
  const request: FinancialActionRequest = {
    userId: input.userId,
    organizationId: input.organizationId,
    transactionId: input.transactionId,
    action: FINANCIAL_STEP_ACTION[input.step],
    amountMinor: input.amountMinor,
    currency: input.currency,
  }

  let decision: Decision | null = null
  if (input.step === 'registered') {
    await requireFinanceSource(exec)
  } else {
    decision = await requireFinancialDutyOn(exec, request, deps)
  }

  let stepId: string
  try {
    stepId = await recordFinancialStep(exec, deps, {
      organizationId: input.organizationId,
      actorUserId: input.userId,
      paymentId: input.transactionId,
      step: input.step,
      accountId: input.accountId,
      requiredApprovals: input.requiredApprovals,
    })
  } catch (error) {
    throw await translateStepError(exec, request, error)
  }

  const done = work ? await work({ decision }) : undefined
  const audit = done?.audit ?? defaultAudit
  if (!audit) throw new Error('performFinancialDuty needs an audit record for the step')
  await persistAtomicAudit(tx, {
    organizationId: input.organizationId,
    userId: input.userId,
    action: audit.action,
    resourceType: audit.resourceType,
    resourceId: audit.resourceId,
    details: {
      ...(audit.details ?? {}),
      transactionId: input.transactionId,
      financialStep: input.step,
      financialStepId: stepId,
      authority: decision?.authority.map((a) => ({ kind: a.kind, id: a.id, instrument: a.instrument })) ?? [],
    },
  })
  return { stepId, decision, result: done?.result as T }
}

async function translateStepError(exec: SqlExecutor, request: FinancialActionRequest, error: unknown): Promise<unknown> {
  if (error instanceof FinancialDutyError) return error
  if (error instanceof AuthorityStoreError) {
    if (error.code === 'NOT_FOUND') return new FinancialDutyError('NOT_FOUND', 'Financial transaction not found.')
    if (error.code === 'PRECONDITION') {
      if (/FINANCE_SOURCE_UNAVAILABLE/.test(error.message)) return new FinancialDutyError('FINANCE_SOURCE_UNAVAILABLE', 'Financial duties are unavailable: the payments source has no amount, currency or payer.')
      return new FinancialDutyError('INVALID_REQUEST', error.message)
    }
    if (error.code === 'DENIED') {
      // Registration is the only step that is not pre-decided: it answers like any other refused duty.
      if (await mandatesNotIssued(exec, request.organizationId, request.userId)) return mandatesNotIssuedError()
      await recordRefusal(request, [error.message])
      return new FinancialDutyError('DUTY_NOT_HELD', `The ${request.action} duty is not held for this transaction.`, [error.message])
    }
  }
  const causeMessage = error instanceof Error && error.cause instanceof Error ? error.cause.message : ''
  if (error instanceof Error && LEDGER_REFUSAL.test(`${error.message} ${causeMessage}`)) {
    return new FinancialDutyError('STEP_REFUSED', causeMessage || error.message)
  }
  return error
}

export interface FinancialTransactionView {
  transactionId: string
  accountId: string
  state: string
  amountMinor: number
  currency: string
  requiredApprovals: number
  approvalsRecorded: number
}

/** Reads one transaction through the kernel `finance:view` decision; the caller never sees what the kernel withholds. */
export async function readFinancialTransaction(
  tx: RLSTx,
  input: Pick<FinancialActionRequest, 'userId' | 'organizationId' | 'transactionId'>,
  deps: EnforcementDeps = kernelDeps,
): Promise<FinancialTransactionView> {
  const exec = drizzleExecutor(tx)
  await requireFinancialDutyOn(exec, { ...input, action: 'finance:view' }, deps)
  const request: AuthorityRequest = {
    principalUserId: input.userId,
    organizationId: input.organizationId,
    action: 'finance:view',
    resource: { type: 'financial_transaction', id: input.transactionId, organizationId: input.organizationId },
  }
  const loaded = await loadFinancialTransaction(exec, request)
  if (!loaded || loaded.resource.kind !== 'financial_transaction') throw new FinancialDutyError('NOT_FOUND', 'Financial transaction not found.')
  const facts = loaded.resource
  return {
    transactionId: facts.id,
    accountId: facts.accountId,
    state: facts.state,
    amountMinor: facts.amountMinor,
    currency: facts.currency,
    requiredApprovals: facts.requiredApprovals,
    approvalsRecorded: facts.approvals.length,
  }
}
