/**
 * Authority Kernel — the single case policy.
 *
 * Replaces `isStewardPlus`, `case_read_any` and every "role >= steward" check.
 * Access to a case comes only from:
 *   1. a live relationship to THIS case (represented member, creator, owner,
 *      assignee, explicit collaborator),
 *   2. a live supervisory mandate whose unit/territory/resource scope covers
 *      this case and whose powers name this action,
 *   3. a live, justified, independently approved, time-boxed emergency grant
 *      naming this case (read-only),
 *   4. a validated executive delegation.
 * Seniority, role title and platform status are never inputs.
 *
 * Privileged matters need an explicit privileged-access relationship; no
 * mandate, emergency grant or delegation reaches them. `case:assign` is the one
 * exception: assigning a privileged matter discloses nothing.
 */
import {
  actionPower,
  activeMembership,
  activeRecusal,
  assessDelegation,
  assessMandate,
  build,
  deny,
  hasCapacity,
  instrumentOf,
  isLive,
} from '../common'
import type {
  Action,
  AuthorityFacts,
  AuthorityRequest,
  AuthoritySource,
  CaseFacts,
  Decision,
  Obligation,
  Reason,
  ResourceRelationship,
  Capacity,
} from '../ontology'

const HANDLER_CAPACITIES: readonly Capacity[] = ['steward', 'chief_steward', 'officer']
const SUPERVISOR_CAPACITIES: readonly Capacity[] = ['chief_steward', 'officer', 'executive']
const EMERGENCY_CAPACITIES: readonly Capacity[] = ['steward', 'chief_steward', 'officer', 'executive']

const HANDLER_ACTIONS: readonly Action[] = [
  'case:read',
  'case:read_internal',
  'case:comment',
  'case:write',
  'case:transition',
]
const MEMBER_ACTIONS: readonly Action[] = ['case:read', 'case:comment']
const COLLABORATOR_CEILING: readonly Action[] = HANDLER_ACTIONS

interface Candidate {
  source: AuthoritySource
  code: 'ALLOWED_BY_RELATIONSHIP' | 'ALLOWED_BY_MANDATE' | 'ALLOWED_BY_DELEGATION' | 'ALLOWED_BY_EMERGENCY_GRANT'
  visibility: 'member_visible' | 'internal'
  obligations: Obligation[]
  authorityLineUserId?: string
}

const covers = (ids: readonly string[] | undefined, id: string | null | undefined): boolean =>
  !!id && !!ids && ids.includes(id)

function scopeCoversCase(scope: { unitIds?: readonly string[]; territoryIds?: readonly string[]; resourceIds?: readonly string[] }, c: CaseFacts): boolean {
  return covers(scope.resourceIds, c.id) || covers(scope.unitIds, c.unitId) || covers(scope.territoryIds, c.territoryId)
}

