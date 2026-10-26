import type { AuditEventId, ClaimId, DecisionId, DependencyId, DocumentId, MatterGrantId, MatterId, MemberId, ObjectionId, OrganizationId, ReferralId, RepresentationAuthorizationId, SubmissionId, UserId } from './ids.ts';
import { asAuditEventId, asReminderId, asTaskId } from './ids.ts';
import type { Principal, Role } from './principal.ts';
import { hasAnyRole, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';
import type { Decision, DocumentArtifact, DocumentDisclosureGrant, DataClass, Matter, MatterAccessGrant, MatterPermission, RepresentationAuthorization, AuthorizationType, Audience, DocumentAction } from './authorization.ts';
import { authorizeDocumentAccess, authorizeProfessionalAction, authorizeSpecialistMatterAccess, buildNotification, evaluateReleaseEligibility, liftRestrictionHold, placeRestrictionHold } from './authorization.ts';
import type { Notification } from './authorization.ts';
import { applyReferralEvent, newReferral } from './referral.ts';
import type { PolicyDecisionsPending, Referral, ReferralEvent, ReferralPacket } from './referral.ts';
import { addClaim, addDecision, createObjection, emptyGraph, planObjectionGroups, selectClaimReferencesForSubmission, validateWorkContext } from './claims.ts';
import type { ClaimGraph, CreateObjectionInput, GroupingStrategy, WorkContextValidation, WsibClaim, WsibDecision } from './claims.ts';
import { applySubmissionEvent, createSubmission } from './submission.ts';
import type { Submission, SubmissionContext, SubmissionEvent, SubmissionKind } from './submission.ts';
import { determineFilingDefective, determineFilingValid, newFilingRecord, recordAuthorityResponse } from './filing.ts';
import type { ElementAttestation, FilingIntent, FilingRecord, RequirementSource } from './filing.ts';
import { cancelOnMatterClose, claimForDelivery, completeFromReceipt, decideDelivery, generateReceiptFollowUp, isTerminalTask, recordDeliveryOutcome, reassignTask, reminderInstantForDueDate, scheduleReminder, supersedeRemindersOnReassign } from './followup.ts';
import type { DueDateRule, ReceiptFollowUpTask, Reminder, TaskOfRecord } from './followup.ts';
import { confirmDeadline } from './deadlines.ts';
import type { DeadlineObligation, RuleSource } from './deadlines.ts';
import { openDependency, recordBatch } from './dependency.ts';
import type { DependencyKind, ExternalDependency } from './dependency.ts';
import { publishMemberStatus, withdrawPublication } from './publication.ts';
import type { MemberPublication, MemberStage, PublicationEvidence } from './publication.ts';
import { revokeAuthorization } from './revocation.ts';
import { reconcileTaskStates } from './clio.ts';
import type { TaskSnapshot } from './clio.ts';
import { assessUpload } from './upload.ts';
import type { UploadAssessment } from './upload.ts';
import { buildAuditEvent } from './audit.ts';
import type { AuditEvent } from './audit.ts';
import { mayPrepareTribunalSubmission, openAssessmentIfIndicated, recordAssessment } from './tribunal.ts';
import type { AroOutcome, AssessmentStatus, TribunalAssessment } from './tribunal.ts';

/**
 * A deterministic, in-memory, synthetic "world" that composes the v0.2/v0.3
 * contracts so the four persona journeys can be executed end to end. It is
 * NOT an application: no I/O, no persistence, no delivery. Every operation:
 *   1. resolves the target without disclosing existence to outsiders,
 *   2. authorizes from the Principal (never from arguments),
 *   3. changes state only through the underlying contract, and
 *   4. appends a code-only audit event to the owning tenant's trail.
 * A denied operation returns an error and changes nothing; `recordDenial`
 * logs it on the ACTOR's own organization trail, never the target's.
 */
export interface WorldPolicy {
  readonly referral: PolicyDecisionsPending;
  readonly submission: SubmissionContext['policy'];
  readonly holdLiftRoles: readonly Role[];
  readonly releaseRoles: readonly Role[];
  readonly tribunalRoles: readonly Role[];
  readonly groupingStrategy: GroupingStrategy | null;
  /** D-02: UNRESOLVED until Domenic decides. */
  readonly taskOfRecord: TaskOfRecord;
  /** D-01: null until decided. */
  readonly dueRule: DueDateRule | null;
  readonly ruleRegistry: readonly RuleSource[];
  readonly requirementSources: readonly RequirementSource[];
  readonly bilingualRequired: boolean;
  readonly matterTimeZone: string;
}

export interface MemberRecord {
  readonly id: MemberId;
  readonly organizationId: OrganizationId;
  readonly displayName: string;
  readonly birthYear: number;
  readonly identity: 'VERIFIED_DISTINCT' | 'DUPLICATE_REVIEW_PENDING' | 'SUPERSEDED';
  readonly supersededBy: MemberId | null;
}

export interface InfoRequest {
  readonly id: string;
  readonly matterId: MatterId;
  readonly memberId: MemberId;
  readonly addressedTo: 'MEMBER' | 'UNION';
  /** A short code; free text is never stored in a request. */
  readonly code: string;
  readonly status: 'OPEN' | 'SUPPLIED_PENDING_REVIEW' | 'ACCEPTED';
  readonly documentId: DocumentId | null;
}

export interface DeniedAttempt {
  readonly organizationId: OrganizationId;
  readonly actor: string;
  readonly operation: string;
  readonly code: string;
  readonly at: string;
}

export interface OutboxEntry {
  readonly to: UserId;
  readonly reminderId: string;
  readonly notification: Notification;
  /** The sink is synthetic: nothing is ever sent. */
  readonly sent: false;
}

export interface World {
  readonly now: string;
  readonly seq: number;
  readonly policy: WorldPolicy;
  /** Server-side identity directory (resolved principals). Never client-supplied. */
  readonly users: readonly Principal[];
  readonly members: readonly MemberRecord[];
  readonly referrals: readonly Referral[];
  readonly matters: readonly Matter[];
  readonly authorizations: readonly RepresentationAuthorization[];
  readonly matterGrants: readonly MatterAccessGrant[];
  readonly documents: readonly DocumentArtifact[];
  readonly uploads: Readonly<Record<string, UploadAssessment>>;
  readonly disclosureGrants: readonly DocumentDisclosureGrant[];
  readonly graph: ClaimGraph;
  readonly workContexts: readonly WorkContextValidation[];
  readonly submissions: readonly Submission[];
  readonly filings: readonly FilingRecord[];
  readonly gates: Readonly<Record<string, { arfReady?: boolean; noaReady?: boolean; by: UserId }>>;
  readonly tasks: readonly ReceiptFollowUpTask[];
  readonly reminders: readonly Reminder[];
  readonly dependencies: readonly ExternalDependency[];
  readonly obligations: readonly DeadlineObligation[];
  readonly publications: readonly MemberPublication[];
  readonly infoRequests: readonly InfoRequest[];
  readonly assessments: readonly TribunalAssessment[];
  readonly clio: readonly TaskSnapshot[];
  readonly reconciliation: readonly { readonly submissionKey: string; readonly reason: string }[];
  readonly outbox: readonly OutboxEntry[];
  readonly sessionInvalidations: readonly { readonly userId: UserId; readonly matterId: MatterId }[];
  readonly revocationEpoch: number;
  readonly audit: readonly AuditEvent[];
  readonly denied: readonly DeniedAttempt[];
}

export type JResult<T = World> = Result<T, string>;
const deny = (code: string, message = code): JResult<never> => err(code, message);
const notFound = () => deny('NOT_FOUND', 'not found');

export function emptyWorld(policy: WorldPolicy, users: readonly Principal[], now: string, org: OrganizationId): World {
  return {
    now,
    seq: 0,
    policy,
    users,
    members: [],
    referrals: [],
    matters: [],
    authorizations: [],
    matterGrants: [],
    documents: [],
    uploads: {},
    disclosureGrants: [],
    graph: emptyGraph(org),
    workContexts: [],
    submissions: [],
    filings: [],
    gates: {},
    tasks: [],
    reminders: [],
    dependencies: [],
    obligations: [],
    publications: [],
    infoRequests: [],
    assessments: [],
    clio: [],
    reconciliation: [],
    outbox: [],
    sessionInvalidations: [],
    revocationEpoch: 0,
    audit: [],
    denied: [],
  };
}

export const tick = (w: World, iso: string): World => ({ ...w, now: iso });

/* ---------------- shared helpers ---------------- */

type Meta = { matterId?: MatterId | null; claimId?: ClaimId | null; organizationId?: OrganizationId; details?: Record<string, string | number | boolean | null> };

function commit(w: World, p: Principal | null, action: string, patch: Partial<World>, meta: Meta = {}): World {
  const seq = w.seq + 1;
  const owner = meta.organizationId ?? (meta.matterId ? w.matters.find((m) => m.id === meta.matterId)?.ownerOrganizationId : undefined) ?? p?.organizationId;
  if (!owner) throw new Error('audit event needs an owning organization');
  const ev = buildAuditEvent({
    id: asAuditEventId(`AE-${seq}`) as AuditEventId,
    organizationId: owner,
    matterId: meta.matterId ?? null,
    claimId: meta.claimId ?? null,
    actor: p ? p.userId : 'system',
    action,
    at: w.now,
    correlationId: `corr-${seq}`,
    details: meta.details,
  });
  if (!ev.ok) throw new Error(`audit refused: ${ev.code}`);
  return { ...w, ...patch, seq, audit: [...w.audit, ev.value] };
}

/** Logs a refused attempt on the ACTOR's organization trail only. Returns the new world; the caller keeps its own copy of state. */
export function recordDenial(w: World, p: Principal, operation: string, code: string): World {
  return { ...w, denied: [...w.denied, { organizationId: p.organizationId, actor: p.userId, operation, code, at: w.now }] };
}

const nextId = (w: World, prefix: string): [string, World] => [`${prefix}-${w.seq + 1}`, { ...w, seq: w.seq + 1 }];

function lookupMatter(w: World, p: Principal, matterId: MatterId): JResult<Matter> {
  const m = w.matters.find((x) => x.id === matterId);
  if (!m || !p.sessionActive) return notFound();
  return p.organizationId === m.ownerOrganizationId || p.organizationId === m.specialistOrganizationId ? ok(m) : notFound();
}

const grantFor = (w: World, m: Matter, userId: UserId) => w.matterGrants.find((g) => g.matterId === m.id && g.userId === userId) ?? null;

function professional(w: World, p: Principal, m: Matter, action: 'WSIB_REPRESENTATIVE_ACTION' | 'PUBLISH_MEMBER_STATUS' | 'APPROVE_SUBMISSION'): Decision {
  return authorizeProfessionalAction({ principal: p, matter: m, grant: grantFor(w, m, p.userId), authorizations: w.authorizations, action, now: new Date(w.now) });
}

const asErr = (d: Decision): JResult<never> => (d.allow ? deny('INTERNAL') : deny(d.publicOutcome === 'NOT_FOUND' ? 'NOT_FOUND' : d.publicOutcome === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'FORBIDDEN', d.reason));

function requireProfessional(w: World, p: Principal, matterId: MatterId, action: Parameters<typeof professional>[3] = 'APPROVE_SUBMISSION'): JResult<{ matter: Matter; auth: Decision }> {
  const m = lookupMatter(w, p, matterId);
  if (!m.ok) return m;
  const auth = professional(w, p, m.value, action);
  return auth.allow ? ok({ matter: m.value, auth }) : asErr(auth);
}

const replace = <T>(xs: readonly T[], pred: (x: T) => boolean, next: T): T[] => xs.map((x) => (pred(x) ? next : x));
const subCtx = (w: World, p: Principal, m: Matter, sub: Submission): SubmissionContext => ({
  actor: { kind: 'USER', principal: p },
  now: w.now,
  professionalAuth: professional(w, p, m, 'APPROVE_SUBMISSION'),
  representativeAuth: professional(w, p, m, 'WSIB_REPRESENTATIVE_ACTION'),
  policy: w.policy.submission,
  gates: w.gates[sub.id] ?? {},
});

/* =====================================================================
 * Union actions
 * ===================================================================== */

export function registerMember(w: World, p: Principal, input: { memberId: MemberId; displayName: string; birthYear: number }): JResult {
  if (!hasAnyRole(p, ['UNION_REFERRAL_REP', 'UNION_ADMIN'])) return deny('FORBIDDEN');
  if (w.members.some((m) => m.id === input.memberId)) return deny('ALREADY_REGISTERED');
  // Duplicate detection is scoped to the caller's OWN organization: another union's records are never consulted or revealed.
  const dup = w.members.find((m) => m.organizationId === p.organizationId && m.identity !== 'SUPERSEDED' && m.displayName.toLowerCase() === input.displayName.toLowerCase() && m.birthYear === input.birthYear);
  const rec: MemberRecord = { id: input.memberId, organizationId: p.organizationId, displayName: input.displayName, birthYear: input.birthYear, identity: dup ? 'DUPLICATE_REVIEW_PENDING' : 'VERIFIED_DISTINCT', supersededBy: null };
  return ok(commit(w, p, dup ? 'MEMBER_REGISTERED_DUPLICATE_REVIEW' : 'MEMBER_REGISTERED', { members: [...w.members, rec] }, { organizationId: p.organizationId }));
}

/** Only a union administrator resolves a possible duplicate; nothing is merged automatically. */
export function resolveDuplicate(w: World, p: Principal, input: { memberId: MemberId; verdict: 'DISTINCT' | { sameAs: MemberId } }): JResult {
  if (!hasAnyRole(p, ['UNION_ADMIN'])) return deny('FORBIDDEN');
  const m = w.members.find((x) => x.id === input.memberId && x.organizationId === p.organizationId);
  if (!m) return notFound();
  if (m.identity !== 'DUPLICATE_REVIEW_PENDING') return deny('NO_REVIEW_PENDING');
  let next: MemberRecord;
  if (input.verdict === 'DISTINCT') next = { ...m, identity: 'VERIFIED_DISTINCT' };
  else {
    const target = w.members.find((x) => x.id === (input.verdict as { sameAs: MemberId }).sameAs && x.organizationId === p.organizationId);
    if (!target) return notFound();
    next = { ...m, identity: 'SUPERSEDED', supersededBy: target.id };
  }
  return ok(commit(w, p, 'DUPLICATE_RESOLVED', { members: replace(w.members, (x) => x.id === m.id, next) }, { organizationId: p.organizationId, details: { reasonCode: next.identity } }));
}

export function createReferral(w: World, p: Principal, input: { referralId: ReferralId; memberId: MemberId; specialistOrganizationId: OrganizationId }): JResult {
  if (!hasAnyRole(p, ['UNION_REFERRAL_REP', 'UNION_ADMIN'])) return deny('FORBIDDEN');
  const mem = w.members.find((m) => m.id === input.memberId && m.organizationId === p.organizationId);
  if (!mem) return notFound();
  if (mem.identity === 'DUPLICATE_REVIEW_PENDING') return deny('DUPLICATE_REVIEW_REQUIRED', 'a union administrator must resolve the possible duplicate first');
  if (mem.identity === 'SUPERSEDED') return deny('IDENTITY_SUPERSEDED', 'this record was confirmed to be the same person as another');
  if (w.referrals.some((r) => r.id === input.referralId)) return deny('ALREADY_EXISTS');
  const r = newReferral({ id: input.referralId, organizationId: p.organizationId, specialistOrganizationId: input.specialistOrganizationId, memberId: input.memberId });
  return ok(commit(w, p, 'REFERRAL_CREATED', { referrals: [...w.referrals, r] }, { organizationId: p.organizationId }));
}

/** All referral lifecycle changes. The contract decides who may do what; this adds matter creation and acceptance. */
export function referralEvent(w: World, p: Principal, referralId: ReferralId, event: ReferralEvent): JResult {
  const r = w.referrals.find((x) => x.id === referralId);
  if (!r) return notFound();
  const res = applyReferralEvent(r, event, { principal: p, now: w.now, policy: w.policy.referral });
  if (!res.ok) return deny(res.code, res.message);
  let next = replace(w.referrals, (x) => x.id === r.id, res.value);
  let matters = w.matters;
  const mid = (`M-${r.id}` as unknown) as MatterId;
  if (event.type === 'OFFER' && !matters.some((m) => m.id === mid)) {
    matters = [...matters, { id: mid, ownerOrganizationId: r.organizationId, specialistOrganizationId: r.specialistOrganizationId, memberId: r.memberId, assignedSpecialists: [], status: 'OPEN', acceptance: null }];
  }
  if (event.type === 'ACCEPT') {
    matters = replace(matters, (m) => m.id === mid, { ...matters.find((m) => m.id === mid)!, acceptance: res.value.acceptance });
  }
  return ok(commit(w, p, `REFERRAL_${event.type}`, { referrals: next, matters }, { organizationId: r.organizationId, matterId: matters.find((m) => m.id === mid)?.id ?? null, details: { fromState: r.state, toState: res.value.state } }));
}

export const matterIdForReferral = (referralId: ReferralId): MatterId => (`M-${referralId}` as unknown) as MatterId;

/** The union (or a professional with matter access) declares claims and decisions it holds. Union side only before acceptance. */
export function declareClaim(w: World, p: Principal, input: { matterId: MatterId; claim: WsibClaim }): JResult {
  const m = lookupMatter(w, p, input.matterId);
  if (!m.ok) return m;
  const unionSide = hasAnyRole(p, ['UNION_REFERRAL_REP', 'UNION_ADMIN']) && p.organizationId === m.value.ownerOrganizationId && m.value.acceptance === null;
  const specialistSide = hasAnyRole(p, WORKAID_ROLES) && authorizeSpecialistMatterAccess({ principal: p, matter: m.value, grant: grantFor(w, m.value, p.userId), permission: 'VIEW', now: new Date(w.now) }).allow;
  if (!unionSide && !specialistSide) return deny('FORBIDDEN');
  if (input.claim.memberId !== m.value.memberId) return deny('WRONG_MEMBER');
  const res = addClaim(w.graph, input.claim);
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'CLAIM_DECLARED', { graph: res.value.graph }, { matterId: m.value.id, claimId: res.value.claim.id }));
}

