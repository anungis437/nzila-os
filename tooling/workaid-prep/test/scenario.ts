import { asAuthorizationId, asClaimId, asDecisionId, asDocumentId, asIssueId, asMatterGrantId, asObjectionId, asReferralId, asSubmissionId, asUserId } from '../src/ids.ts';
import type { MatterId, SubmissionId } from '../src/ids.ts';
import type { RequirementSource } from '../src/filing.ts';
import type { RuleSource } from '../src/deadlines.ts';
import { assignSpecialist, classifyDocument, createOutbound, createReferral, declareClaim, declareDecision, emptyWorld, grantMatterAccess, matterIdForReferral, prepareObjection, recordAuthorization, referralEvent, registerMember, submissionEvent, uploadDocument } from '../src/journey.ts';
import type { World, WorldPolicy } from '../src/journey.ts';
import type { DataClass } from '../src/authorization.ts';
import { ADMIN_A, ADMIN_B, CLAIM_X, MEMBER_ID, MEMBER_P, ORG_A, ORG_WA, OTHER_MEMBER_P, PRINCIPAL_1, REP_A, REP_B, SPEC_1, SPEC_2, VIEWER_A, claim, completePacket, decision, doc } from './helpers.ts';
import { must } from './trace.ts';

/** Fixture identifiers. Every person, union, claim number and document below is fabricated. */
export const FX = {
  matter001: 'FX-MATTER-001',
  duplicates: 'FX-IDENTITY-DUPLICATES',
  urgent: 'FX-URGENT-INCOMPLETE',
  crossTenant: 'FX-CROSS-TENANT',
} as const;

export const REF_ID = asReferralId('FAKE-REF-001');
export const MATTER: MatterId = matterIdForReferral(REF_ID);
export const USERS = [ADMIN_A, ADMIN_B, REP_A, VIEWER_A, REP_B, SPEC_1, SPEC_2, PRINCIPAL_1, MEMBER_P, OTHER_MEMBER_P];
export const REVIEWER = PRINCIPAL_1.userId;

export const ITO_SOURCE: RequirementSource = {
  sourceId: 'SYNTH-REQ-ITO',
  label: 'Synthetic requirement source for an ITO (not a statement of any authority requirement)',
  formKind: 'ITO',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  retrievedOn: '2026-10-23',
  reviewedBy: REVIEWER,
  elements: [
    { code: 'SYNTH-EL-SIGNED', description: 'signature present (synthetic element)' },
    { code: 'SYNTH-EL-ISSUES', description: 'disputed issues stated (synthetic element)' },
  ],
};
export const RULE_SOURCE: RuleSource = { sourceId: 'SYNTH-RULE-A', label: 'Synthetic rule source (not a statement of any limitation period)', effectiveFrom: '2026-01-01', effectiveTo: null, retrievedOn: '2026-10-23', reviewedBy: REVIEWER };

/**
 * The fixture policy answers NO open professional decision on WorkAid's behalf
 * except where a journey needs a value to exercise a branch; each such value
 * is named here and is a fixture, never a proposal:
 *   acceptance by principal only, hold lift by principal only, tribunal
 *   assessment by principal only, task-of-record UNRESOLVED, no due-date rule,
 *   no grouping strategy, French not required.
 */
export const POLICY: WorldPolicy = {
  referral: { waivableItems: ['GOVERNMENT_PHOTO_ID'], urgentExceptionRoles: ['WORKAID_SPECIALIST', 'WORKAID_PRINCIPAL'], acceptanceRoles: ['WORKAID_PRINCIPAL'] },
  submission: { approvalRoles: ['WORKAID_SPECIALIST', 'WORKAID_PRINCIPAL'], approverMustDifferFromPreparer: false },
  holdLiftRoles: ['WORKAID_PRINCIPAL'],
  releaseRoles: ['WORKAID_SPECIALIST', 'WORKAID_PRINCIPAL'],
  tribunalRoles: ['WORKAID_PRINCIPAL'],
  groupingStrategy: null,
  taskOfRecord: 'UNRESOLVED',
  dueRule: null,
  ruleRegistry: [RULE_SOURCE],
  requirementSources: [ITO_SOURCE],
  bilingualRequired: false,
  matterTimeZone: 'America/Toronto',
};

export const world0 = (over: Partial<WorldPolicy> = {}, now = '2026-10-23T14:00:00Z'): World => emptyWorld({ ...POLICY, ...over }, USERS, now, ORG_A);

/* ---- staged builders: raw contract calls, deliberately not trace-recorded ---- */

export const withMember = (w: World): World => must(registerMember(w, REP_A, { memberId: MEMBER_ID, displayName: 'FAKE Member One', birthYear: 1980 }));

export function offered(w: World, packet = completePacket()): World {
  let cur = must(createReferral(w, REP_A, { referralId: REF_ID, memberId: MEMBER_ID, specialistOrganizationId: ORG_WA }));
  cur = must(referralEvent(cur, REP_A, REF_ID, { type: 'UPDATE_PACKET', packet }));
  return must(referralEvent(cur, REP_A, REF_ID, { type: 'OFFER' }));
}

