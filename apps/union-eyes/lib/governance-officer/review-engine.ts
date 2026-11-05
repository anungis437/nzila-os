/**
 * Governance Officer 2.1 — independent review engine (domain core).
 *
 * UE-GOVERNANCE-OFFICER-CANONICAL-2.1: the five oversight powers are
 * independent; none follows from another, from a role label, from seniority
 * or from a software entitlement. Every protected action is decided from an
 * explicit, current, resource-specific grant plus independence checks.
 *
 * This module is a pure, side-effect-free decision/state core. It is TEST_PROVEN
 * only: it has no persistence, no HTTP surface and no UI binding yet, so it
 * does not make any capability OPERATIONAL.
 */

export type OversightPower =
  | 'monitor' //                   1. oversee / see that a review exists
  | 'evidence_access' //           2. obtain specific evidence
  | 'issue_finding' //             3. investigate and issue findings
  | 'request_corrective_action' // 4. require / recommend / refer corrective action
  | 'enforce_certify' //           5. enforce or certify a binding outcome

export const OVERSIGHT_POWERS: readonly OversightPower[] = [
  'monitor',
  'evidence_access',
  'issue_finding',
  'request_corrective_action',
  'enforce_certify',
]

export type Classification = 'internal' | 'confidential' | 'restricted' | 'privileged'
const CLASS_RANK: Record<Classification, number> = { internal: 0, confidential: 1, restricted: 2, privileged: 3 }

export interface OversightGrant {
  id: string
  reviewerId: string
  institutionId: string
  power: OversightPower
  /** Instrument that confers the mandate (constitution clause, resolution, appointment letter). */
  source: { kind: 'constitution' | 'bylaw' | 'resolution' | 'appointment'; reference: string }
  purpose: string
  /** A grant is bound to one review; it is never a blanket grant. */
  reviewId: string
  /** Highest classification this grant may reach. Privileged needs an explicit grant. */
  classificationCeiling: Classification
  validFrom: Date
  validUntil: Date
  revokedAt?: Date | null
}

export interface ReviewParties {
  complainantId?: string | null
  /** Persons/offices the complaint is about; they are conflicted by definition. */
  respondentIds: readonly string[]
  /** Anyone else with a declared interest or recusal. */
  recusedIds: readonly string[]
}

export type Denial = { allowed: false; code: string; reason: string }
export type Allow = { allowed: true; grantId?: string }
export type Verdict = Allow | Denial

const deny = (code: string, reason: string): Denial => ({ allowed: false, code, reason })

export class GovernanceDenied extends Error {
  constructor(public readonly denial: Denial) {
    super(`${denial.code}: ${denial.reason}`)
    this.name = 'GovernanceDenied'
  }
}

export function isConflicted(actorId: string, parties: ReviewParties): boolean {
  return (
    parties.respondentIds.includes(actorId) ||
    parties.recusedIds.includes(actorId) ||
    (parties.complainantId != null && parties.complainantId === actorId)
  )
}

export interface AuthorizeInput {
  actorId: string
  institutionId: string
  reviewId: string
  power: OversightPower
  classification?: Classification
  parties: ReviewParties
  grants: readonly OversightGrant[]
  now: Date
}

/** The single decision point: explicit grant + independence, never a role. */
export function authorizeOversight(input: AuthorizeInput): Verdict {
  const { actorId, institutionId, reviewId, power, parties, grants, now } = input
  if (isConflicted(actorId, parties)) {
    return deny('CONFLICTED', 'Actor is a respondent, complainant or recused party for this review.')
  }
  const need = CLASS_RANK[input.classification ?? 'internal']
  const mine = grants.filter((g) => g.reviewerId === actorId && g.power === power)
  if (mine.length === 0) return deny('NO_GRANT', `No ${power} grant held by actor.`)

  const live = mine.filter(
    (g) =>
      g.institutionId === institutionId &&
      g.reviewId === reviewId &&
      !g.revokedAt &&
      g.validFrom <= now &&
      now < g.validUntil,
  )
  if (live.length === 0) {
    const stale = mine.some((g) => g.reviewId === reviewId && g.institutionId === institutionId)
    return deny(stale ? 'GRANT_EXPIRED_OR_REVOKED' : 'WRONG_RESOURCE_OR_INSTITUTION', 'No current grant covers this institution and review.')
  }
  const covering = live.find((g) => CLASS_RANK[g.classificationCeiling] >= need)
  if (!covering) return deny('CLASSIFICATION_EXCEEDS_GRANT', 'Information classification exceeds the grant ceiling.')
  return { allowed: true, grantId: covering.id }
}

// ── Review lifecycle ────────────────────────────────────────────────────────