export function declareDecision(w: World, p: Principal, input: { matterId: MatterId; decision: WsibDecision }): JResult {
  const m = lookupMatter(w, p, input.matterId);
  if (!m.ok) return m;
  const claim = w.graph.claims.find((c) => c.id === input.decision.claimId);
  if (!claim || claim.memberId !== m.value.memberId) return deny('NO_SUCH_CLAIM');
  const unionSide = hasAnyRole(p, ['UNION_REFERRAL_REP', 'UNION_ADMIN']) && p.organizationId === m.value.ownerOrganizationId && m.value.acceptance === null;
  const specialistSide = hasAnyRole(p, WORKAID_ROLES) && authorizeSpecialistMatterAccess({ principal: p, matter: m.value, grant: grantFor(w, m.value, p.userId), permission: 'VIEW', now: new Date(w.now) }).allow;
  if (!unionSide && !specialistSide) return deny('FORBIDDEN');
  const res = addDecision(w.graph, input.decision);
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'DECISION_DECLARED', { graph: res.value.graph }, { matterId: m.value.id, claimId: input.decision.claimId }));
}

/* =====================================================================
 * Access, instruments, documents
 * ===================================================================== */

export function assignSpecialist(w: World, p: Principal, input: { matterId: MatterId; userId: UserId }): JResult {
  const m = lookupMatter(w, p, input.matterId);
  if (!m.ok) return m;
  if (!hasAnyRole(p, ['WORKAID_PRINCIPAL']) || p.organizationId !== m.value.specialistOrganizationId) return deny('FORBIDDEN');
  if (!w.users.some((u) => u.userId === input.userId && u.organizationId === m.value.specialistOrganizationId && hasAnyRole(u, WORKAID_ROLES))) return deny('NOT_A_SPECIALIST');
  const next: Matter = { ...m.value, assignedSpecialists: [...new Set([...m.value.assignedSpecialists, input.userId])] };
  return ok(commit(w, p, 'SPECIALIST_ASSIGNED', { matters: replace(w.matters, (x) => x.id === next.id, next) }, { matterId: next.id }));
}