export function decideCase(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  c: CaseFacts,
  now: Date,
): Decision {
  const orgId = req.organizationId
  const principalId = req.principalUserId
  const membership = activeMembership(facts, orgId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })

  // Absolute restrictions apply before any source of authority is consulted.
  if (c.adverseUserIds.includes(principalId)) {
    return deny(req, now, { code: 'ADVERSE_PARTY', detail: 'principal is a respondent in this matter' })
  }
  const recusal = activeRecusal(facts.recusals, principalId, req.resource, orgId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id, detail: recusal.reason })

  const action = req.action
  const power = actionPower(action)
  const privilegedMatter = c.classification === 'privileged'

  if (action === 'case:read_privileged' && c.counselControlled) {
    return deny(req, now, {
      code: 'COUNSEL_CONTROLLED',
      detail: 'counsel-controlled content is outside the union information boundary',
    })
  }

  const candidates: Candidate[] = []
  const misses: Reason[] = []

  // 1 ── relationships ────────────────────────────────────────────────────
  for (const r of facts.relationships) {
    if (r.principalUserId !== principalId) continue
    if (r.organizationId !== orgId || r.resource.type !== 'case' || r.resource.id !== c.id) continue
    if (!isLive(r, now)) {
      misses.push({ code: 'INSTRUMENT_EXPIRED_OR_REVOKED', ref: r.id, detail: 'relationship is not live' })
      continue
    }
    const grant = relationshipGrant(r, membership.capacities)
    if (grant.miss) {
      misses.push({ ...grant.miss, ref: r.id })
      continue
    }
    // The privileged-access flag is only honoured on an explicit grant made by
    // someone other than its holder; a derived relation can never carry it.
    if (r.privilegedAccess && (r.origin !== 'explicit' || !r.grantedBy || r.grantedBy === r.principalUserId)) {
      misses.push({ code: 'INSTRUMENT_INVALID', ref: r.id, detail: 'privileged access must be an independent explicit grant' })
      continue
    }
    if (!grant.actions.includes(action) && !(action === 'case:read_privileged' && r.privilegedAccess)) {
      misses.push({ code: 'ACTION_NOT_COVERED', ref: r.id, detail: `${r.relation} does not permit ${action}` })
      continue
    }
    if ((privilegedMatter || action === 'case:read_privileged') && !r.privilegedAccess) {
      misses.push({ code: 'PRIVILEGED_MATTER', ref: r.id, detail: 'no explicit privileged-access grant' })
      continue
    }
    candidates.push({
      source: { kind: 'relationship', id: r.id, instrument: `${r.relation} of case ${c.id}` },
      code: 'ALLOWED_BY_RELATIONSHIP',
      visibility: grant.visibility,
      obligations: grant.visibility === 'member_visible' ? ['redact_internal_notes'] : [],
    })
  }

  // 2 ── supervisory & emergency mandates (never privileged) ──────────────
  const mandateBlocked = privilegedMatter && action !== 'case:assign'
  for (const m of facts.mandates) {
    if (m.principalUserId !== principalId) continue
    if (m.kind !== 'supervisory' && m.kind !== 'emergency_access') continue
    const verdict = assessMandate(m, orgId, now)
    if (!verdict.effective) {
      misses.push(...verdict.reasons)
      continue
    }
    if (mandateBlocked || action === 'case:read_privileged') {
      misses.push({ code: 'PRIVILEGED_MATTER', ref: m.id, detail: 'mandates do not reach privileged matters' })
      continue
    }
    if (!m.powers.includes(power)) {
      misses.push({ code: 'ACTION_NOT_COVERED', ref: m.id, detail: `mandate lacks power '${power}'` })
      continue
    }
    if (m.kind === 'supervisory') {
      if (!hasCapacity(membership, SUPERVISOR_CAPACITIES)) {
        misses.push({ code: 'CAPACITY_NOT_ELIGIBLE', ref: m.id })
        continue
      }
      if (c.confidential === true && m.scope.classificationCeiling !== 'confidential') {
        misses.push({ code: 'CLASSIFICATION_EXCEEDS_MANDATE', ref: m.id, detail: 'the case is confidential and the mandate has no confidential ceiling' })
        continue
      }
      if (!scopeCoversCase(m.scope, c)) {
        misses.push({ code: 'OUT_OF_SCOPE', ref: m.id, detail: 'case is outside the mandate unit/territory' })
        continue
      }
      candidates.push({
        source: { kind: 'mandate', id: m.id, instrument: instrumentOf(m) },
        code: 'ALLOWED_BY_MANDATE',
        visibility: power === 'read' ? 'member_visible' : 'internal',
        obligations: power === 'read' ? ['redact_internal_notes'] : [],
      })
    } else {
      if (!hasCapacity(membership, EMERGENCY_CAPACITIES)) {
        misses.push({ code: 'CAPACITY_NOT_ELIGIBLE', ref: m.id })
        continue
      }
      if (!covers(m.scope.resourceIds, c.id)) {
        misses.push({ code: 'OUT_OF_SCOPE', ref: m.id, detail: 'emergency grant names a different resource' })
        continue
      }
      candidates.push({
        source: { kind: 'emergency_grant', id: m.id, instrument: instrumentOf(m) },
        code: 'ALLOWED_BY_EMERGENCY_GRANT',
        visibility: power === 'read_internal' ? 'internal' : 'member_visible',
        obligations: ['emergency_review_required', 'read_only'],
      })
    }
  }

  // 3 ── executive delegation ─────────────────────────────────────────────
  if (req.delegationId) {
    const d = facts.delegations.find((x) => x.id === req.delegationId)
    const bad = (detail: string): Reason => ({ code: 'DELEGATION_INVALID', ref: req.delegationId ?? undefined, detail })
    if (!d) misses.push(bad('delegation not found'))
    else if (d.delegateUserId !== principalId) misses.push(bad('principal is not the delegate'))
    else {
      const dv = assessDelegation(d, orgId, now)
      if (!dv.effective) misses.push(...dv.reasons)
      else if (!d.actions.includes(action) || !d.resourceTypes.includes('case')) misses.push(bad('delegation does not cover this action'))
      else if (privilegedMatter || action === 'case:read_privileged') misses.push({ code: 'PRIVILEGED_MATTER', ref: d.id, detail: 'delegations do not reach privileged matters' })
      else if (!activeMembership(facts, orgId, d.delegatorUserId)) misses.push(bad('delegator no longer holds an active membership'))
      else if (c.adverseUserIds.includes(d.delegatorUserId)) misses.push({ code: 'ADVERSE_PARTY', ref: d.id, detail: 'delegator is a respondent' })
      else if (activeRecusal(facts.recusals, d.delegatorUserId, req.resource, orgId)) misses.push({ code: 'RECUSED', ref: d.id, detail: 'delegator is recused' })
      else {
        const office = facts.mandates.find(
          (m) =>
            m.principalUserId === d.delegatorUserId &&
            m.kind === 'executive_office' &&
            m.sourceInstrument.length > 0 &&
            m.powers.includes(power) &&
            assessMandate(m, orgId, now).effective,
        )
        if (!office) misses.push(bad('delegator holds no live office mandate carrying this power'))
        else {
          candidates.push({
            source: { kind: 'delegation', id: d.id, instrument: `delegation of ${d.office} (office mandate ${office.id})` },
            code: 'ALLOWED_BY_DELEGATION',
            visibility: power === 'read' ? 'member_visible' : 'internal',
            obligations: power === 'read' || power === 'read_internal' ? ['read_only'] : [],
            authorityLineUserId: d.delegatorUserId,
          })
        }
      }
    }
  }

  if (candidates.length === 0) {
    const reasons: Reason[] = [{ code: 'NO_SOURCE_OF_AUTHORITY', detail: `no live source of authority for ${action} on this case` }, ...misses]
    return deny(req, now, ...reasons)
  }

  const internal = candidates.some((x) => x.visibility === 'internal')
  const obligations = internal
    ? candidates.filter((x) => x.visibility === 'internal').flatMap((x) => x.obligations)
    : candidates.flatMap((x) => x.obligations)
  return build({
    req,
    now,
    effect: 'allow',
    reasons: candidates.map((x) => ({ code: x.code, ref: x.source.id })),
    authority: candidates.map((x) => x.source),
    scope: { visibility: internal ? 'internal' : 'member_visible' },
    obligations,
    authorityLineUserId: candidates[0].authorityLineUserId,
  })
}