export type ReviewStage =
  | 'received'
  | 'jurisdiction_assessed'
  | 'independence_assessed'
  | 'assigned'
  | 'evidence_gathering'
  | 'finding_recorded'
  | 'decision_issued'
  | 'corrective_action_assigned'
  | 'action_reported_complete'
  | 'verified_effective'
  | 'closed'
  | 'reopened'

export type FindingKind = 'allegation' | 'assessment' | 'finding' | 'recommendation' | 'binding_decision'

export type ActionStatus = 'requested' | 'in_progress' | 'reported_complete' | 'verified_effective' | 'rejected_needs_more_work'

export interface EvidenceRequest {
  id: string
  holderId: string
  description: string
  classification: Classification
  status: 'requested' | 'provided' | 'denied'
  denialReason?: string
}

export interface FindingRecord {
  id: string
  kind: FindingKind
  authorId: string
  rationale: string
  sourceRefs: readonly string[]
  limitations: string
}

export interface CorrectiveAction {
  id: string
  responsibleId: string
  requestedOutcome: string
  requestedBy: string
  status: ActionStatus
  evidenceRefs: readonly string[]
  verifiedBy?: string
}

export interface ReviewEvent {
  at: Date
  actorId: string
  type: string
  detail?: string
}

export interface ReviewCase {
  id: string
  institutionId: string
  stage: ReviewStage
  parties: ReviewParties
  /** Protected allegation: respondents never see it unless released. */
  allegationReleasedToRespondent: boolean
  assigneeId: string | null
  evidence: readonly EvidenceRequest[]
  findings: readonly FindingRecord[]
  actions: readonly CorrectiveAction[]
  history: readonly ReviewEvent[]
}

export interface Ctx {
  grants: readonly OversightGrant[]
  now: Date
}

const log = (c: ReviewCase, actorId: string, type: string, now: Date, detail?: string): ReviewCase['history'] => [
  ...c.history,
  { at: now, actorId, type, detail },
]

function must(c: ReviewCase, ctx: Ctx, actorId: string, power: OversightPower, classification?: Classification) {
  const v = authorizeOversight({
    actorId,
    institutionId: c.institutionId,
    reviewId: c.id,
    power,
    classification,
    parties: c.parties,
    grants: ctx.grants,
    now: ctx.now,
  })
  if (!v.allowed) throw new GovernanceDenied(v)
}

function requireStage(c: ReviewCase, allowed: readonly ReviewStage[]) {
  if (!allowed.includes(c.stage)) {
    throw new GovernanceDenied(deny('INVALID_STAGE', `Stage '${c.stage}' does not permit this step.`))
  }
}

/** GV02 — intake binds the submitting principal and institution. */
export function receiveConcern(args: {
  id: string
  institutionId: string
  submitterId: string
  respondentIds: readonly string[]
  now: Date
}): ReviewCase {
  return {
    id: args.id,
    institutionId: args.institutionId,
    stage: 'received',
    parties: { complainantId: args.submitterId, respondentIds: args.respondentIds, recusedIds: [] },
    allegationReleasedToRespondent: false,
    assigneeId: null,
    evidence: [],
    findings: [],
    actions: [],
    history: [{ at: args.now, actorId: args.submitterId, type: 'concern_received' }],
  }
}

export function assessJurisdiction(c: ReviewCase, actorId: string, ctx: Ctx): ReviewCase {
  requireStage(c, ['received'])
  must(c, ctx, actorId, 'monitor')
  return { ...c, stage: 'jurisdiction_assessed', history: log(c, actorId, 'jurisdiction_assessed', ctx.now) }
}

export function assessIndependence(c: ReviewCase, actorId: string, ctx: Ctx): ReviewCase {
  requireStage(c, ['jurisdiction_assessed'])
  must(c, ctx, actorId, 'monitor')
  return { ...c, stage: 'independence_assessed', history: log(c, actorId, 'independence_assessed', ctx.now) }
}

/**
 * GV03 — assignment. The assigner and the assignee must both be independent of
 * the matter; a conflicted officer cannot assign it to themselves or to an ally
 * by virtue of holding an executive role.
 */
export function assignReviewer(c: ReviewCase, assignerId: string, assigneeId: string, ctx: Ctx): ReviewCase {
  requireStage(c, ['independence_assessed', 'assigned', 'evidence_gathering'])
  if (isConflicted(assignerId, c.parties)) {
    throw new GovernanceDenied(deny('CONFLICTED_ASSIGNER', 'A conflicted party cannot assign the reviewer.'))
  }
  must(c, ctx, assignerId, 'monitor')
  if (isConflicted(assigneeId, c.parties)) {
    throw new GovernanceDenied(deny('CONFLICTED_ASSIGNEE', 'The proposed reviewer is conflicted.'))
  }
  // The assignee must already hold their own current grants; assignment confers none.
  must(c, ctx, assigneeId, 'issue_finding')
  return { ...c, stage: 'assigned', assigneeId, history: log(c, assignerId, 'reviewer_assigned', ctx.now, assigneeId) }
}