/** Technical access is granted on behalf of the union by its administrator. It is not acceptance and not authority. */
export function grantMatterAccess(w: World, p: Principal, input: { grantId: MatterGrantId; matterId: MatterId; userId: UserId; sourceAuthorizationId: RepresentationAuthorizationId | null; permissions: readonly MatterPermission[] }): JResult {
  const m = lookupMatter(w, p, input.matterId);
  if (!m.ok) return m;
  if (!hasAnyRole(p, ['UNION_ADMIN']) || p.organizationId !== m.value.ownerOrganizationId) return deny('FORBIDDEN');
  const target = w.users.find((u) => u.userId === input.userId);
  if (!target || target.organizationId !== m.value.specialistOrganizationId) return deny('NOT_A_SPECIALIST');
  const g: MatterAccessGrant = { id: input.grantId, matterId: m.value.id, userId: input.userId, organizationId: target.organizationId, status: 'ACTIVE', expiresAt: null, revokedAt: null, permissions: input.permissions, sourceAuthorizationId: input.sourceAuthorizationId };
  return ok(commit(w, p, 'MATTER_GRANT_CREATED', { matterGrants: [...w.matterGrants, g] }, { matterId: m.value.id, details: { grantId: g.id } }));
}

export function recordAuthorization(w: World, p: Principal, input: { authorizationId: RepresentationAuthorizationId; matterId: MatterId; type: AuthorizationType }): JResult {
  const m = lookupMatter(w, p, input.matterId);
  if (!m.ok) return m;
  if (!hasAnyRole(p, WORKAID_ROLES) || !authorizeSpecialistMatterAccess({ principal: p, matter: m.value, grant: grantFor(w, m.value, p.userId), permission: 'VIEW', now: new Date(w.now) }).allow) return deny('FORBIDDEN');
  const a: RepresentationAuthorization = { id: input.authorizationId, matterId: m.value.id, memberId: m.value.memberId, type: input.type, status: 'ACTIVE', effectiveAt: w.now, expiresAt: null, revokedAt: null };
  return ok(commit(w, p, 'AUTHORIZATION_RECORDED', { authorizations: [...w.authorizations, a] }, { matterId: m.value.id, details: { reasonCode: input.type } }));
}