export function accepted(w: World): World {
  let cur = must(assignSpecialist(w, PRINCIPAL_1, { matterId: MATTER, userId: SPEC_1.userId }));
  cur = must(grantMatterAccess(cur, ADMIN_A, { grantId: asMatterGrantId('FAKE-MG-1'), matterId: MATTER, userId: SPEC_1.userId, sourceAuthorizationId: asAuthorizationId('FAKE-AUTH-RELEASE'), permissions: ['VIEW', 'VIEW_DOCUMENTS', 'DOWNLOAD_DOCUMENTS'] }));
  cur = must(recordAuthorization(cur, SPEC_1, { authorizationId: asAuthorizationId('FAKE-AUTH-RELEASE'), matterId: MATTER, type: 'SHARE_INFORMATION_RELEASE' }));
  cur = must(recordAuthorization(cur, SPEC_1, { authorizationId: asAuthorizationId('FAKE-AUTH-DOA'), matterId: MATTER, type: 'WSIB_DOA' }));
  return must(referralEvent(cur, PRINCIPAL_1, REF_ID, { type: 'ACCEPT' }));
}

/** Two claims for one worker: X (current employer X, three decisions) and Y (historical, employer Y). */
export function withClaims(w: World): World {
  let cur = must(declareClaim(w, SPEC_1, { matterId: MATTER, claim: claim('A-CLAIM-X', 'FAKE-WSIB-000011', 'EMPLOYER-X') }));
  cur = must(declareClaim(cur, SPEC_1, { matterId: MATTER, claim: claim('A-CLAIM-Y', 'FAKE-WSIB-000012', 'EMPLOYER-Y', { historical: true }) }));
  cur = must(declareDecision(cur, SPEC_1, { matterId: MATTER, decision: decision('A-D1', 'A-CLAIM-X', 'h1', ['A-D1-I1']) }));
  cur = must(declareDecision(cur, SPEC_1, { matterId: MATTER, decision: decision('A-D2', 'A-CLAIM-X', 'h2', ['A-D2-I1', 'A-D2-I2']) }));
  return must(declareDecision(cur, SPEC_1, { matterId: MATTER, decision: decision('B-D1', 'A-CLAIM-Y', 'h4', ['B-D1-I1']) }));
}

export const OBJ_1 = asObjectionId('FAKE-OBJ-1');
export const SUB_ITO = asSubmissionId('FAKE-SUB-ITO-1');

export const withObjection = (w: World): World =>
  must(prepareObjection(w, SPEC_1, { matterId: MATTER, objectionId: OBJ_1, requestId: 'REQ-O1', claimId: CLAIM_X, decisionId: asDecisionId('A-D1'), issueIds: [asIssueId('A-D1-I1')] }));

export function itoApproved(w: World): World {
  let cur = must(createOutbound(w, SPEC_1, { submissionId: SUB_ITO, matterId: MATTER, kind: 'ITO', version: 1, claimId: CLAIM_X, decisionId: asDecisionId('A-D1'), objectionId: OBJ_1 }));
  cur = must(submissionEvent(cur, SPEC_1, SUB_ITO, { type: 'REVIEW' }));
  return must(submissionEvent(cur, SPEC_1, SUB_ITO, { type: 'APPROVE', claimedApprover: SPEC_1.userId }));
}

export function itoSent(w: World, id: SubmissionId = SUB_ITO): World {
  let cur = must(submissionEvent(w, SPEC_1, id, { type: 'ATTEMPT_DISPATCH', requestId: 'REQ-1', method: 'FAX_RECORDED_MANUALLY' }));
  return must(submissionEvent(cur, SPEC_1, id, { type: 'CONFIRM_DISPATCH', requestId: 'REQ-1', transmissionRef: 'FAKE-TX-0001' }));
}

export const stageMatter = (): World => withObjection(withClaims(accepted(offered(withMember(world0())))));
export const stageSent = (policy: Partial<WorldPolicy> = {}): World => itoSent(itoApproved(withObjection(withClaims(accepted(offered(withMember(world0(policy))))))));

/** The principal is assigned and granted access like any other professional; supervision does not bypass access. */
export function withAngeloAccess(w: World): World {
  const cur = must(assignSpecialist(w, PRINCIPAL_1, { matterId: MATTER, userId: PRINCIPAL_1.userId }));
  return must(grantMatterAccess(cur, ADMIN_A, { grantId: asMatterGrantId('FAKE-MG-ANGELO'), matterId: MATTER, userId: PRINCIPAL_1.userId, sourceAuthorizationId: asAuthorizationId('FAKE-AUTH-RELEASE'), permissions: ['VIEW', 'VIEW_DOCUMENTS', 'DOWNLOAD_DOCUMENTS'] }));
}

/** An uploaded, then professionally classified, document. */
export function withDoc(w: World, id: string, dataClass: DataClass, filename = 'letter.pdf'): World {
  const cur = must(uploadDocument(w, REP_A, { documentId: asDocumentId(id), matterId: MATTER, filename, declaredMime: 'application/pdf', header: PDF, sizeBytes: 4000 }));
  return must(classifyDocument(cur, SPEC_1, { documentId: asDocumentId(id), dataClass }));
}

export const PDF = Uint8Array.from(Buffer.from('%PDF-1.7\n', 'latin1'));
export const docId = (s: string) => asDocumentId(s);
export const FAKE_USER = asUserId('FAKE-USER');
export const CLAIM = { X: CLAIM_X, Y: asClaimId('A-CLAIM-Y') };
export { doc };
