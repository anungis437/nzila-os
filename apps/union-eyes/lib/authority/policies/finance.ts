/**
 * Authority Kernel — financial policy.
 *
 * Six distinct duties, none implying another: view, prepare, approve, execute,
 * reconcile, audit. Authority comes only from a live, effective `financial`
 * mandate naming the transaction's account and the duty, held by a principal
 * with a financial capacity. Numeric role level and the Secretary-Treasurer
 * title are never inputs.
 *
 * Segregation of duties is evaluated against THIS transaction's actual
 * participants, so one person cannot prepare-and-approve, approve-and-execute,
 * execute-and-reconcile, or audit a transaction they took part in.
 *
 * Financial duties are deliberately NOT delegable in Phase 1: a delegation on a
 * finance action is refused (an institutional decision is pending; see the
 * Phase 1 report).
 */
import {
  actionPower,
  activeMembership,
  activeRecusal,
  assessMandate,
  build,
  deny,
  hasCapacity,
  instrumentOf,
} from '../common'
import type {
  AuthorityFacts,
  AuthorityRequest,
  AuthoritySource,
  Capacity,
  Decision,
  FinancialTransactionFacts,
  MemberFinancialRecordFacts,
  Reason,
} from '../ontology'

export const FINANCE_CAPACITIES: readonly Capacity[] = ['financial_officer', 'executive', 'trustee', 'auditor']

const validAmount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0

export function decideMemberFinancialRecord(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  rec: MemberFinancialRecordFacts,
  now: Date,
): Decision {
  if (req.action !== 'finance:view') {
    return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: 'only finance:view applies to a member financial record' })
  }
  if (req.delegationId) return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'financial duties are not delegable' })
  const membership = activeMembership(facts, req.organizationId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })
  const recusal = activeRecusal(facts.recusals, req.principalUserId, req.resource, req.organizationId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id })

  // A member may always see their own financial record, and nothing else's.
  if (rec.subjectUserId === req.principalUserId) {
    return build({
      req,
      now,
      effect: 'allow',
      reasons: [{ code: 'ALLOWED_AS_SUBJECT' }],
      authority: [{ kind: 'subject', id: rec.id, instrument: 'member viewing own financial record' }],
      obligations: ['read_only'],
    })
  }
  return decideFinanceMandate(req, facts, rec.accountId ?? null, null, now)
}

export function decideFinancialTransaction(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  tx: FinancialTransactionFacts,
  now: Date,
): Decision {
  if (req.delegationId) return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'financial duties are not delegable' })
  if (!validAmount(tx.amountMinor) || tx.currency.trim() === '') {
    return deny(req, now, { code: 'INVALID_AMOUNT', detail: 'transaction amount must be a non-negative integer with a currency' })
  }
  // The amount a caller claims must be the amount on record: approving one
  // figure while executing another is a classic split.
  if (req.amountMinor !== undefined && req.amountMinor !== tx.amountMinor) {
    return deny(req, now, { code: 'INVALID_AMOUNT', detail: 'requested amount differs from the amount on record' })
  }
  if (req.currency !== undefined && req.currency !== tx.currency) {
    return deny(req, now, { code: 'CURRENCY_MISMATCH', detail: 'requested currency differs from the transaction currency' })
  }

  const me = req.principalUserId
  const membership = activeMembership(facts, req.organizationId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })
  if (tx.adverseUserIds.includes(me)) return deny(req, now, { code: 'ADVERSE_PARTY' })
  const recusal = activeRecusal(facts.recusals, me, req.resource, req.organizationId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id })

  // Stored approvals must themselves respect segregation; otherwise the record
  // is contradictory and nothing further may proceed on it.
  const approverIds = tx.approvals.map((a) => a.userId)
  if (
    new Set(approverIds).size !== approverIds.length ||
    (tx.preparedBy && approverIds.includes(tx.preparedBy)) ||
    tx.requiredApprovals < 1
  ) {
    return deny(req, now, { code: 'FACTS_CONTRADICTORY', detail: 'recorded approvals violate segregation of duties' })
  }

  const participants = [tx.preparedBy, ...approverIds, tx.executedBy, tx.reconciledBy].filter(
    (p): p is string => !!p,
  )
  const action = req.action
  const sod = (detail: string, code: Reason['code'] = 'SEGREGATION_OF_DUTIES'): Decision =>
    deny(req, now, { code, detail })

  switch (action) {
    case 'finance:prepare':
      if (tx.state !== 'draft') return deny(req, now, { code: 'STATE_NOT_ELIGIBLE', detail: `cannot prepare in state ${tx.state}` })
      break
    case 'finance:approve':
      if (tx.state !== 'prepared') return deny(req, now, { code: 'STATE_NOT_ELIGIBLE', detail: `cannot approve in state ${tx.state}` })
      if (tx.preparedBy === me) return sod('the preparer cannot approve their own transaction', 'SELF_APPROVAL')
      if (approverIds.includes(me)) return deny(req, now, { code: 'ALREADY_DECIDED', detail: 'already approved' })
      break
    case 'finance:execute': {
      if (tx.state !== 'approved') return deny(req, now, { code: 'STATE_NOT_ELIGIBLE', detail: `cannot execute in state ${tx.state}` })
      if (approverIds.length < tx.requiredApprovals) return deny(req, now, { code: 'STATE_NOT_ELIGIBLE', detail: 'required approvals not met' })
      if (participants.includes(me)) return sod('the executor must be independent of the preparer and approvers')
      break
    }
    case 'finance:reconcile':
      if (tx.state !== 'executed') return deny(req, now, { code: 'STATE_NOT_ELIGIBLE', detail: `cannot reconcile in state ${tx.state}` })
      if (participants.includes(me)) return sod('the reconciler must be independent of the preparer, approvers and executor')
      break
    case 'finance:audit':
      if (participants.includes(me)) return sod('an auditor must be independent of the transaction they audit')
      break
    case 'finance:view':
      break
    default:
      return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: `${action} does not apply to a financial transaction` })
  }

  if (!hasCapacity(membership, FINANCE_CAPACITIES)) {
    return deny(req, now, { code: 'CAPACITY_NOT_ELIGIBLE', detail: 'a financial capacity is required to hold financial authority' })
  }
  return decideFinanceMandate(req, facts, tx.accountId, tx, now)
}