export function uploadDocument(w: World, p: Principal, input: { documentId: DocumentId; matterId: MatterId; filename: string; declaredMime: string; header: Uint8Array; sizeBytes: number; declaredClass?: string }): JResult {
  const m = lookupMatter(w, p, input.matterId);
  if (!m.ok) return m;
  const memberSide = hasAnyRole(p, ['MEMBER']) && p.subjectMemberId === m.value.memberId;
  const unionSide = hasAnyRole(p, ['UNION_REFERRAL_REP', 'UNION_ADMIN']) && p.organizationId === m.value.ownerOrganizationId;
  const specialistSide = hasAnyRole(p, WORKAID_ROLES) && authorizeSpecialistMatterAccess({ principal: p, matter: m.value, grant: grantFor(w, m.value, p.userId), permission: 'VIEW', now: new Date(w.now) }).allow;
  if (!memberSide && !unionSide && !specialistSide) return deny('FORBIDDEN');
  const assessment = assessUpload({ filename: input.filename, declaredMime: input.declaredMime, header: input.header, sizeBytes: input.sizeBytes, maxBytes: 10_000_000, declaredClass: input.declaredClass });
  if (assessment.verdict === 'REJECTED') return deny('UPLOAD_REJECTED', assessment.flags.join(','));
  const doc: DocumentArtifact = { id: input.documentId, matterId: m.value.id, memberId: m.value.memberId, dataClass: 'QUARANTINED', title: assessment.displayName, restrictionHold: null };
  return ok(commit(w, p, 'DOCUMENT_UPLOADED_QUARANTINED', { documents: [...w.documents, doc], uploads: { ...w.uploads, [doc.id]: assessment } }, { matterId: m.value.id, details: { documentRef: doc.id, reasonCode: assessment.verdict } }));
}

export function classifyDocument(w: World, p: Principal, input: { documentId: DocumentId; dataClass: DataClass }): JResult {
  const d = w.documents.find((x) => x.id === input.documentId);
  if (!d) return notFound();
  const m = lookupMatter(w, p, d.matterId);
  if (!m.ok) return m;
  if (!hasAnyRole(p, WORKAID_ROLES)) return deny('FORBIDDEN');
  const access = authorizeSpecialistMatterAccess({ principal: p, matter: m.value, grant: grantFor(w, m.value, p.userId), permission: 'VIEW_DOCUMENTS', now: new Date(w.now) });
  if (!access.allow) return asErr(access);
  if (input.dataClass === 'QUARANTINED') return deny('CANNOT_RECLASSIFY_TO_QUARANTINE');
  return ok(commit(w, p, 'DOCUMENT_CLASSIFIED', { documents: replace(w.documents, (x) => x.id === d.id, { ...d, dataClass: input.dataClass }) }, { matterId: m.value.id, details: { documentRef: d.id, reasonCode: input.dataClass } }));
}

export function placeHold(w: World, p: Principal, documentId: DocumentId, reason: string): JResult {
  const d = w.documents.find((x) => x.id === documentId);
  if (!d) return notFound();
  const m = lookupMatter(w, p, d.matterId);
  if (!m.ok) return m;
  const res = placeRestrictionHold(p, d, reason);
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'DOCUMENT_HOLD_PLACED', { documents: replace(w.documents, (x) => x.id === d.id, res.value) }, { matterId: m.value.id, details: { documentRef: d.id } }));
}

export function liftHold(w: World, p: Principal, documentId: DocumentId, reason: string): JResult {
  const d = w.documents.find((x) => x.id === documentId);
  if (!d) return notFound();
  const m = lookupMatter(w, p, d.matterId);
  if (!m.ok) return m;
  const res = liftRestrictionHold(p, d, { holdLiftRoles: w.policy.holdLiftRoles }, reason);
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'DOCUMENT_HOLD_LIFTED', { documents: replace(w.documents, (x) => x.id === d.id, res.value) }, { matterId: m.value.id, details: { documentRef: d.id } }));
}

/** Eligibility is checked by the contract; the grant itself is an explicit recorded act. */
export function releaseDocument(w: World, p: Principal, input: { documentId: DocumentId; audience: Audience; grantId: string; actions: readonly DocumentAction[] }): JResult {
  const d = w.documents.find((x) => x.id === input.documentId);
  if (!d) return notFound();
  const m = lookupMatter(w, p, d.matterId);
  if (!m.ok) return m;
  const elig = evaluateReleaseEligibility({ principal: p, document: d, matter: m.value, matterGrant: grantFor(w, m.value, p.userId), audience: input.audience, policy: { releaseRoles: w.policy.releaseRoles }, now: new Date(w.now) });
  if (!elig.allow) return asErr(elig);
  const grant = { id: input.grantId as unknown as DocumentDisclosureGrant['id'], documentId: d.id, audience: input.audience, actions: input.actions, approvedBy: p.userId, status: 'ACTIVE' as const, expiresAt: null, revokedAt: null, matterGrantId: null };
  return ok(commit(w, p, 'DOCUMENT_RELEASED', { disclosureGrants: [...w.disclosureGrants, grant] }, { matterId: m.value.id, details: { documentRef: d.id, reasonCode: input.audience.kind } }));
}

/** Single read path for documents in the world; every persona's document view goes through the contract. */
export function readDocument(w: World, p: Principal, documentId: DocumentId, action: DocumentAction = 'VIEW'): Decision {
  const d = w.documents.find((x) => x.id === documentId);
  const m = d ? w.matters.find((x) => x.id === d.matterId) : undefined;
  if (!d || !m) return { allow: false, publicOutcome: 'NOT_FOUND', reason: 'not found' };
  return authorizeDocumentAccess({ principal: p, document: d, matter: m, matterGrant: grantFor(w, m, p.userId), disclosureGrants: w.disclosureGrants, action, now: new Date(w.now) });
}

/* =====================================================================
 * Objections, submissions, receipt, filing
 * ===================================================================== */

export function setWorkContext(w: World, p: Principal, input: { matterId: MatterId; claimId: ClaimId; reason: string }): JResult {
  const r = requireProfessional(w, p, input.matterId);
  if (!r.ok) return r;
  const v = validateWorkContext(p, input.claimId, input.reason);
  if (!v.ok) return deny(v.code, v.message);
  return ok(commit(w, p, 'WORK_CONTEXT_VALIDATED', { workContexts: [...w.workContexts, v.value] }, { matterId: input.matterId, claimId: input.claimId }));
}

export function prepareObjection(w: World, p: Principal, input: { matterId: MatterId } & CreateObjectionInput): JResult {
  const r = requireProfessional(w, p, input.matterId);
  if (!r.ok) return r;
  const res = createObjection(w.graph, input);
  if (!res.ok) return deny(res.code, res.message);
  if (!res.created) return ok(w, false);
  return ok(commit(w, p, 'OBJECTION_PREPARED', { graph: res.value.graph }, { matterId: input.matterId, claimId: input.claimId }));
}

export function proposeGroups(w: World, strategy: GroupingStrategy | null) {
  if (!strategy) return deny('GROUPING_STRATEGY_UNDECIDED', 'ITO grouping within a claim is an open decision (D-05)');
  return ok(planObjectionGroups(w.graph, strategy));
}

export function outboundClaimReferences(w: World, targetClaimId: ClaimId) {
  return selectClaimReferencesForSubmission({ graph: w.graph, targetClaimId, validations: w.workContexts });
}

