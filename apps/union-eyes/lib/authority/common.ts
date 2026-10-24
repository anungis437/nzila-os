/**
 * Authority Kernel — shared evaluation primitives (pure).
 */
import {
  POLICY_VERSION,
  type Action,
  type AuthorityFacts,
  type AuthorityRequest,
  type AuthoritySource,
  type Capacity,
  type Decision,
  type DecisionScope,
  type Delegation,
  type Mandate,
  type Membership,
  type Obligation,
  type Reason,
  type Recusal,
  type ResourceRelationship,
  type ResourceRef,
} from './ontology'

export const EMERGENCY_MAX_MS = 24 * 60 * 60 * 1000
export const EMERGENCY_MIN_JUSTIFICATION = 20

export interface Live {
  status: string
  effectiveAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
}

export type Liveness = 'live' | 'not_yet_effective' | 'expired' | 'revoked' | 'inconsistent'

/**
 * Time is authoritative over the status column: a row marked active but past
 * its expiry is expired; a revokedAt in the past is revoked whatever `status`
 * says. A row that claims active while carrying a revocation, or whose window
 * is inverted, is inconsistent and never live.
 */
export function liveness(row: Live, now: Date): Liveness {
  if (row.expiresAt && row.expiresAt.getTime() <= row.effectiveAt.getTime()) return 'inconsistent'
  if (row.revokedAt) {
    if (row.status === 'active') return 'inconsistent'
    return row.revokedAt.getTime() <= now.getTime() ? 'revoked' : 'inconsistent'
  }
  if (row.status === 'revoked') return 'inconsistent'
  if (row.status === 'expired') return 'expired'
  if (row.status === 'suspended') return 'revoked'
  if (row.status !== 'active') return 'inconsistent'
  if (row.effectiveAt.getTime() > now.getTime()) return 'not_yet_effective'
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'live'
}

export const isLive = (row: Live, now: Date): boolean => liveness(row, now) === 'live'

// ── Membership ────────────────────────────────────────────────────────────

export function activeMembership(
  facts: AuthorityFacts,
  organizationId: string,
  userId: string = facts.principal.userId,
): Membership | null {
  const matches = facts.memberships.filter((m) => m.userId === userId && m.organizationId === organizationId)
  // Two rows for one (user, org) is contradictory authoritative data.
  if (matches.length !== 1) return null
  return matches[0].status === 'active' ? matches[0] : null
}

export function duplicateMembership(facts: AuthorityFacts, organizationId: string): boolean {
  return (
    facts.memberships.filter(
      (m) => m.userId === facts.principal.userId && m.organizationId === organizationId,
    ).length > 1
  )
}

export const hasCapacity = (m: Membership, wanted: readonly Capacity[]): boolean =>
  wanted.some((c) => m.capacities.includes(c))

// ── Instrument validity ────────────────────────────────────────────────────

export interface InstrumentVerdict {
  effective: boolean
  reasons: Reason[]
}

const MONETARY_POWERS = new Set(['prepare', 'approve', 'execute'])

/**
 * Whether a mandate is an effective instrument. An invalid instrument grants
 * nothing, but does not by itself fail the whole decision: other, valid
 * authority may still apply.
 */