function decideFinanceMandate(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  accountId: string | null,
  tx: FinancialTransactionFacts | null,
  now: Date,
): Decision {
  const power = actionPower(req.action)
  const membership = activeMembership(facts, req.organizationId)
  if (!membership || !hasCapacity(membership, FINANCE_CAPACITIES)) {
    return deny(req, now, { code: 'CAPACITY_NOT_ELIGIBLE', detail: 'a financial capacity is required' })
  }
  const misses: Reason[] = []
  const sources: AuthoritySource[] = []
  let maxAmount: number | undefined

  for (const m of facts.mandates) {
    if (m.principalUserId !== req.principalUserId || m.kind !== 'financial') continue
    const verdict = assessMandate(m, req.organizationId, now)
    if (!verdict.effective) {
      misses.push(...verdict.reasons)
      continue
    }
    if (!m.powers.includes(power)) {
      misses.push({ code: 'ACTION_NOT_COVERED', ref: m.id, detail: `mandate lacks duty '${power}'` })
      continue
    }
    if (!accountId || !m.scope.accountIds?.includes(accountId)) {
      misses.push({ code: 'OUT_OF_SCOPE', ref: m.id, detail: 'account is outside the mandate' })
      continue
    }
    if (tx && (power === 'prepare' || power === 'approve' || power === 'execute')) {
      if (m.currency !== tx.currency) {
        misses.push({ code: 'CURRENCY_MISMATCH', ref: m.id })
        continue
      }
      if (tx.amountMinor > (m.monetaryLimitMinor as number)) {
        misses.push({ code: 'AMOUNT_EXCEEDS_LIMIT', ref: m.id, detail: `limit ${m.monetaryLimitMinor}` })
        continue
      }
      maxAmount = Math.max(maxAmount ?? 0, m.monetaryLimitMinor as number)
    }
    sources.push({ kind: 'mandate', id: m.id, instrument: instrumentOf(m) })
  }

  if (sources.length === 0) {
    return deny(req, now, { code: 'NO_SOURCE_OF_AUTHORITY', detail: `no financial mandate covers ${req.action}` }, ...misses)
  }
  return build({
    req,
    now,
    effect: 'allow',
    reasons: sources.map((s) => ({ code: 'ALLOWED_BY_MANDATE' as const, ref: s.id })),
    authority: sources,
    scope: maxAmount === undefined ? {} : { maxAmountMinor: maxAmount },
    obligations: power === 'view' || power === 'audit' ? ['read_only'] : [],
  })
}

/**
 * Grant-time check: duties that must never be held together over the same
 * account. Used when issuing mandates (storage layer) and by the compatibility
 * migration to find pre-existing conflicts.
 */
export const INCOMPATIBLE_DUTIES: readonly (readonly [string, string])[] = [
  ['prepare', 'approve'],
  ['approve', 'execute'],
  ['prepare', 'execute'],
  ['execute', 'reconcile'],
  ['prepare', 'audit'],
  ['approve', 'audit'],
  ['execute', 'audit'],
  ['reconcile', 'audit'],
]

export function dutyConflicts(
  mandates: readonly { principalUserId: string; kind: string; powers: readonly string[]; scope: { accountIds?: readonly string[] } }[],
): { principalUserId: string; accountId: string; duties: [string, string] }[] {
  const out: { principalUserId: string; accountId: string; duties: [string, string] }[] = []
  const held = new Map<string, Set<string>>()
  for (const m of mandates) {
    if (m.kind !== 'financial') continue
    for (const acct of m.scope.accountIds ?? []) {
      const key = `${m.principalUserId}|${acct}`
      const set = held.get(key) ?? new Set<string>()
      m.powers.forEach((p) => set.add(p))
      held.set(key, set)
    }
  }
  for (const [key, set] of held) {
    const [principalUserId, accountId] = key.split('|')
    for (const [a, b] of INCOMPATIBLE_DUTIES) {
      if (set.has(a) && set.has(b)) out.push({ principalUserId, accountId, duties: [a, b] })
    }
  }
  return out
}