export function createOutbound(w: World, p: Principal, input: { submissionId: SubmissionId; matterId: MatterId; kind: SubmissionKind; version: number; claimId?: ClaimId; decisionId?: DecisionId; objectionId?: ObjectionId }): JResult {
  const r = requireProfessional(w, p, input.matterId);
  if (!r.ok) return r;
  const objection = input.objectionId ? w.graph.objections.find((o) => o.id === input.objectionId) : undefined;
  if (input.objectionId && (!objection || objection.claimId !== input.claimId || objection.decisionId !== input.decisionId)) return deny('OBJECTION_LINK_MISMATCH');
  if (input.kind === 'WSIAT_NOA') {
    const a = w.assessments.find((x) => x.matterId === input.matterId && x.status === 'ASSESSED_PROCEEDING');
    const ok2 = mayPrepareTribunalSubmission(a);
    if (!ok2.ok) return deny(ok2.code, ok2.message);
  }
  const res = createSubmission({ id: input.submissionId, matterId: input.matterId, kind: input.kind, version: input.version, claimId: input.claimId ?? null, decisionId: input.decisionId ?? null, objectionId: input.objectionId ?? null, issueIds: objection?.issueIds ?? [], preparedBy: p.userId });
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'SUBMISSION_CREATED', { submissions: [...w.submissions, res.value], filings: [...w.filings, newFilingRecord(res.value)] }, { matterId: input.matterId, claimId: input.claimId ?? null, details: { submissionVersion: input.version, reasonCode: input.kind } }));
}

export function attestReadiness(w: World, p: Principal, input: { submissionId: SubmissionId; gate: 'arfReady' | 'noaReady' }): JResult {
  const s = w.submissions.find((x) => x.id === input.submissionId);
  if (!s) return notFound();
  const r = requireProfessional(w, p, s.matterId);
  if (!r.ok) return r;
  const prev = w.gates[s.id] ?? { by: p.userId };
  return ok(commit(w, p, 'READINESS_ATTESTED', { gates: { ...w.gates, [s.id]: { ...prev, [input.gate]: true, by: p.userId } } }, { matterId: s.matterId, details: { reasonCode: input.gate } }));
}

/** Applies a submission event as a human principal, then runs the follow-up consequences. */
export function submissionEvent(w: World, p: Principal, submissionId: SubmissionId, event: SubmissionEvent): JResult {
  const s = w.submissions.find((x) => x.id === submissionId);
  if (!s) return notFound();
  const m = lookupMatter(w, p, s.matterId);
  if (!m.ok) return m;
  // A specialist whose access ended (grant revoked, unassigned) is told "not found", exactly as for a read.
  const access = professional(w, p, m.value, 'APPROVE_SUBMISSION');
  if (!access.allow && access.publicOutcome === 'NOT_FOUND') return notFound();
  const res = applySubmissionEvent(s, event, subCtx(w, p, m.value, s));
  if (!res.ok) return deny(res.code, res.message);
  let next = commit(w, p, `SUBMISSION_${event.type}`, { submissions: replace(w.submissions, (x) => x.id === s.id, res.value) }, { matterId: s.matterId, claimId: s.claimId, details: { fromState: s.state, toState: res.value.state, submissionVersion: s.version } });
  return ok(afterSubmissionChange(next, res.value, p));
}

/** The dispatch provider's own reports (never a human, never receipt). */
export function providerEvent(w: World, submissionId: SubmissionId, event: Extract<SubmissionEvent, { type: 'ACK_DELIVERY' | 'CONFIRM_DISPATCH' | 'FAIL_DISPATCH' }>): JResult {
  const s = w.submissions.find((x) => x.id === submissionId);
  if (!s) return notFound();
  const m = w.matters.find((x) => x.id === s.matterId)!;
  const res = applySubmissionEvent(s, event, { actor: { kind: 'SYSTEM', component: 'DISPATCH_PROVIDER' }, now: w.now, policy: w.policy.submission, gates: w.gates[s.id] ?? {} });
  if (!res.ok) return deny(res.code, res.message);
  const next = commit(w, null, `SUBMISSION_${event.type}`, { submissions: replace(w.submissions, (x) => x.id === s.id, res.value) }, { matterId: m.id, organizationId: m.ownerOrganizationId, claimId: s.claimId, details: { fromState: s.state, toState: res.value.state, submissionVersion: s.version } });
  return ok(afterSubmissionChange(next, res.value, null));
}

function afterSubmissionChange(w: World, sub: Submission, p: Principal | null): World {
  let cur = w;
  // A confirmed dispatch (not an attempt, not an approval) is what generates the receipt follow-up.
  if (sub.state === 'DISPATCHED' && !cur.tasks.some((t) => t.submissionId === sub.id && t.submissionVersion === sub.version)) {
    const owner = (p?.userId ?? (sub.preparedBy as UserId)) as UserId;
    const [tid, w2] = nextId(cur, 'T');
    cur = w2;
    const gen = generateReceiptFollowUp({ submission: sub, existingTasks: cur.tasks, taskOfRecord: cur.policy.taskOfRecord, rule: cur.policy.dueRule, owner, newTaskId: asTaskId(tid) });
    if (gen.ok && gen.value.kind === 'TASK' && gen.created) {
      const task = gen.value.task;
      cur = commit(cur, p, 'RECEIPT_TASK_GENERATED', { tasks: [...cur.tasks, task] }, { matterId: sub.matterId, claimId: sub.claimId, details: { reasonCode: task.authoritative ? 'AUTHORITATIVE' : 'NON_AUTHORITATIVE' } });
      if (task.authoritative && task.dueDate) {
        const [rid, w3] = nextId(cur, 'R');
        cur = w3;
        const rem = scheduleReminder({ task, existing: cur.reminders, offsetKey: 'due', fireAtMs: reminderInstantForDueDate(task.dueDate, cur.policy.matterTimeZone), newId: asReminderId(rid) });
        if (rem.ok && rem.created) cur = commit(cur, p, 'REMINDER_SCHEDULED', { reminders: [...cur.reminders, rem.value] }, { matterId: sub.matterId });
      }
    }
  }
  if (sub.state === 'RECEIPT_CONFIRMED') {
    const t = cur.tasks.find((x) => x.submissionId === sub.id && x.submissionVersion === sub.version);
    if (t) {
      const done = completeFromReceipt(t, sub, cur.now);
      if (done.ok) cur = commit(cur, p, 'RECEIPT_TASK_COMPLETED', { tasks: replace(cur.tasks, (x) => x.id === t.id, done.value) }, { matterId: sub.matterId });
    }
  }
  if (sub.state === 'WITHDRAWN' || sub.state === 'SUPERSEDED') {
    const stale = cur.tasks.filter((t) => t.submissionId === sub.id && t.submissionVersion === sub.version);
    if (stale.length > 0) {
      const closed = cancelOnMatterClose(stale, cur.reminders, sub.matterId, cur.now);
      cur = commit(cur, p, 'RECEIPT_TASK_CANCELLED_SUPERSEDED', { tasks: cur.tasks.map((t) => closed.tasks.find((c) => c.id === t.id) ?? t), reminders: closed.reminders }, { matterId: sub.matterId });
    }
  }
  return cur;
}