/** GV04 — evidence request is a recorded state, including denial. */
export function requestEvidence(
  c: ReviewCase,
  reviewerId: string,
  req: Omit<EvidenceRequest, 'status' | 'denialReason'>,
  ctx: Ctx,
): ReviewCase {
  requireStage(c, ['assigned', 'evidence_gathering'])
  if (c.assigneeId !== reviewerId) throw new GovernanceDenied(deny('NOT_ASSIGNED', 'Only the assigned reviewer may request evidence.'))
  const v = authorizeOversight({
    actorId: reviewerId,
    institutionId: c.institutionId,
    reviewId: c.id,
    power: 'evidence_access',
    classification: req.classification,
    parties: c.parties,
    grants: ctx.grants,
    now: ctx.now,
  })
  const record: EvidenceRequest = v.allowed
    ? { ...req, status: 'requested' }
    : { ...req, status: 'denied', denialReason: v.code }
  return {
    ...c,
    stage: 'evidence_gathering',
    evidence: [...c.evidence, record],
    history: log(c, reviewerId, v.allowed ? 'evidence_requested' : 'evidence_denied', ctx.now, req.id),
  }
}

/** Reviewers may read evidence; they may never alter source evidence. */
export function assertEvidenceNotModifiable(): never {
  throw new GovernanceDenied(deny('EVIDENCE_IMMUTABLE_TO_REVIEWER', 'Review access is separate from modification rights.'))
}

/** GV05 — allegation, assessment, finding, recommendation and binding decision are distinct. */
export function recordFinding(
  c: ReviewCase,
  reviewerId: string,
  f: Omit<FindingRecord, 'authorId'>,
  ctx: Ctx,
): ReviewCase {
  requireStage(c, ['evidence_gathering', 'finding_recorded'])
  if (c.assigneeId !== reviewerId) throw new GovernanceDenied(deny('NOT_ASSIGNED', 'Only the assigned reviewer may record findings.'))
  if (f.kind === 'binding_decision') {
    throw new GovernanceDenied(deny('USE_ISSUE_DECISION', 'A finding is not a binding decision; use issueBindingDecision.'))
  }
  must(c, ctx, reviewerId, 'issue_finding')
  if (f.kind !== 'allegation' && (f.sourceRefs.length === 0 || f.limitations.trim() === '')) {
    throw new GovernanceDenied(deny('UNSUPPORTED_FINDING', 'Findings need source references and stated limitations.'))
  }
  return {
    ...c,
    stage: 'finding_recorded',
    findings: [...c.findings, { ...f, authorId: reviewerId }],
    history: log(c, reviewerId, `${f.kind}_recorded`, ctx.now, f.id),
  }
}

/** Binding outcomes need the separate fifth power; findings never convert automatically. */
export function issueBindingDecision(
  c: ReviewCase,
  deciderId: string,
  f: Omit<FindingRecord, 'authorId' | 'kind'>,
  ctx: Ctx,
): ReviewCase {
  requireStage(c, ['finding_recorded'])
  must(c, ctx, deciderId, 'enforce_certify')
  return {
    ...c,
    stage: 'decision_issued',
    findings: [...c.findings, { ...f, kind: 'binding_decision', authorId: deciderId }],
    history: log(c, deciderId, 'binding_decision_issued', ctx.now, f.id),
  }
}

/** GV06 — remediation is requested of the responsible authority; the reviewer gains no operational authority. */
export function requestCorrectiveAction(
  c: ReviewCase,
  reviewerId: string,
  a: { id: string; responsibleId: string; requestedOutcome: string },
  ctx: Ctx,
): ReviewCase {
  requireStage(c, ['finding_recorded', 'decision_issued', 'corrective_action_assigned'])
  must(c, ctx, reviewerId, 'request_corrective_action')
  if (a.responsibleId === reviewerId) {
    throw new GovernanceDenied(deny('REVIEWER_CANNOT_OWN_ACTION', 'The reviewer cannot be the responsible actor.'))
  }
  return {
    ...c,
    stage: 'corrective_action_assigned',
    actions: [...c.actions, { ...a, requestedBy: reviewerId, status: 'requested', evidenceRefs: [] }],
    history: log(c, reviewerId, 'corrective_action_requested', ctx.now, a.id),
  }
}

