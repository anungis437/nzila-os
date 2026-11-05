/**
 * Authority Kernel — member-conversation legal hold.
 *
 * Placing or releasing a hold is not a role. An organization-administrator title
 * confers neither action. Authority is a live governance_review mandate whose
 * powers name the action and whose scope names this conversation. The mandate
 * does not confer a read of the conversation. The duty is not delegable: this
 * decision refuses a delegation id, and the database constraint
 * ue_authority_deleg_nondelegable_chk refuses to store one.
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
  MessageRetentionFacts,
  MessageThreadFacts,
  Reason,
} from '../ontology'

const HOLD_CAPACITIES: readonly Capacity[] = ['governance_reviewer']
const PARTICIPATION_ACTIONS = ['message:read', 'message:reply', 'message:close', 'message:archive'] as const
const ASSIGNEE_CAPACITIES: readonly Capacity[] = ['steward', 'chief_steward', 'officer', 'executive']

/**
 * Reading, replying, closing, and archiving follow the conversation row: the member, or the
 * assignee when that membership carries an assignee capacity. A governance mandate, including one
 * that may place a legal hold, is not a source. A delegation id is refused here. These actions are
 * not in the non-delegable catalog constraint; a later migration can lock storage. This decision
 * already ignores a delegation.
 */
export function decideMessageParticipation(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  thread: MessageThreadFacts,
  now: Date,
): Decision {
  if (!PARTICIPATION_ACTIONS.includes(req.action as (typeof PARTICIPATION_ACTIONS)[number])) {
    return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: `${req.action} is not conversation participation` })
  }
  if (req.delegationId) {
    return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'conversation participation is the thread relationship and is not delegable' })
  }
  if (req.action === 'message:reply' && thread.status !== 'open') {
    return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: 'a closed conversation accepts no reply' })
  }
  const membership = activeMembership(facts, req.organizationId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })
  const recusal = activeRecusal(facts.recusals, req.principalUserId, req.resource, req.organizationId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id })

  if (req.principalUserId === thread.memberUserId) {
    if (!hasCapacity(membership, ['member'])) {
      return deny(req, now, { code: 'CAPACITY_NOT_ELIGIBLE', detail: 'the conversation member needs the member capacity' })
    }
    return build({
      req,
      now,
      effect: 'allow',
      reasons: [{ code: 'ALLOWED_AS_SUBJECT', ref: thread.id }],
      authority: [{ kind: 'subject', id: thread.id, instrument: 'member of this conversation' }],
      obligations: ['audit_required'],
    })
  }

  if (thread.assigneeUserId !== null && req.principalUserId === thread.assigneeUserId) {
    if (!hasCapacity(membership, ASSIGNEE_CAPACITIES)) {
      return deny(req, now, {
        code: 'CAPACITY_NOT_ELIGIBLE',
        detail: 'an assignee needs a steward, chief steward, officer, or executive capacity; an administrator title is not one',
      })
    }
    return build({
      req,
      now,
      effect: 'allow',
      reasons: [{ code: 'ALLOWED_BY_RELATIONSHIP', ref: thread.id }],
      authority: [{ kind: 'relationship', id: thread.id, instrument: 'assignee of this conversation' }],
      obligations: ['audit_required'],
    })
  }

  return deny(req, now, {
    code: 'NO_SOURCE_OF_AUTHORITY',
    detail: 'no conversation relationship covers this action; a legal-hold mandate does not confer it',
  })
}