export function determineFiling(w: World, p: Principal, input: { submissionId: SubmissionId; sourceId: string; attestations: readonly ElementAttestation[]; reasoning: string; claimedAssessor?: string; intentOverride?: Partial<FilingIntent> }): JResult {
  const s = w.submissions.find((x) => x.id === input.submissionId);
  if (!s) return notFound();
  const r = requireProfessional(w, p, s.matterId);
  if (!r.ok) return r;
  const record = w.filings.find((f) => f.submissionId === s.id)!;
  // The intent is taken from the OBJECTION record the submission is supposed to implement: an independent record, not the submission itself.
  const obj = s.objectionId ? w.graph.objections.find((o) => o.id === s.objectionId) : undefined;
  const intent: FilingIntent = { matterId: s.matterId, claimId: obj?.claimId ?? s.claimId, decisionId: obj?.decisionId ?? s.decisionId, issueIds: obj?.issueIds ?? s.issueIds, kind: s.kind, ...input.intentOverride };
  const res = determineFilingValid({ principal: p, claimedAssessor: input.claimedAssessor ?? p.userId, professionalAuth: r.value.auth, submission: s, currentVersion: s.version, record, intent, registry: w.policy.requirementSources, sourceId: input.sourceId, attestations: input.attestations, reasoning: input.reasoning, now: w.now });
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'FILING_DETERMINED_VALID', { filings: replace(w.filings, (f) => f.submissionId === s.id, res.value) }, { matterId: s.matterId, claimId: s.claimId, details: { submissionVersion: s.version, ruleSourceId: input.sourceId } }));
}

export function determineDefective(w: World, p: Principal, input: { submissionId: SubmissionId; defects: readonly string[]; reasoning: string }): JResult {
  const s = w.submissions.find((x) => x.id === input.submissionId);
  if (!s) return notFound();
  const r = requireProfessional(w, p, s.matterId);
  if (!r.ok) return r;
  const record = w.filings.find((f) => f.submissionId === s.id)!;
  const res = determineFilingDefective({ principal: p, claimedAssessor: p.userId, professionalAuth: r.value.auth, submission: s, currentVersion: s.version, record, reasoning: input.reasoning, now: w.now, defects: input.defects });
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'FILING_DETERMINED_DEFECTIVE', { filings: replace(w.filings, (f) => f.submissionId === s.id, res.value) }, { matterId: s.matterId, details: { submissionVersion: s.version } }));
}

export function recordAuthorityOutcome(w: World, p: Principal, input: { submissionId: SubmissionId; outcome: 'ACCEPTED' | 'REJECTED'; evidenceDocumentId: DocumentId | null; receivedAt: string }): JResult {
  const s = w.submissions.find((x) => x.id === input.submissionId);
  if (!s) return notFound();
  const r = requireProfessional(w, p, s.matterId);
  if (!r.ok) return r;
  const record = w.filings.find((f) => f.submissionId === s.id)!;
  const res = recordAuthorityResponse({ principal: p, claimedRecorder: p.userId, professionalAuth: r.value.auth, submission: s, currentVersion: s.version, record, outcome: input.outcome, evidenceDocumentId: input.evidenceDocumentId, method: 'AUTHORITY_DOCUMENT', receivedAt: input.receivedAt, now: w.now });
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, `AUTHORITY_RESPONSE_${input.outcome}`, { filings: replace(w.filings, (f) => f.submissionId === s.id, res.value) }, { matterId: s.matterId, details: { submissionVersion: s.version } }));
}

/* =====================================================================
 * Deadlines, dependencies, tribunal, publication
 * ===================================================================== */

export function openObligation(w: World, p: Principal, input: { matterId: MatterId; obligation: DeadlineObligation }): JResult {
  const r = requireProfessional(w, p, input.matterId);
  if (!r.ok) return r;
  return ok(commit(w, p, 'OBLIGATION_OPENED', { obligations: [...w.obligations, input.obligation] }, { matterId: r.value.matter.id, claimId: input.obligation.claimId }));
}

export function confirmObligation(w: World, p: Principal, input: { matterId: MatterId; obligationId: string; date: string; sourceDocumentId: DocumentId | null; ruleSourceId: string; reasoning: string; manualRuleAffirmation?: boolean }): JResult {
  const r = requireProfessional(w, p, input.matterId);
  if (!r.ok) return r;
  const o = w.obligations.find((x) => x.id === input.obligationId);
  if (!o) return notFound();
  const res = confirmDeadline({ principal: p, obligation: o, registry: w.policy.ruleRegistry, date: input.date, sourceDocumentId: input.sourceDocumentId, ruleSourceId: input.ruleSourceId, reasoning: input.reasoning, manualRuleAffirmation: input.manualRuleAffirmation, now: w.now });
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'DEADLINE_CONFIRMED', { obligations: replace(w.obligations, (x) => x.id === o.id, res.value) }, { matterId: input.matterId, claimId: o.claimId, details: { ruleSourceId: input.ruleSourceId } }));
}

export function openWait(w: World, p: Principal, input: { id: DependencyId; matterId: MatterId; claimId: ClaimId | null; kind: DependencyKind; waitingSince: string; expectedWindowDays: { min: number; max: number } | null }): JResult {
  const r = requireProfessional(w, p, input.matterId);
  if (!r.ok) return r;
  const d = openDependency({ id: input.id, matterId: input.matterId, claimId: input.claimId, kind: input.kind, waitingSince: input.waitingSince, owner: p.userId, expectedWindowDays: input.expectedWindowDays });
  if (!d.ok) return deny(d.code, d.message);
  return ok(commit(w, p, 'DEPENDENCY_OPENED', { dependencies: [...w.dependencies, d.value] }, { matterId: input.matterId, details: { reasonCode: input.kind } }));
}

export function recordWaitBatch(w: World, p: Principal, input: { id: DependencyId; receivedOn: string; pageCount: number | null; missingPagesNote: string | null }): JResult {
  const d = w.dependencies.find((x) => x.id === input.id);
  if (!d) return notFound();
  const r = requireProfessional(w, p, d.matterId);
  if (!r.ok) return r;
  return ok(commit(w, p, 'DEPENDENCY_BATCH_RECORDED', { dependencies: replace(w.dependencies, (x) => x.id === d.id, recordBatch(d, input)) }, { matterId: d.matterId }));
}

/** Records that an ARO decision arrived and what a professional says its outcome was. Opens a PROMPT for assessment when not favourable. */
export function recordAroDecision(w: World, p: Principal, input: { id: DependencyId; receivedOn: string; outcome: AroOutcome; finalDecisionDocumentId: DocumentId | null; assessmentId: string }): JResult {
  const d = w.dependencies.find((x) => x.id === input.id && x.kind === 'ARO_DECISION');
  if (!d) return notFound();
  const r = requireProfessional(w, p, d.matterId);
  if (!r.ok) return r;
  let next = commit(w, p, 'ARO_DECISION_RECORDED', { dependencies: replace(w.dependencies, (x) => x.id === d.id, recordBatch(d, { receivedOn: input.receivedOn, pageCount: null, missingPagesNote: null })) }, { matterId: d.matterId, details: { reasonCode: input.outcome } });
  const a = openAssessmentIfIndicated({ id: input.assessmentId, matterId: d.matterId, claimId: d.claimId ?? w.graph.claims[0]!.id, aroOutcome: input.outcome, finalDecisionDocumentId: input.finalDecisionDocumentId, now: next.now });
  if (a.ok) next = commit(next, p, 'TRIBUNAL_ASSESSMENT_PROMPT_OPENED', { assessments: [...next.assessments, a.value] }, { matterId: d.matterId });
  return ok(next);
}

export function assessTribunal(w: World, p: Principal, input: { assessmentId: string; decision: Exclude<AssessmentStatus, 'NEEDS_PROFESSIONAL_ASSESSMENT'>; reasoning: string; claimedAssessor?: string }): JResult {
  const a = w.assessments.find((x) => x.id === input.assessmentId);
  if (!a) return notFound();
  const r = requireProfessional(w, p, a.matterId);
  if (!r.ok) return r;
  const res = recordAssessment({ principal: p, claimedAssessor: input.claimedAssessor ?? p.userId, roles: w.policy.tribunalRoles, professionalAuth: r.value.auth, assessment: a, decision: input.decision, finalDecisionDocumentId: null, reasoning: input.reasoning, now: w.now });
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'TRIBUNAL_ASSESSMENT_RECORDED', { assessments: replace(w.assessments, (x) => x.id === a.id, res.value) }, { matterId: a.matterId, details: { reasonCode: input.decision } }));
}