interface RelationshipGrant {
  actions: readonly Action[]
  visibility: 'member_visible' | 'internal'
  miss?: Reason
}

/** What a relationship, combined with the holder's CAPACITY, permits. */
function relationshipGrant(r: ResourceRelationship, capacities: readonly Capacity[]): RelationshipGrant {
  const handler = HANDLER_CAPACITIES.some((c) => capacities.includes(c))
  switch (r.relation) {
    case 'represented_member':
    case 'creator':
      return { actions: MEMBER_ACTIONS, visibility: 'member_visible' }
    case 'owner':
    case 'assignee':
      return handler
        ? { actions: HANDLER_ACTIONS, visibility: 'internal' }
        : { actions: [], visibility: 'internal', miss: { code: 'CAPACITY_NOT_ELIGIBLE', detail: `${r.relation} requires a representation capacity` } }
    case 'collaborator': {
      // An explicit grant must be authored by someone other than its holder.
      if (r.origin !== 'explicit' || !r.grantedBy || r.grantedBy === r.principalUserId) {
        return { actions: [], visibility: 'internal', miss: { code: 'INSTRUMENT_INVALID', detail: 'collaborator grant is not an independent explicit grant' } }
      }
      if (!handler) {
        return { actions: [], visibility: 'internal', miss: { code: 'CAPACITY_NOT_ELIGIBLE', detail: 'collaborator requires a representation capacity' } }
      }
      const granted = r.permissions.map((p) => `case:${p}` as Action).filter((a) => COLLABORATOR_CEILING.includes(a))
      return {
        actions: granted,
        visibility: granted.includes('case:read_internal') ? 'internal' : 'member_visible',
      }
    }
  }
}