export function assessMandate(m: Mandate, orgId: string, now: Date): InstrumentVerdict {
  const reasons: Reason[] = []
  const bad = (detail: string) => reasons.push({ code: 'INSTRUMENT_INVALID', detail, ref: m.id })

  if (m.organizationId !== orgId) {
    bad('mandate belongs to another organization')
    return { effective: false, reasons }
  }
  const lv = liveness(m, now)
  if (lv === 'inconsistent') bad('status, window and revocation are contradictory')
  else if (lv !== 'live') {
    reasons.push({ code: 'INSTRUMENT_EXPIRED_OR_REVOKED', detail: lv, ref: m.id })
  }
  if (!m.sourceInstrument || m.sourceInstrument.trim() === '') bad('no source instrument recorded')
  if (m.powers.length === 0) bad('no powers granted')
  if (m.grantedBy === m.principalUserId) bad('self-granted mandate')
  // Every mandate is time-bound; renewal is an affirmative act.
  if (m.expiresAt === null) bad('mandate has no expiry')

  if (m.kind === 'supervisory') {
    const s = m.scope
    const bounded = (s.unitIds?.length ?? 0) + (s.territoryIds?.length ?? 0) + (s.resourceIds?.length ?? 0) > 0
    if (!bounded) bad('supervisory mandate has no unit, territory or resource scope')
    if (m.powers.includes('read_privileged')) bad('supervisory mandates cannot reach privileged matters')
  }

  if (m.kind === 'financial') {
    const monetary = m.powers.some((p) => MONETARY_POWERS.has(p))
    if (monetary) {
      if (!Number.isSafeInteger(m.monetaryLimitMinor) || (m.monetaryLimitMinor as number) < 0) {
        bad('monetary duty without an integer limit')
      }
      if (!m.currency) bad('monetary duty without a currency')
    }
    if ((m.scope.accountIds?.length ?? 0) === 0) bad('financial mandate has no account scope')
  }

  if (m.kind === 'governance_review' && (m.scope.resourceIds?.length ?? 0) === 0) {
    bad('review mandate is not bound to a specific review')
  }

  if (m.kind === 'emergency_access') {
    if (!m.justification || m.justification.trim().length < EMERGENCY_MIN_JUSTIFICATION) {
      bad('emergency access requires a recorded justification')
    }
    if (!m.approvedBy) bad('emergency access requires an independent approver')
    else if (m.approvedBy === m.principalUserId) bad('emergency access cannot be self-approved')
    if (m.expiresAt && m.expiresAt.getTime() - m.effectiveAt.getTime() > EMERGENCY_MAX_MS) {
      bad('emergency access exceeds the 24 hour maximum')
    }
    if ((m.scope.resourceIds?.length ?? 0) === 0) bad('emergency access must name the resource')
    if (m.powers.some((p) => p !== 'read' && p !== 'read_internal')) {
      bad('emergency access is read-only')
    }
  }

  return { effective: reasons.length === 0, reasons }
}

export function relationshipLive(r: ResourceRelationship, now: Date): boolean {
  return isLive(r, now)
}

export function assessDelegation(
  d: Delegation,
  orgId: string,
  now: Date,
): InstrumentVerdict {
  const reasons: Reason[] = []
  const bad = (detail: string) => reasons.push({ code: 'DELEGATION_INVALID', detail, ref: d.id })
  if (d.organizationId !== orgId) bad('delegation belongs to another organization')
  const lv = liveness(d, now)
  if (lv !== 'live') bad(`delegation is ${lv}`)
  if (d.delegatorUserId === d.delegateUserId) bad('self-delegation')
  if (d.actions.length === 0) bad('delegation names no actions')
  if (d.expiresAt === null) bad('delegation has no term')
  return { effective: reasons.length === 0, reasons }
}

// ── Restrictions ──────────────────────────────────────────────────────────

export function activeRecusal(
  recusals: readonly Recusal[],
  userId: string,
  resource: ResourceRef,
  orgId: string,
): Recusal | null {
  return (
    recusals.find(
      (r) =>
        r.organizationId === orgId &&
        r.principalUserId === userId &&
        r.resource.type === resource.type &&
        r.resource.id === resource.id &&
        r.liftedAt === null,
    ) ?? null
  )
}

// ── Decision construction ─────────────────────────────────────────────────

export interface DecisionInput {
  req: AuthorityRequest
  now: Date
  effect: 'allow' | 'deny'
  reasons: readonly Reason[]
  authority?: readonly AuthoritySource[]
  scope?: DecisionScope
  obligations?: readonly Obligation[]
  authorityLineUserId?: string
}

export function build(i: DecisionInput): Decision {
  const allow = i.effect === 'allow'
  const obligations = new Set<Obligation>(i.obligations ?? [])
  // Every allow is auditable; there is no un-audited path.
  if (allow) obligations.add('audit_required')
  return {
    effect: i.effect,
    action: i.req.action,
    principalUserId: i.req.principalUserId,
    organizationId: i.req.organizationId,
    resource: i.req.resource,
    scope: allow ? (i.scope ?? {}) : {},
    authority: allow ? (i.authority ?? []) : [],
    reasons: i.reasons,
    obligations: [...obligations],
    authorityLineUserId: i.authorityLineUserId ?? i.req.principalUserId,
    evaluatedAt: i.now.toISOString(),
    policyVersion: POLICY_VERSION,
  }
}

export const deny = (req: AuthorityRequest, now: Date, ...reasons: Reason[]): Decision =>
  build({ req, now, effect: 'deny', reasons })

export const actionPower = (action: Action): string => action.split(':')[1]

export const instrumentOf = (m: Mandate): string => `${m.sourceInstrument} (mandate ${m.id})`