export type PublishEvidenceRef = { kind: 'MATTER_ACCEPTANCE' } | { kind: 'SUBMISSION'; submissionId: SubmissionId } | { kind: 'DEPENDENCY'; id: DependencyId } | { kind: 'NONE' };

export function publishStatus(w: World, p: Principal, input: { matterId: MatterId; stage: MemberStage; text: string; textFr?: string; unionVisible?: boolean; evidence: PublishEvidenceRef }): JResult {
  const r = requireProfessional(w, p, input.matterId, 'PUBLISH_MEMBER_STATUS');
  if (!r.ok) return r;
  let evidence: PublicationEvidence;
  if (input.evidence.kind === 'SUBMISSION') {
    const ev = input.evidence;
    const sub = w.submissions.find((x) => x.id === ev.submissionId && x.matterId === input.matterId);
    if (!sub) return deny('EVIDENCE_NOT_FOUND');
    evidence = { kind: 'SUBMISSION', submission: sub };
  } else if (input.evidence.kind === 'DEPENDENCY') {
    const ev = input.evidence;
    const dep = w.dependencies.find((x) => x.id === ev.id && x.matterId === input.matterId);
    if (!dep) return deny('EVIDENCE_NOT_FOUND');
    evidence = { kind: 'DEPENDENCY', dependency: dep };
  } else evidence = input.evidence;
  const res = publishMemberStatus({ principal: p, matter: r.value.matter, professionalAuth: r.value.auth, stage: input.stage, text: input.text, textFr: input.textFr, bilingualRequired: w.policy.bilingualRequired, unionVisible: input.unionVisible, evidence, priorVersions: w.publications, now: w.now });
  if (!res.ok) return deny(res.code, res.message);
  return ok(commit(w, p, 'STATUS_PUBLISHED', { publications: [...w.publications, res.value] }, { matterId: input.matterId, details: { reasonCode: input.stage, count: res.value.version } }));
}

export function withdrawStatus(w: World, p: Principal, matterId: MatterId, version: number): JResult {
  const r = requireProfessional(w, p, matterId, 'PUBLISH_MEMBER_STATUS');
  if (!r.ok) return r;
  const pub = w.publications.find((x) => x.matterId === matterId && x.version === version);
  if (!pub) return notFound();
  return ok(commit(w, p, 'STATUS_WITHDRAWN', { publications: replace(w.publications, (x) => x === pub, withdrawPublication(pub, w.now)) }, { matterId }));
}

export function requestInfo(w: World, p: Principal, input: { requestId: string; matterId: MatterId; addressedTo: 'MEMBER' | 'UNION'; code: string }): JResult {
  const r = requireProfessional(w, p, input.matterId);
  if (!r.ok) return r;
  const req: InfoRequest = { id: input.requestId, matterId: input.matterId, memberId: r.value.matter.memberId, addressedTo: input.addressedTo, code: input.code, status: 'OPEN', documentId: null };
  return ok(commit(w, p, 'INFO_REQUESTED', { infoRequests: [...w.infoRequests, req] }, { matterId: input.matterId, details: { reasonCode: input.code } }));
}

export function supplyInfo(w: World, p: Principal, input: { requestId: string; documentId: DocumentId }): JResult {
  const req = w.infoRequests.find((x) => x.id === input.requestId);
  if (!req) return notFound();
  const m = lookupMatter(w, p, req.matterId);
  if (!m.ok) return m;
  const isMember = hasAnyRole(p, ['MEMBER']) && p.subjectMemberId === req.memberId && req.addressedTo === 'MEMBER';
  const isUnion = hasAnyRole(p, ['UNION_REFERRAL_REP', 'UNION_ADMIN']) && p.organizationId === m.value.ownerOrganizationId && req.addressedTo === 'UNION';
  if (!isMember && !isUnion) return notFound();
  const doc = w.documents.find((d) => d.id === input.documentId && d.matterId === req.matterId);
  if (!doc) return deny('UPLOAD_FIRST');
  return ok(commit(w, p, 'INFO_SUPPLIED_PENDING_REVIEW', { infoRequests: replace(w.infoRequests, (x) => x.id === req.id, { ...req, status: 'SUPPLIED_PENDING_REVIEW', documentId: doc.id }) }, { matterId: req.matterId, details: { documentRef: doc.id } }));
}

/** The member's lawful records-access channel: opens a request on the audit trail and returns no document content. */
export function requestRecordsAccess(w: World, p: Principal, matterId: MatterId): JResult {
  const m = lookupMatter(w, p, matterId);
  if (!m.ok) return m;
  if (!hasAnyRole(p, ['MEMBER']) || p.subjectMemberId !== m.value.memberId) return notFound();
  return ok(commit(w, p, 'RECORDS_ACCESS_REQUESTED', {}, { matterId }));
}

/* =====================================================================
 * Supervision, revocation, reassignment, closure, delivery, Clio
 * ===================================================================== */

/** After a reassignment the previous owner's reminders are superseded; the new owner must get their own, or the follow-up silently disappears. */
function rescheduleReminder(w: World, p: Principal | null, task: ReceiptFollowUpTask): World {
  if (!task.authoritative || !task.dueDate || isTerminalTask(task.state)) return w;
  const [rid, w2] = nextId(w, 'R');
  const rem = scheduleReminder({ task, existing: w2.reminders, offsetKey: 'due', fireAtMs: reminderInstantForDueDate(task.dueDate, w2.policy.matterTimeZone), newId: asReminderId(rid) });
  return rem.ok && rem.created ? commit(w2, p, 'REMINDER_SCHEDULED', { reminders: [...w2.reminders, rem.value] }, { matterId: task.matterId }) : w2;
}

export function reassignTaskOwner(w: World, p: Principal, input: { taskId: string; newOwner: UserId }): JResult {
  const t = w.tasks.find((x) => x.id === input.taskId);
  if (!t) return notFound();
  const m = lookupMatter(w, p, t.matterId);
  if (!m.ok) return m;
  const auth = professional(w, p, m.value, 'APPROVE_SUBMISSION');
  const res = reassignTask(t, p, input.newOwner, auth, w.now);
  if (!res.ok) return deny(res.code, res.message);
  // A task may only move to someone who can actually act on the matter.
  const target = w.users.find((u) => u.userId === input.newOwner);
  if (!target || !m.value.assignedSpecialists.includes(input.newOwner) || !authorizeSpecialistMatterAccess({ principal: target, matter: m.value, grant: grantFor(w, m.value, target.userId), permission: 'VIEW', now: new Date(w.now) }).allow) {
    return deny('NEW_OWNER_NOT_AUTHORIZED', 'the new owner is not assigned to the matter with a live grant');
  }
  const reminders = supersedeRemindersOnReassign(w.reminders, res.value);
  const moved = commit(w, p, 'TASK_REASSIGNED', { tasks: replace(w.tasks, (x) => x.id === t.id, res.value), reminders }, { matterId: t.matterId });
  return ok(rescheduleReminder(moved, p, res.value));
}