/** GV07 — owner reports; this is not verification. */
export function reportActionComplete(
  c: ReviewCase,
  ownerId: string,
  actionId: string,
  evidenceRefs: readonly string[],
  ctx: Ctx,
): ReviewCase {
  const action = c.actions.find((x) => x.id === actionId)
  if (!action || action.responsibleId !== ownerId) {
    throw new GovernanceDenied(deny('NOT_RESPONSIBLE_ACTOR', 'Only the designated responsible actor may report completion.'))
  }
  if (evidenceRefs.length === 0) {
    throw new GovernanceDenied(deny('EVIDENCE_REQUIRED', 'Completion must be evidenced.'))
  }
  return {
    ...c,
    stage: 'action_reported_complete',
    actions: c.actions.map((x) => (x.id === actionId ? { ...x, status: 'reported_complete', evidenceRefs } : x)),
    history: log(c, ownerId, 'action_reported_complete', ctx.now, actionId),
  }
}

/** Independent verification: never by the owner, never by a conflicted party. */
export function verifyAction(
  c: ReviewCase,
  verifierId: string,
  actionId: string,
  outcome: 'effective' | 'needs_more_work',
  ctx: Ctx,
): ReviewCase {
  const action = c.actions.find((x) => x.id === actionId)
  if (!action || action.status !== 'reported_complete') {
    throw new GovernanceDenied(deny('NOTHING_TO_VERIFY', 'No completed action awaits verification.'))
  }
  if (verifierId === action.responsibleId) {
    throw new GovernanceDenied(deny('SELF_CERTIFICATION', 'An owner cannot certify their own remediation.'))
  }
  must(c, ctx, verifierId, 'request_corrective_action')
  const status: ActionStatus = outcome === 'effective' ? 'verified_effective' : 'rejected_needs_more_work'
  const actions = c.actions.map((x) => (x.id === actionId ? { ...x, status, verifiedBy: verifierId } : x))
  return {
    ...c,
    stage: outcome === 'effective' ? 'verified_effective' : 'corrective_action_assigned',
    actions,
    history: log(c, verifierId, `action_${status}`, ctx.now, actionId),
  }
}

/** A completed task never closes the matter; every action must be independently verified. */
export function closeReview(c: ReviewCase, actorId: string, ctx: Ctx): ReviewCase {
  requireStage(c, ['verified_effective', 'finding_recorded', 'decision_issued'])
  must(c, ctx, actorId, 'issue_finding')
  const unverified = c.actions.some((a) => a.status !== 'verified_effective')
  if (unverified) throw new GovernanceDenied(deny('UNVERIFIED_ACTIONS', 'Open or unverified corrective actions remain.'))
  return { ...c, stage: 'closed', history: log(c, actorId, 'closed', ctx.now) }
}

// ── Visibility, departure and succession ───────────────────────────────────

/**
 * Who may see the protected allegation. Respondents and recused parties do not,
 * regardless of executive role, until the matter is deliberately released.
 */
export function canViewAllegation(c: ReviewCase, viewerId: string, ctx: Ctx): boolean {
  if (c.parties.complainantId === viewerId) return true
  if (c.parties.respondentIds.includes(viewerId)) return c.allegationReleasedToRespondent
  if (c.parties.recusedIds.includes(viewerId)) return false
  return authorizeOversight({
    actorId: viewerId,
    institutionId: c.institutionId,
    reviewId: c.id,
    power: 'monitor',
    parties: c.parties,
    grants: ctx.grants,
    now: ctx.now,
  }).allowed
}

/** GV08 — departure revokes the reviewer's grants; history and obligations remain. */
export function revokeReviewerAccess(
  grants: readonly OversightGrant[],
  reviewerId: string,
  now: Date,
): OversightGrant[] {
  return grants.map((g) => (g.reviewerId === reviewerId && !g.revokedAt ? { ...g, revokedAt: now } : g))
}

/** The successor inherits the open matter, never the predecessor's credentials. */
export function reassignAfterDeparture(c: ReviewCase, departedId: string, successorId: string, ctx: Ctx): ReviewCase {
  if (c.assigneeId !== departedId) throw new GovernanceDenied(deny('NOT_ASSIGNED', 'Departed reviewer is not the assignee.'))
  if (isConflicted(successorId, c.parties)) throw new GovernanceDenied(deny('CONFLICTED_ASSIGNEE', 'The successor is conflicted.'))
  must(c, ctx, successorId, 'issue_finding')
  return { ...c, assigneeId: successorId, history: log(c, successorId, 'reviewer_succession', ctx.now, departedId) }
}

/** Evidence packages may include only what the requester is entitled to receive. */
export function filterExportableEvidence(
  c: ReviewCase,
  requesterId: string,
  ctx: Ctx,
): EvidenceRequest[] {
  return c.evidence.filter(
    (e) =>
      e.status === 'provided' &&
      authorizeOversight({
        actorId: requesterId,
        institutionId: c.institutionId,
        reviewId: c.id,
        power: 'evidence_access',
        classification: e.classification,
        parties: c.parties,
        grants: ctx.grants,
        now: ctx.now,
      }).allowed,
  )
}
