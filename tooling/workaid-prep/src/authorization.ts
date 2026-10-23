import type {
  DisclosureGrantId,
  DocumentId,
  MatterGrantId,
  MatterId,
  MemberId,
  OrganizationId,
  RepresentationAuthorizationId,
  UserId,
} from './ids.ts';
import type { Principal, Role } from './principal.ts';
import { hasAnyRole, UNION_ROLES, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';
import type { Referral } from './referral.ts';

/**
 * Separation of rights (spec §3, R1-05): representation authority, professional
 * acceptance, technical matter access, document disclosure and member/union
 * visibility are independent facts. Holding one never implies another.
 */

export type Decision =
  | { readonly allow: true; readonly basis: string }
  | { readonly allow: false; readonly publicOutcome: 'NOT_FOUND' | 'FORBIDDEN' | 'UNAUTHENTICATED'; readonly reason: string };

const deny = (publicOutcome: 'NOT_FOUND' | 'FORBIDDEN' | 'UNAUTHENTICATED', reason: string): Decision => ({
  allow: false,
  publicOutcome,
  reason,
});
const allow = (basis: string): Decision => ({ allow: true, basis });

export interface Matter {
  readonly id: MatterId;
  readonly ownerOrganizationId: OrganizationId;
  readonly specialistOrganizationId: OrganizationId;
  readonly memberId: MemberId;
  readonly assignedSpecialists: readonly UserId[];
  readonly status: 'OPEN' | 'CLOSED';
  readonly acceptance: { readonly acceptedBy: UserId; readonly at: string } | null;
}

export type AuthorizationType =
  | 'WSIB_DOA'
  | 'WORKAID_CLIENT_INTAKE'
  | 'WORKAID_RETAINER'
  | 'MEDICAL_AUTHORIZATION'
  | 'SHARE_INFORMATION_RELEASE';

export interface RepresentationAuthorization {
  readonly id: RepresentationAuthorizationId;
  readonly matterId: MatterId;
  readonly memberId: MemberId;
  readonly type: AuthorizationType;
  readonly status: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
}

export type MatterPermission = 'VIEW' | 'VIEW_DOCUMENTS' | 'DOWNLOAD_DOCUMENTS';

export interface MatterAccessGrant {
  readonly id: MatterGrantId;
  readonly matterId: MatterId;
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly permissions: readonly MatterPermission[];
  /** Instrument that justified this grant. Revoking that instrument cascades here (WA-R3-008). */
  readonly sourceAuthorizationId: RepresentationAuthorizationId | null;
}

const ms = (iso: string) => Date.parse(iso);

function isLive(x: { status: string; expiresAt: string | null; revokedAt: string | null }, now: Date): boolean {
  return x.status === 'ACTIVE' && x.revokedAt === null && (x.expiresAt === null || ms(x.expiresAt) > now.getTime());
}

export function authorizationIsLive(a: RepresentationAuthorization, now: Date): boolean {
  return (
    a.status === 'ACTIVE' &&
    a.revokedAt === null &&
    ms(a.effectiveAt) <= now.getTime() &&
    (a.expiresAt === null || ms(a.expiresAt) > now.getTime())
  );
}

/* ------------------------------------------------------------------ *
 * Referral visibility
 * ------------------------------------------------------------------ */

export function authorizeReferralView(principal: Principal, referral: Referral): Decision {
  if (!principal.sessionActive) return deny('UNAUTHENTICATED', 'inactive session');
  const union = principal.organizationId === referral.organizationId && hasAnyRole(principal, UNION_ROLES);
  const specialist = principal.organizationId === referral.specialistOrganizationId && hasAnyRole(principal, WORKAID_ROLES);
  return union || specialist ? allow(union ? 'referring-union' : 'receiving-specialist') : deny('NOT_FOUND', 'outside referral parties');
}

/* ------------------------------------------------------------------ *
 * Specialist matter access
 * ------------------------------------------------------------------ */

export function authorizeSpecialistMatterAccess(input: {
  principal: Principal;
  matter: Matter;
  grant: MatterAccessGrant | null;
  permission: MatterPermission;
  now: Date;
}): Decision {
  const { principal, matter, grant, permission, now } = input;
  if (!principal.sessionActive) return deny('UNAUTHENTICATED', 'inactive session');
  if (!hasAnyRole(principal, WORKAID_ROLES) || principal.organizationId !== matter.specialistOrganizationId) {
    return deny('NOT_FOUND', 'principal is not in the specialist organization for this matter');
  }
  if (!matter.assignedSpecialists.includes(principal.userId)) return deny('NOT_FOUND', 'specialist not assigned to matter');
  if (
    !grant ||
    grant.matterId !== matter.id ||
    grant.userId !== principal.userId ||
    grant.organizationId !== principal.organizationId ||
    !isLive(grant, now)
  ) {
    return deny('NOT_FOUND', 'no live matter grant for this actor');
  }
  if (!grant.permissions.includes(permission)) return deny('FORBIDDEN', `grant lacks ${permission}`);
  return allow('assigned specialist with live grant');
}

export type ProfessionalAction = 'WSIB_REPRESENTATIVE_ACTION' | 'PUBLISH_MEMBER_STATUS' | 'APPROVE_SUBMISSION';

/**
 * Professional actions need all of: assignment, live technical grant, recorded
 * professional acceptance, an open matter and (for WSIB-facing acts) a live
 * WSIB DOA. The four WorkAid intake documents never substitute for a DOA.
 */
export function authorizeProfessionalAction(input: {
  principal: Principal;
  matter: Matter;
  grant: MatterAccessGrant | null;
  authorizations: readonly RepresentationAuthorization[];
  action: ProfessionalAction;
  now: Date;
}): Decision {
  const access = authorizeSpecialistMatterAccess({ ...input, permission: 'VIEW' });
  if (!access.allow) return access;
  if (!input.matter.acceptance) return deny('FORBIDDEN', 'professional acceptance not recorded; a technical grant is not representation');
  if (input.matter.status === 'CLOSED') return deny('FORBIDDEN', 'matter closed');
  if (input.action === 'WSIB_REPRESENTATIVE_ACTION') {
    const doa = input.authorizations.some(
      (a) => a.matterId === input.matter.id && a.memberId === input.matter.memberId && a.type === 'WSIB_DOA' && authorizationIsLive(a, input.now),
    );
    if (!doa) return deny('FORBIDDEN', 'no live WSIB Direction of Authorization on file');
  }
  return allow('accepted matter with required authority');
}

/* ------------------------------------------------------------------ *
 * Document access and disclosure
 * ------------------------------------------------------------------ */

export type DataClass =
  | 'QUARANTINED'
  | 'RESTRICTED_PROFESSIONAL'
  | 'MEDICAL'
  | 'IDENTITY'
  | 'WSIB_CORRESPONDENCE'
  | 'APPROVED_STATUS';

/** Classes that are never disclosed to a union audience, regardless of grants (spec §7 default posture). */
export const UNION_PROHIBITED_CLASSES: readonly DataClass[] = ['QUARANTINED', 'RESTRICTED_PROFESSIONAL', 'MEDICAL', 'IDENTITY'];

export interface RestrictionHold {
  readonly setBy: UserId;
  readonly reason: string;
}

export interface DocumentArtifact {
  readonly id: DocumentId;
  readonly matterId: MatterId;
  readonly memberId: MemberId;
  readonly dataClass: DataClass;
  /** Title is itself restricted when the document is. Never placed in notifications. */
  readonly title: string;
  readonly restrictionHold: RestrictionHold | null;
}

export type Audience =
  | { readonly kind: 'MEMBER'; readonly memberId: MemberId }
  | { readonly kind: 'UNION'; readonly organizationId: OrganizationId }
  | { readonly kind: 'SPECIALIST'; readonly userId: UserId };

export type DocumentAction = 'VIEW' | 'DOWNLOAD';

export interface DocumentDisclosureGrant {
  readonly id: DisclosureGrantId;
  readonly documentId: DocumentId;
  readonly audience: Audience;
  readonly actions: readonly DocumentAction[];
  readonly approvedBy: UserId;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  /** Matter grant this document grant depends on; null for member/union audiences. */
  readonly matterGrantId: MatterGrantId | null;
}

function findGrant(grants: readonly DocumentDisclosureGrant[], doc: DocumentArtifact, match: (a: Audience) => boolean, action: DocumentAction, now: Date) {
  return grants.find((g) => g.documentId === doc.id && match(g.audience) && g.actions.includes(action) && isLive(g, now));
}

/**
 * Single choke point for every read path (API, search, preview, link redemption).
 * Non-disclosing by construction: every denial that could reveal existence is NOT_FOUND.
 */
export function authorizeDocumentAccess(input: {
  principal: Principal;
  document: DocumentArtifact;
  matter: Matter;
  matterGrant: MatterAccessGrant | null;
  disclosureGrants: readonly DocumentDisclosureGrant[];
  action: DocumentAction;
  now: Date;
}): Decision {
  const { principal, document: doc, matter, action, now } = input;
  if (!principal.sessionActive) return deny('UNAUTHENTICATED', 'inactive session');
  if (doc.matterId !== matter.id) return deny('NOT_FOUND', 'document not in matter');

  if (hasAnyRole(principal, ['MEMBER'])) {
    if (principal.subjectMemberId !== doc.memberId || doc.memberId !== matter.memberId) return deny('NOT_FOUND', 'not the subject member');
    if (doc.dataClass === 'QUARANTINED' || doc.restrictionHold) return deny('NOT_FOUND', 'document not released');
    const g = findGrant(input.disclosureGrants, doc, (a) => a.kind === 'MEMBER' && a.memberId === principal.subjectMemberId, action, now);
    return g ? allow('member release grant') : deny('NOT_FOUND', 'no live member release grant');
  }

  if (hasAnyRole(principal, UNION_ROLES)) {
    if (principal.organizationId !== matter.ownerOrganizationId) return deny('NOT_FOUND', 'other union');
    if (UNION_PROHIBITED_CLASSES.includes(doc.dataClass) || doc.restrictionHold) return deny('NOT_FOUND', 'class never disclosed to union');
    const g = findGrant(input.disclosureGrants, doc, (a) => a.kind === 'UNION' && a.organizationId === principal.organizationId, action, now);
    return g ? allow('union release grant') : deny('NOT_FOUND', 'no live union release grant');
  }

  if (hasAnyRole(principal, WORKAID_ROLES)) {
    const m = authorizeSpecialistMatterAccess({
      principal,
      matter,
      grant: input.matterGrant,
      permission: action === 'DOWNLOAD' ? 'DOWNLOAD_DOCUMENTS' : 'VIEW_DOCUMENTS',
      now,
    });
    if (!m.allow) return m;
    const g = findGrant(input.disclosureGrants, doc, (a) => a.kind === 'SPECIALIST' && a.userId === principal.userId, action, now);
    return g ? allow('specialist document grant') : deny('NOT_FOUND', 'no live specialist document grant');
  }

  return deny('NOT_FOUND', 'role has no document surface');
}

export interface DocumentLink {
  readonly documentId: DocumentId;
  readonly userId: UserId;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
}

/** A link is only a bearer hint: redemption re-runs full authorization against live state. */
export function redeemDocumentLink(
  link: DocumentLink,
  input: Omit<Parameters<typeof authorizeDocumentAccess>[0], 'document' | 'action'> & { document: DocumentArtifact; action: DocumentAction },
): Decision {
  if (input.now.getTime() >= link.expiresAtMs) return deny('NOT_FOUND', 'link expired');
  if (link.userId !== input.principal.userId || link.documentId !== input.document.id) return deny('NOT_FOUND', 'link not issued to this actor for this document');
  return authorizeDocumentAccess(input);
}

export const MAX_DECISION_CACHE_AGE_MS = 60_000;

export interface CachedAllow {
  readonly userId: UserId;
  readonly resource: string;
  readonly cachedAtMs: number;
  readonly grantExpiresAtMs: number | null;
  /** Monotonic counter bumped whenever any grant or authority is revoked or expires. */
  readonly revocationEpoch: number;
}

export function cachedAllowIsUsable(entry: CachedAllow, now: Date, currentEpoch: number, maxAgeMs: number = MAX_DECISION_CACHE_AGE_MS): boolean {
  const age = now.getTime() - entry.cachedAtMs;
  if (age < 0 || age > Math.min(maxAgeMs, MAX_DECISION_CACHE_AGE_MS)) return false;
  if (entry.grantExpiresAtMs !== null && now.getTime() >= entry.grantExpiresAtMs) return false;
  return entry.revocationEpoch >= currentEpoch;
}

/* ------------------------------------------------------------------ *
 * Professional restriction holds and release
 * ------------------------------------------------------------------ */

export function placeRestrictionHold(principal: Principal, doc: DocumentArtifact, reason: string): Result<DocumentArtifact, 'NOT_PROFESSIONAL' | 'REASON_REQUIRED'> {
  if (!hasAnyRole(principal, WORKAID_ROLES)) return err('NOT_PROFESSIONAL', 'only WorkAid professionals may place a hold');
  if (reason.trim().length < 5) return err('REASON_REQUIRED', 'reason required');
  return ok({ ...doc, restrictionHold: { setBy: principal.userId, reason } });
}

export function liftRestrictionHold(
  principal: Principal,
  doc: DocumentArtifact,
  policy: { readonly holdLiftRoles: readonly Role[] },
  reason: string,
): Result<DocumentArtifact, 'NOT_AUTHORIZED' | 'REASON_REQUIRED' | 'NO_HOLD'> {
  if (!doc.restrictionHold) return err('NO_HOLD', 'document has no hold');
  if (!hasAnyRole(principal, policy.holdLiftRoles) || !hasAnyRole(principal, WORKAID_ROLES)) {
    return err('NOT_AUTHORIZED', 'role may not lift a professional hold');
  }
  if (reason.trim().length < 10) return err('REASON_REQUIRED', 'reason required');
  return ok({ ...doc, restrictionHold: null });
}

export function evaluateReleaseEligibility(input: {
  principal: Principal;
  document: DocumentArtifact;
  matter: Matter;
  matterGrant: MatterAccessGrant | null;
  audience: Audience;
  policy: { readonly releaseRoles: readonly Role[] };
  now: Date;
}): Decision {
  const { principal, document: doc, matter, audience } = input;
  const access = authorizeSpecialistMatterAccess({ principal, matter, grant: input.matterGrant, permission: 'VIEW_DOCUMENTS', now: input.now });
  if (!access.allow) return access;
  if (!hasAnyRole(principal, input.policy.releaseRoles)) return deny('FORBIDDEN', 'role may not release documents');
  if (doc.matterId !== matter.id) return deny('NOT_FOUND', 'document not in matter');
  if (doc.dataClass === 'QUARANTINED') return deny('FORBIDDEN', 'unclassified document cannot be released');
  if (doc.restrictionHold) return deny('FORBIDDEN', 'professional restriction hold in force');
  if (audience.kind === 'MEMBER' && audience.memberId !== doc.memberId) return deny('FORBIDDEN', 'member audience does not match document subject');
  if (audience.kind === 'UNION') {
    if (audience.organizationId !== matter.ownerOrganizationId) return deny('FORBIDDEN', 'union is not the referring union');
    if (UNION_PROHIBITED_CLASSES.includes(doc.dataClass)) return deny('FORBIDDEN', `${doc.dataClass} is never released to a union`);
  }
  if (audience.kind === 'SPECIALIST') return deny('FORBIDDEN', 'specialist access is granted through matter grants, not release');
  return allow('release eligible; grant creation still requires an explicit recorded decision');
}

/* ------------------------------------------------------------------ *
 * Projections
 * ------------------------------------------------------------------ */

export type NotificationKind = 'DOCUMENT_UPDATED' | 'STATUS_UPDATED' | 'ACTION_REQUESTED' | 'TASK_DUE';

export interface Notification {
  readonly kind: NotificationKind;
  readonly text: string;
  /** Opaque route. Following it re-runs authorization; it carries no titles or identifiers of claims. */
  readonly deepLink: string;
}

const GENERIC_TEXT: Record<NotificationKind, string> = {
  DOCUMENT_UPDATED: 'There is an update on your matter. Sign in to view it.',
  STATUS_UPDATED: 'Your matter status has been updated. Sign in to view it.',
  ACTION_REQUESTED: 'An action is requested on your matter. Sign in to view it.',
  TASK_DUE: 'A task on your matter needs attention. Sign in to view it.',
};

export function buildNotification(input: {
  kind: NotificationKind;
  opaqueMatterRef: string;
  approvedPreview?: { text: string; approvedBy: UserId } | null;
  document?: DocumentArtifact;
}): Notification {
  const preview = input.approvedPreview;
  const documentIsSensitive = !!input.document && (input.document.restrictionHold !== null || UNION_PROHIBITED_CLASSES.includes(input.document.dataClass));
  const usePreview =
    !!preview && preview.text.trim().length > 0 && !documentIsSensitive && !(input.document && preview.text.includes(input.document.title));
  return {
    kind: input.kind,
    text: usePreview ? preview.text : GENERIC_TEXT[input.kind],
    deepLink: `/m/${input.opaqueMatterRef}`,
  };
}

export interface MemberStatusPublication {
  readonly matterId: MatterId;
  readonly version: number;
  readonly stage: string;
  readonly text: string;
  readonly approvedBy: UserId;
  readonly publishedAt: string;
  readonly withdrawnAt: string | null;
  /** Internal fields may exist upstream; the projection below ignores anything not allow-listed. */
  readonly [extra: string]: unknown;
}

export function projectMemberStatus(p: MemberStatusPublication): { stage: string; text: string; version: number; publishedAt: string } | null {
  if (p.withdrawnAt) return null;
  return { stage: p.stage, text: p.text, version: p.version, publishedAt: p.publishedAt };
}

/** Primary suppression below `threshold`; a lone suppressed cell also hides the next smallest to block differencing. */
export function suppressSmallCells(counts: Readonly<Record<string, number>>, threshold: number): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = v < threshold ? null : v;
  const suppressed = Object.keys(out).filter((k) => out[k] === null);
  if (suppressed.length === 1) {
    const next = Object.entries(out)
      .filter(([, v]) => v !== null)
      .sort((a, b) => (a[1] as number) - (b[1] as number))[0];
    if (next) out[next[0]] = null;
  }
  return out;
}