/** Reassigns case responsibility. The former specialist's technical grant ends; the successor receives nothing until the union grants access. */
export function reassignResponsibility(w: World, p: Principal, input: { matterId: MatterId; from: UserId; to: UserId }): JResult {
  const m = lookupMatter(w, p, input.matterId);
  if (!m.ok) return m;
  if (!hasAnyRole(p, ['WORKAID_PRINCIPAL']) || p.organizationId !== m.value.specialistOrganizationId) return deny('FORBIDDEN');
  if (!m.value.assignedSpecialists.includes(input.from)) return deny('NOT_ASSIGNED');
  if (!w.users.some((u) => u.userId === input.to && u.organizationId === m.value.specialistOrganizationId && hasAnyRole(u, WORKAID_ROLES))) return deny('NOT_A_SPECIALIST');
  let cur = commit(w, p, 'RESPONSIBILITY_REASSIGNED', {
    matters: replace(w.matters, (x) => x.id === m.value.id, { ...m.value, assignedSpecialists: [...m.value.assignedSpecialists.filter((u) => u !== input.from), input.to] }),
    matterGrants: w.matterGrants.map((g) => (g.matterId === m.value.id && g.userId === input.from && g.status === 'ACTIVE' ? { ...g, status: 'REVOKED' as const, revokedAt: w.now } : g)),
  }, { matterId: m.value.id });
  for (const t of cur.tasks.filter((x) => x.matterId === m.value.id && x.owner === input.from && x.state !== 'RECEIPT_CONFIRMED' && !x.state.startsWith('CANCELLED'))) {
    const res = reassignTask(t, p, input.to, { allow: true, basis: 'responsibility reassignment' }, cur.now);
    if (res.ok) {
      cur = commit(cur, p, 'TASK_REASSIGNED', { tasks: replace(cur.tasks, (x) => x.id === t.id, res.value), reminders: supersedeRemindersOnReassign(cur.reminders, res.value) }, { matterId: m.value.id });
      cur = rescheduleReminder(cur, p, res.value);
    }
  }
  return ok(cur);
}

export function revoke(w: World, p: Principal, input: { matterId: MatterId; authorizationId: RepresentationAuthorizationId }): JResult {
  const m = lookupMatter(w, p, input.matterId);
  if (!m.ok) return m;
  const res = revokeAuthorization(
    { authorizations: w.authorizations, matterGrants: w.matterGrants, documentGrants: w.disclosureGrants, tasks: w.tasks, reminders: w.reminders, submissions: w.submissions, revocationEpoch: w.revocationEpoch },
    input.authorizationId,
    p,
    m.value,
    w.now,
  );
  if (!res.ok) return deny(res.code, res.message);
  let submissions = res.value.state.submissions;
  for (const id of res.value.approvalsToInvalidate) {
    const s = submissions.find((x) => x.id === id);
    if (!s) continue;
    const inv = applySubmissionEvent(s, { type: 'INVALIDATE_APPROVAL', reason: 'authority revoked' }, { actor: { kind: 'SYSTEM', component: 'AUTHORITY_CASCADE' }, now: w.now, policy: w.policy.submission });
    if (inv.ok) submissions = replace(submissions, (x) => x.id === id, inv.value);
  }
  return ok(commit(w, p, 'AUTHORIZATION_REVOKED', {
    authorizations: res.value.state.authorizations,
    matterGrants: res.value.state.matterGrants,
    disclosureGrants: res.value.state.documentGrants,
    reminders: res.value.state.reminders,
    submissions,
    revocationEpoch: res.value.state.revocationEpoch,
    sessionInvalidations: [...w.sessionInvalidations, ...res.value.sessionInvalidations],
  }, { matterId: m.value.id, details: { count: res.value.auditEvents.length } }));
}

export function closeMatter(w: World, p: Principal, matterId: MatterId): JResult {
  const m = lookupMatter(w, p, matterId);
  if (!m.ok) return m;
  if (!hasAnyRole(p, ['WORKAID_PRINCIPAL']) || p.organizationId !== m.value.specialistOrganizationId) return deny('FORBIDDEN');
  const closed = cancelOnMatterClose(w.tasks, w.reminders, matterId, w.now);
  return ok(commit(w, p, 'MATTER_CLOSED', { matters: replace(w.matters, (x) => x.id === matterId, { ...m.value, status: 'CLOSED' as const }), tasks: closed.tasks, reminders: closed.reminders }, { matterId }));
}

/** Synthetic delivery worker. Delivers only to the synthetic outbox and only through the contract's decisions. */
export function runReminderWorker(w: World, workerId: string): World {
  let cur = w;
  const nowMs = Date.parse(cur.now);
  for (const r of w.reminders) {
    const live = cur.reminders.find((x) => x.id === r.id)!;
    const task = cur.tasks.find((t) => t.id === live.taskId);
    const matter = task ? cur.matters.find((m) => m.id === task.matterId) : undefined;
    const recipient = cur.users.find((u) => u.userId === live.recipient);
    if (!task || !matter || !recipient) continue;
    const recipientAuth = authorizeSpecialistMatterAccess({ principal: recipient, matter, grant: grantFor(cur, matter, recipient.userId), permission: 'VIEW', now: new Date(cur.now) });
    const d = decideDelivery({ reminder: live, task, matterStatus: matter.status, recipientAuth, nowMs });
    if (d.action === 'SKIP') {
      if (d.nextStatus) cur = commit(cur, null, 'REMINDER_SKIPPED', { reminders: replace(cur.reminders, (x) => x.id === live.id, { ...live, status: d.nextStatus!, lease: null }) }, { matterId: matter.id, organizationId: matter.ownerOrganizationId, details: { reasonCode: d.reason } });
      continue;
    }
    const claimed = claimForDelivery(live, workerId, nowMs, 30_000);
    if (!claimed.ok) continue;
    const delivered = recordDeliveryOutcome(claimed.value, 'SINK_ACCEPTED', 3);
    const note = buildNotification({ kind: 'TASK_DUE', opaqueMatterRef: `m_${matter.id}` });
    cur = commit(cur, null, 'REMINDER_DELIVERED_TO_SINK', { reminders: replace(cur.reminders, (x) => x.id === live.id, delivered), outbox: [...cur.outbox, { to: live.recipient, reminderId: live.id, notification: note, sent: false }] }, { matterId: matter.id, organizationId: matter.ownerOrganizationId });
  }
  return cur;
}

/** Records Clio-side task state. Disagreement is a reconciliation exception; nothing is written back. */
export function clioReport(w: World, snapshot: TaskSnapshot): World {
  const sub = w.submissions.find((s) => `receipt-followup:${s.id}:v${s.version}` === snapshot.submissionKey);
  const ueTask = sub ? w.tasks.find((t) => t.submissionId === sub.id && t.submissionVersion === sub.version) : undefined;
  const ueSnap: TaskSnapshot | null = ueTask ? { submissionKey: ueTask.idempotencyKey, status: ueTask.state === 'CANCELLED_SUPERSEDED' || ueTask.state === 'CANCELLED_MATTER_CLOSED' ? 'CANCELLED' : ueTask.state } : null;
  const res = reconcileTaskStates(ueSnap, snapshot, w.policy.taskOfRecord);
  let cur: World = { ...w, clio: [...w.clio.filter((c) => c.submissionKey !== snapshot.submissionKey), snapshot] };
  if (res.outcome === 'RECONCILIATION_EXCEPTION') {
    const org = (sub ? w.matters.find((m) => m.id === sub.matterId)?.ownerOrganizationId : undefined) ?? w.graph.organizationId;
    cur = commit(cur, null, 'CLIO_RECONCILIATION_EXCEPTION', { reconciliation: [...cur.reconciliation, { submissionKey: snapshot.submissionKey, reason: res.reason }] }, { organizationId: org, matterId: sub?.matterId ?? null });
  }
  return cur;
}

export type { Referral, ReferralPacket };
