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

/** These case powers are inherent in a live primary owner/assignee relationship.
 * An institutional rule may narrow but cannot confer them through a secondary authority source.
 */
export const PRIMARY_CASE_HANDLER_ONLY_ACTIONS: readonly Action[] = [
  'case:disclose_to_member', 'case:export_sealed_evidence', 'case:close',
]

export function hasPrimaryCaseHandlerOnlyPower(powers: readonly string[]): boolean {
  return PRIMARY_CASE_HANDLER_ONLY_ACTIONS.some(action => powers.includes(action) || powers.includes(action.slice('case:'.length)))
}

export interface Live {
  status: string
  effectiveAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
}

export type Liveness = 'live' | 'not_yet_effective' | 'expired' | 'revoked' | 'inconsistent'

export const validInstant = (value: unknown): value is Date =>
  value instanceof Date && Number.isFinite(value.getTime())

export const validStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0 && item === item.trim())

const SCOPE_ARRAY_KEYS = ['unitIds', 'territoryIds', 'resourceIds', 'accountIds'] as const
const SCOPE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** JSON strings have includes()/length too; they must never stand in for explicitly enumerated resource ids. */
export function validMandateScope(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false
  const scope = value as Record<string, unknown>
  if (Object.keys(scope).some(key => key !== 'classificationCeiling' && !SCOPE_ARRAY_KEYS.includes(key as typeof SCOPE_ARRAY_KEYS[number]))) return false
  for (const key of SCOPE_ARRAY_KEYS) {
    if (!Object.hasOwn(scope, key)) { if (scope[key] !== undefined) return false; continue }
    if (scope[key] === undefined) continue
    if (!validStringArray(scope[key]) || !scope[key].every(id => SCOPE_ID.test(id))) return false
  }
  return scope.classificationCeiling === undefined || scope.classificationCeiling === 'standard' || scope.classificationCeiling === 'confidential'
}

/** Set-based callers must not discard a restriction because its purported lift is malformed or future-dated. */
export const ACTIVE_RECUSAL_SQL = `((lifted_at IS NOT NULL AND isfinite(declared_at) AND isfinite(lifted_at)
  AND lifted_at >= declared_at AND lifted_at <= clock_timestamp()
  AND lifted_by IS NOT NULL AND lifted_by <> principal_user_id
  AND length(lifted_by) BETWEEN 1 AND 255 AND lifted_by = btrim(lifted_by)
  AND lifted_by !~ '[[:cntrl:]]') IS NOT TRUE)`

/** Revocation removes an adverse-party restriction only with coherent recorded proposal provenance. */
export const ACTIVE_CASE_RESPONDENT_SQL = `((revoked_at IS NOT NULL AND isfinite(recorded_at) AND isfinite(revoked_at)
  AND revoked_at >= recorded_at AND revoked_at <= clock_timestamp() AND revoked_proposal_id IS NOT NULL
  AND revoked_by IS NOT NULL AND length(revoked_by) BETWEEN 1 AND 255 AND revoked_by=btrim(revoked_by)
  AND revoked_by !~ '[[:cntrl:]]') IS NOT TRUE)`

/**
 * Time is authoritative over the status column: a row marked active but past
 * its expiry is expired; a revokedAt in the past is revoked whatever `status`
 * says. A row that claims active while carrying a revocation, or whose window
 * is inverted, is inconsistent and never live.
 */
