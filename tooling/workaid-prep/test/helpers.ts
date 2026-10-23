import {
  asClaimId,
  asDecisionId,
  asDisclosureGrantId,
  asDocumentId,
  asIssueId,
  asMatterGrantId,
  asMatterId,
  asMemberId,
  asObjectionId,
  asOrganizationId,
  asReferralId,
  asSubmissionId,
  asTaskId,
  asUserId,
  asWsibClaimNumber,
  asAuthorizationId,
} from '../src/ids.ts';
import type { Principal, Role } from '../src/principal.ts';
import type { Matter, MatterAccessGrant, DocumentArtifact, DocumentDisclosureGrant, RepresentationAuthorization } from '../src/authorization.ts';
import type { ReferralPacket, PolicyDecisionsPending } from '../src/referral.ts';
import type { Submission, SubmissionContext } from '../src/submission.ts';
import { createSubmission, applySubmissionEvent } from '../src/submission.ts';
import type { WsibClaim, WsibDecision } from '../src/claims.ts';

/** Every identifier below is fabricated. No real people, unions, claims or documents. */
export const ORG_A = asOrganizationId('ORG-UNION-A');
export const ORG_B = asOrganizationId('ORG-UNION-B');
export const ORG_WA = asOrganizationId('ORG-WORKAID');

export const NOW = new Date('2026-10-23T14:00:00Z');
export const NOW_ISO = NOW.toISOString();

export const principal = (userId: string, org = ORG_WA, roles: Role[] = ['WORKAID_SPECIALIST'], extra: Partial<Principal> = {}): Principal => ({
  userId: asUserId(userId),
  organizationId: org,
  roles,
  sessionActive: true,
  ...extra,
});

export const REP_A = principal('FAKE-UNION-REP-A', ORG_A, ['UNION_REFERRAL_REP']);
export const REP_B = principal('FAKE-UNION-REP-B', ORG_B, ['UNION_REFERRAL_REP']);
export const VIEWER_A = principal('FAKE-UNION-VIEWER-A', ORG_A, ['UNION_VIEWER']);
export const SPEC_1 = principal('FAKE-WORKAID-STAFF-1');
export const SPEC_2 = principal('FAKE-WORKAID-STAFF-2');
export const PRINCIPAL_1 = principal('FAKE-WORKAID-PRINCIPAL', ORG_WA, ['WORKAID_PRINCIPAL']);
export const MEMBER_ID = asMemberId('FAKE-MEMBER-001');
export const OTHER_MEMBER_ID = asMemberId('FAKE-MEMBER-002');
export const MEMBER_P = principal('FAKE-MEMBER-USER-001', ORG_A, ['MEMBER'], { subjectMemberId: MEMBER_ID });
export const OTHER_MEMBER_P = principal('FAKE-MEMBER-USER-002', ORG_A, ['MEMBER'], { subjectMemberId: OTHER_MEMBER_ID });

/** Synthetic stand-in for decisions that belong to WorkAid. Test fixture only; not a proposed default. */
export const TEST_POLICY: PolicyDecisionsPending = {
  waivableItems: ['GOVERNMENT_PHOTO_ID'],
  urgentExceptionRoles: ['WORKAID_SPECIALIST', 'WORKAID_PRINCIPAL'],
  acceptanceRoles: ['WORKAID_SPECIALIST', 'WORKAID_PRINCIPAL'],
};

export const doc = (id: string) => asDocumentId(id);

export function completePacket(overrides: Partial<ReferralPacket> = {}): ReferralPacket {
  return {
    declaredClaimCount: 1,
    claimHistory: 'ALL_DECLARED',
    wsibCorrespondence: 'PROVIDED',
    items: [
      { code: 'CLIENT_INTAKE_FORM', documentId: doc('FAKE-DOC-F1'), status: 'PROVIDED' },
      { code: 'MEDICAL_AUTHORIZATION', documentId: doc('FAKE-DOC-F2'), status: 'PROVIDED' },
      { code: 'RETAINER_AGREEMENT', documentId: doc('FAKE-DOC-F3'), status: 'PROVIDED' },
      { code: 'SHARE_INFORMATION_RELEASE', documentId: doc('FAKE-DOC-F4'), status: 'PROVIDED' },
      { code: 'GOVERNMENT_PHOTO_ID', documentId: doc('FAKE-DOC-F5'), status: 'PROVIDED' },
    ],
    decisions: [{ decisionId: asDecisionId('A-D1'), outcome: 'DENIED', letterDocumentId: doc('FAKE-DOC-L1') }],
    ...overrides,
  };
}

export const MATTER_ID = asMatterId('FAKE-MATTER-001');

export function openMatter(overrides: Partial<Matter> = {}): Matter {
  return {
    id: MATTER_ID,
    ownerOrganizationId: ORG_A,
    specialistOrganizationId: ORG_WA,
    memberId: MEMBER_ID,
    assignedSpecialists: [SPEC_1.userId],
    status: 'OPEN',
    acceptance: { acceptedBy: PRINCIPAL_1.userId, at: '2026-10-20T15:00:00Z' },
    ...overrides,
  };
}

export function matterGrant(overrides: Partial<MatterAccessGrant> = {}): MatterAccessGrant {
  return {
    id: asMatterGrantId('FAKE-MG-1'),
    matterId: MATTER_ID,
    userId: SPEC_1.userId,
    organizationId: ORG_WA,
    status: 'ACTIVE',
    expiresAt: null,
    revokedAt: null,
    permissions: ['VIEW', 'VIEW_DOCUMENTS', 'DOWNLOAD_DOCUMENTS'],
    sourceAuthorizationId: asAuthorizationId('FAKE-AUTH-RELEASE'),
    ...overrides,
  };
}