export function decideMessageThread(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  thread: MessageThreadFacts,
  now: Date,
): Decision {
  if (PARTICIPATION_ACTIONS.includes(req.action as (typeof PARTICIPATION_ACTIONS)[number])) {
    return decideMessageParticipation(req, facts, thread, now)
  }
  if (req.action !== 'message:place_legal_hold' && req.action !== 'message:release_legal_hold') {
    return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: `${req.action} is not a conversation legal-hold action` })
  }
  if (req.delegationId) {
    return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'a conversation legal hold is not delegable' })
  }
  const membership = activeMembership(facts, req.organizationId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })
  const recusal = activeRecusal(facts.recusals, req.principalUserId, req.resource, req.organizationId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id })
  if (!hasCapacity(membership, HOLD_CAPACITIES)) {
    return deny(req, now, {
      code: 'CAPACITY_NOT_ELIGIBLE',
      detail: 'a governance-review capacity is required; an administrator title is not a capacity',
    })
  }

  const power = actionPower(req.action)
  const misses: Reason[] = []
  const sources: AuthoritySource[] = []
  for (const mandate of facts.mandates) {
    if (mandate.principalUserId !== req.principalUserId || mandate.kind !== 'governance_review') continue
    const verdict = assessMandate(mandate, req.organizationId, now)
    if (!verdict.effective) {
      misses.push(...verdict.reasons)
      continue
    }
    if (!mandate.powers.includes(power)) {
      misses.push({ code: 'ACTION_NOT_COVERED', ref: mandate.id, detail: `mandate lacks '${power}'` })
      continue
    }
    if (!mandate.scope.resourceIds?.includes(thread.id)) {
      misses.push({ code: 'OUT_OF_SCOPE', ref: mandate.id, detail: 'the mandate does not name this conversation' })
      continue
    }
    sources.push({ kind: 'mandate', id: mandate.id, instrument: instrumentOf(mandate) })
  }
  if (sources.length === 0) {
    return deny(req, now, { code: 'NO_SOURCE_OF_AUTHORITY', detail: `no governance mandate covers ${req.action}` }, ...misses)
  }
  return build({
    req,
    now,
    effect: 'allow',
    reasons: sources.map((source) => ({ code: 'ALLOWED_BY_MANDATE' as const, ref: source.id })),
    authority: sources,
    obligations: ['audit_required'],
  })
}

const RETENTION_ACTIONS = ['message:adopt_retention', 'message:read_retention_policy'] as const

/**
 * Reading or recording the organization's retention period is not a role.
 * Authority is a live governance_review mandate whose powers name the action
 * and whose scope names this organization. The record is not a conversation.
 */
export function decideMessageRetention(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  record: MessageRetentionFacts,
  now: Date,
): Decision {
  if (!RETENTION_ACTIONS.includes(req.action as (typeof RETENTION_ACTIONS)[number])) {
    return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: `${req.action} is not a retention action` })
  }
  if (req.delegationId) {
    return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'a conversation retention record is not delegable' })
  }
  const membership = activeMembership(facts, req.organizationId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })
  const recusal = activeRecusal(facts.recusals, req.principalUserId, req.resource, req.organizationId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id })
  if (!hasCapacity(membership, HOLD_CAPACITIES)) {
    return deny(req, now, {
      code: 'CAPACITY_NOT_ELIGIBLE',
      detail: 'a governance-review capacity is required; an administrator title is not a capacity',
    })
  }

  const power = actionPower(req.action)
  const misses: Reason[] = []
  const sources: AuthoritySource[] = []
  for (const mandate of facts.mandates) {
    if (mandate.principalUserId !== req.principalUserId || mandate.kind !== 'governance_review') continue
    const verdict = assessMandate(mandate, req.organizationId, now)
    if (!verdict.effective) {
      misses.push(...verdict.reasons)
      continue
    }
    if (!mandate.powers.includes(power)) {
      misses.push({ code: 'ACTION_NOT_COVERED', ref: mandate.id, detail: `mandate lacks '${power}'` })
      continue
    }
    if (!mandate.scope.resourceIds?.includes(record.id)) {
      misses.push({ code: 'OUT_OF_SCOPE', ref: mandate.id, detail: 'the mandate does not name this organization' })
      continue
    }
    sources.push({ kind: 'mandate', id: mandate.id, instrument: instrumentOf(mandate) })
  }
  if (sources.length === 0) {
    return deny(req, now, { code: 'NO_SOURCE_OF_AUTHORITY', detail: `no governance mandate covers ${req.action}` }, ...misses)
  }
  return build({
    req,
    now,
    effect: 'allow',
    reasons: sources.map((source) => ({ code: 'ALLOWED_BY_MANDATE' as const, ref: source.id })),
    authority: sources,
    obligations: ['audit_required'],
  })
}