export function liveness(row: Live, now: Date): Liveness {
  // Invalid Date comparisons otherwise evaluate false and can turn malformed authority into a live grant.
  if (!validInstant(now) || !validInstant(row.effectiveAt) ||
      (row.expiresAt !== null && !validInstant(row.expiresAt)) ||
      (row.revokedAt !== null && !validInstant(row.revokedAt))) return 'inconsistent'
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
  if (!validMandateScope(m.scope) || !validStringArray(m.powers)) {
    bad('mandate scope or power list is malformed')
    return { effective: false, reasons }
  }
  const lv = liveness(m, now)
  if (lv === 'inconsistent') bad('status, window and revocation are contradictory')
  else if (lv !== 'live') {
    reasons.push({ code: 'INSTRUMENT_EXPIRED_OR_REVOKED', detail: lv, ref: m.id })
  }
  if (!m.sourceInstrument || m.sourceInstrument.trim() === '') bad('no source instrument recorded')
  if (m.acceptedAt != null && (!validInstant(m.acceptedAt) || !validInstant(now) || m.acceptedAt.getTime() > now.getTime())) {
    bad('acceptance timestamp is invalid or in the future')
  }
  if (m.requiresAcceptance === true && !(validInstant(m.acceptedAt) && validInstant(now) && m.acceptedAt.getTime() <= now.getTime())) {
    reasons.push({ code: 'NOT_ACCEPTED', detail: 'the holder has not accepted this mandate', ref: m.id })
  }
  if (m.powers.length === 0) bad('no powers granted')
  if (m.grantedBy === m.principalUserId) bad('self-granted mandate')
  // Every mandate is time-bound; renewal is an affirmative act.
  if (m.expiresAt === null) bad('mandate has no expiry')

  if (m.kind === 'supervisory') {
    const s = m.scope
    const bounded = (s.unitIds?.length ?? 0) + (s.territoryIds?.length ?? 0) + (s.resourceIds?.length ?? 0) > 0
    if (!bounded) bad('supervisory mandate has no unit, territory or resource scope')
    if (m.powers.includes('read_privileged')) bad('supervisory mandates cannot reach privileged matters')
    if (hasPrimaryCaseHandlerOnlyPower(m.powers)) bad('supervisory mandates cannot carry primary case-handler-only powers')
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
  if (!validStringArray(d.actions) || !validStringArray(d.resourceTypes)) {
    bad('delegation action or resource-type list is malformed')
    return { effective: false, reasons }
  }
  const lv = liveness(d, now)
  if (lv !== 'live') bad(`delegation is ${lv}`)
  if (d.delegatorUserId === d.delegateUserId) bad('self-delegation')
  if (d.actions.length === 0) bad('delegation names no actions')
  if (d.expiresAt === null) bad('delegation has no term')
  if (d.acceptedAt != null && (!validInstant(d.acceptedAt) || !validInstant(now) || d.acceptedAt.getTime() > now.getTime())) {
    bad('acceptance timestamp is invalid or in the future')
  }
  if (d.requiresAcceptance === true && !(validInstant(d.acceptedAt) && validInstant(now) && d.acceptedAt.getTime() <= now.getTime())) {
    reasons.push({ code: 'NOT_ACCEPTED', detail: 'the delegate has not accepted this delegation', ref: d.id })
  }
  return { effective: reasons.length === 0, reasons }
}

/**
 * Appointment-only capacities are earned by a LIVE mandate, never by a role
 * label. They remain eligibility only: the mandate is still what grants access.
 */
export function withAppointmentCapacities(
  memberships: readonly Membership[],
  mandates: readonly Mandate[],
  me: string,
  org: string,
  now: Date,
): Membership[] {
  const earned = new Set<Capacity>()
  for (const m of mandates) {
    if (m.principalUserId !== me || !assessMandate(m, org, now).effective) continue
    if (m.kind === 'financial' && m.powers.includes('audit')) earned.add('auditor')
    if (m.kind === 'governance_review') earned.add('governance_reviewer')
  }
  if (earned.size === 0) return [...memberships]
  return memberships.map((mem) =>
    mem.userId === me && mem.organizationId === org
      ? { ...mem, capacities: [...new Set<Capacity>([...mem.capacities, ...earned])] }
      : mem,
  )
}

// ── Restrictions ──────────────────────────────────────────────────────────

export function activeRecusal(
  recusals: readonly Recusal[],
  userId: string,
  resource: ResourceRef,
  orgId: string,
  now: Date,
): Recusal | null {
  return (
    recusals.find(
      (r) =>
        r.organizationId === orgId &&
        r.principalUserId === userId &&
        r.resource.type === resource.type &&
        r.resource.id === resource.id &&
        // Restrictions remain in force until a coherent, independent lift has actually taken effect.
        !(validInstant(now) && validInstant(r.declaredAt) && validInstant(r.liftedAt) &&
          r.liftedAt.getTime() >= r.declaredAt.getTime() && r.liftedAt.getTime() <= now.getTime() &&
          typeof r.liftedBy === 'string' && r.liftedBy.length >= 1 && r.liftedBy.length <= 255 &&
          r.liftedBy === r.liftedBy.trim() && !/[\u0000-\u001f\u007f]/.test(r.liftedBy) &&
          r.liftedBy !== r.principalUserId),
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
  const clockValid = validInstant(i.now)
  const allow = i.effect === 'allow' && clockValid
  const obligations = new Set<Obligation>(i.obligations ?? [])
  // Every allow is auditable; there is no un-audited path.
  if (allow) obligations.add('audit_required')
  return {
    effect: allow ? 'allow' : 'deny',
    action: i.req.action,
    principalUserId: i.req.principalUserId,
    organizationId: i.req.organizationId,
    resource: i.req.resource,
    scope: allow ? (i.scope ?? {}) : {},
    authority: allow ? (i.authority ?? []) : [],
    reasons: clockValid ? i.reasons : [{ code: 'FACTS_CONTRADICTORY', detail: 'evaluation clock is invalid' }],
    obligations: [...obligations],
    authorityLineUserId: i.authorityLineUserId ?? i.req.principalUserId,
    // An explicit invalid marker cannot be mistaken for timestamped qualification evidence.
    evaluatedAt: clockValid ? i.now.toISOString() : 'INVALID_CLOCK',
    policyVersion: POLICY_VERSION,
  }
}

export const deny = (req: AuthorityRequest, now: Date, ...reasons: Reason[]): Decision =>
  build({ req, now, effect: 'deny', reasons })

export const actionPower = (action: Action): string => action.split(':')[1]

export const instrumentOf = (m: Mandate): string => `${m.sourceInstrument} (mandate ${m.id})`