export function authorization(type: RepresentationAuthorization['type'], overrides: Partial<RepresentationAuthorization> = {}): RepresentationAuthorization {
  return {
    id: asAuthorizationId(`FAKE-AUTH-${type}`),
    matterId: MATTER_ID,
    memberId: MEMBER_ID,
    type,
    status: 'ACTIVE',
    effectiveAt: '2026-10-01T00:00:00Z',
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  };
}

export function document(overrides: Partial<DocumentArtifact> = {}): DocumentArtifact {
  return {
    id: doc('FAKE-DOC-PRO-01'),
    matterId: MATTER_ID,
    memberId: MEMBER_ID,
    dataClass: 'RESTRICTED_PROFESSIONAL',
    title: 'SYNTH-CANARY psychiatric assessment',
    restrictionHold: null,
    ...overrides,
  };
}

export function disclosureGrant(overrides: Partial<DocumentDisclosureGrant> = {}): DocumentDisclosureGrant {
  return {
    id: asDisclosureGrantId('FAKE-DG-1'),
    documentId: doc('FAKE-DOC-PRO-01'),
    audience: { kind: 'SPECIALIST', userId: SPEC_1.userId },
    actions: ['VIEW', 'DOWNLOAD'],
    approvedBy: PRINCIPAL_1.userId,
    status: 'ACTIVE',
    expiresAt: null,
    revokedAt: null,
    matterGrantId: asMatterGrantId('FAKE-MG-1'),
    ...overrides,
  };
}

export const CLAIM_X = asClaimId('A-CLAIM-X');
export const CLAIM_Y = asClaimId('A-CLAIM-Y');

export const claim = (id: string, number: string, employerKey: string | null, extra: Partial<WsibClaim> = {}): WsibClaim => ({
  id: asClaimId(id),
  organizationId: ORG_A,
  memberId: MEMBER_ID,
  claimNumber: asWsibClaimNumber(number),
  employerKey,
  historical: false,
  closed: false,
  ...extra,
});

export const decision = (id: string, claimId: string, hash: string, issues: string[], extra: Partial<WsibDecision> = {}): WsibDecision => ({
  id: asDecisionId(id),
  claimId: asClaimId(claimId),
  letterContentHash: hash,
  letterDate: '2026-09-15',
  receivedDate: '2026-09-18',
  outcome: 'DENIED',
  issues: issues.map((i) => ({ id: asIssueId(i), kind: 'ENTITLEMENT' })),
  ...extra,
});

export const policyForSubmissions: SubmissionContext['policy'] = {
  approvalRoles: ['WORKAID_SPECIALIST', 'WORKAID_PRINCIPAL'],
  approverMustDifferFromPreparer: false,
};

export const allowDecision = { allow: true as const, basis: 'test' };

/** Drive a submission through states with full authority, for tests that start mid-lifecycle. */
export function submissionAt(state: 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'DISPATCHED' | 'DELIVERY_ACK' | 'RECEIPT_CONFIRMED', kind: Submission['kind'] = 'DOA', version = 1): Submission {
  const created = createSubmission({
    id: asSubmissionId(`FAKE-SUB-${kind}-${version}`),
    matterId: MATTER_ID,
    kind,
    version,
    claimId: CLAIM_X,
    decisionId: asDecisionId('A-D1'),
    objectionId: asObjectionId('FAKE-OBJ-1'),
    issueIds: [asIssueId('A-D1-I1')],
    preparedBy: SPEC_1.userId,
  });
  if (!created.ok) throw new Error(created.message);
  let s = created.value;
  const user = { kind: 'USER' as const, principal: SPEC_1 };
  const base = { now: '2026-10-23T13:00:00Z', professionalAuth: allowDecision, representativeAuth: allowDecision, policy: policyForSubmissions, gates: { arfReady: true, noaReady: true } };
  const step = (event: Parameters<typeof applySubmissionEvent>[1], actor: Parameters<typeof applySubmissionEvent>[2]['actor'] = user) => {
    const r = applySubmissionEvent(s, event, { ...base, actor });
    if (!r.ok) throw new Error(`${event.type}: ${r.code}`);
    s = r.value;
  };
  const order = ['DRAFT', 'REVIEWED', 'APPROVED', 'DISPATCHED', 'DELIVERY_ACK', 'RECEIPT_CONFIRMED'];
  const target = order.indexOf(state);
  if (target >= 1) step({ type: 'REVIEW' });
  if (target >= 2) step({ type: 'APPROVE', claimedApprover: SPEC_1.userId });
  if (target >= 3) step({ type: 'DISPATCH', requestId: 'REQ-1', method: 'FAX_RECORDED_MANUALLY' });
  if (target === 4) step({ type: 'ACK_DELIVERY', channel: 'test-provider', providerRef: 'PR-1' }, { kind: 'SYSTEM', component: 'DISPATCH_PROVIDER' });
  if (target === 5) step({ type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'FAKE WSIB CLERK', receivedAt: '2026-10-24T14:00:00Z' });
  return s;
}

export { asReferralId, asTaskId, asClaimId, asDecisionId, asIssueId, asSubmissionId };
