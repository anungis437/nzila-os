import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeDocumentAccess,
  authorizeProfessionalAction,
  authorizeSpecialistMatterAccess,
  buildNotification,
  cachedAllowIsUsable,
  evaluateReleaseEligibility,
  liftRestrictionHold,
  placeRestrictionHold,
  projectMemberStatus,
  redeemDocumentLink,
  suppressSmallCells,
} from '../src/authorization.ts';
import type { DocumentLink } from '../src/authorization.ts';
import { asDocumentId, asMatterId, asUserId } from '../src/ids.ts';
import {
  MEMBER_P,
  NOW,
  OTHER_MEMBER_P,
  ORG_A,
  ORG_B,
  PRINCIPAL_1,
  REP_A,
  REP_B,
  SPEC_1,
  SPEC_2,
  VIEWER_A,
  authorization,
  disclosureGrant,
  document,
  matterGrant,
  openMatter,
  principal,
} from './helpers.ts';

const base = () => ({ document: document(), matter: openMatter(), matterGrant: matterGrant(), disclosureGrants: [disclosureGrant()], now: NOW });
const deniedAs = (d: { allow: boolean }, outcome: string) => {
  assert.equal(d.allow, false);
  assert.equal((d as unknown as { publicOutcome: string }).publicOutcome, outcome);
};

describe('specialist matter access', () => {
  it('assigned specialist with a live grant is allowed', () => {
    assert.equal(authorizeSpecialistMatterAccess({ principal: SPEC_1, matter: openMatter(), grant: matterGrant(), permission: 'VIEW', now: NOW }).allow, true);
  });

  it('[WA-ADV-02] a specialist in the right organization but not assigned to the matter gets a non-disclosing NOT_FOUND', () => {
    const grantForSpec2 = matterGrant({ userId: SPEC_2.userId });
    deniedAs(authorizeSpecialistMatterAccess({ principal: SPEC_2, matter: openMatter(), grant: grantForSpec2, permission: 'VIEW', now: NOW }), 'NOT_FOUND');
  });

  it('[WA-ADV-02] a specialist from another organization never reaches the matter', () => {
    const outsider = principal('FAKE-WORKAID-STAFF-1', ORG_B, ['WORKAID_SPECIALIST']);
    deniedAs(authorizeSpecialistMatterAccess({ principal: outsider, matter: openMatter(), grant: matterGrant(), permission: 'VIEW', now: NOW }), 'NOT_FOUND');
  });

  it('expired, revoked, mismatched-user and inactive-session grants are refused', () => {
    const m = openMatter();
    const deny = (g: ReturnType<typeof matterGrant>, p = SPEC_1) => authorizeSpecialistMatterAccess({ principal: p, matter: m, grant: g, permission: 'VIEW', now: NOW }).allow;
    assert.equal(deny(matterGrant({ expiresAt: '2026-10-23T13:59:59Z' })), false);
    assert.equal(deny(matterGrant({ status: 'REVOKED' })), false);
    assert.equal(deny(matterGrant({ revokedAt: '2026-10-22T00:00:00Z' })), false);
    assert.equal(deny(matterGrant({ userId: asUserId('someone-else') })), false);
    assert.equal(deny(matterGrant(), { ...SPEC_1, sessionActive: false }), false);
    assert.equal(deny(matterGrant({ matterId: asMatterId('OTHER') })), false);
    assert.equal(deny(matterGrant({ permissions: ['VIEW_DOCUMENTS'] })), false);
  });
});

describe('acceptance vs access vs WSIB authorization', () => {
  const args = (over: Partial<Parameters<typeof authorizeProfessionalAction>[0]> = {}) => ({
    principal: SPEC_1,
    matter: openMatter(),
    grant: matterGrant(),
    authorizations: [authorization('WSIB_DOA')],
    action: 'WSIB_REPRESENTATIVE_ACTION' as const,
    now: NOW,
    ...over,
  });

  it('all three dimensions present: allowed', () => {
    assert.equal(authorizeProfessionalAction(args()).allow, true);
  });

  it('[WA-T083][WA-T016] a technical view grant without professional acceptance is not representation', () => {
    const d = authorizeProfessionalAction(args({ matter: openMatter({ acceptance: null }) }));
    assert.equal(d.allow, false);
    assert.match((d as { reason: string }).reason, /acceptance/);
  });

  it('[WA-T017] DOA missing, revoked or expired denies WSIB representative action even with grant and acceptance', () => {
    assert.equal(authorizeProfessionalAction(args({ authorizations: [] })).allow, false);
    assert.equal(authorizeProfessionalAction(args({ authorizations: [authorization('WSIB_DOA', { status: 'REVOKED', revokedAt: '2026-10-22T00:00:00Z' })] })).allow, false);
    assert.equal(authorizeProfessionalAction(args({ authorizations: [authorization('WSIB_DOA', { expiresAt: '2026-10-22T00:00:00Z' })] })).allow, false);
  });

  it('[WA-T077][WA-T092] the four WorkAid intake instruments never substitute for a WSIB DOA', () => {
    const fourForms = [authorization('WORKAID_CLIENT_INTAKE'), authorization('MEDICAL_AUTHORIZATION'), authorization('WORKAID_RETAINER'), authorization('SHARE_INFORMATION_RELEASE')];
    assert.equal(authorizeProfessionalAction(args({ authorizations: fourForms })).allow, false);
    // non-WSIB professional actions do not need the DOA
    assert.equal(authorizeProfessionalAction(args({ authorizations: fourForms, action: 'PUBLISH_MEMBER_STATUS' })).allow, true);
  });

  it('a DOA for another member or another matter does not count', () => {
    assert.equal(authorizeProfessionalAction(args({ authorizations: [authorization('WSIB_DOA', { matterId: asMatterId('OTHER-MATTER') })] })).allow, false);
  });

  it('[WA-ADV-17] an authorization that expires mid-matter stops authorizing from the moment it expires', () => {
    const a = authorization('WSIB_DOA', { expiresAt: '2026-10-23T14:30:00Z' });
    assert.equal(authorizeProfessionalAction(args({ authorizations: [a], now: new Date('2026-10-23T14:29:59Z') })).allow, true);
    assert.equal(authorizeProfessionalAction(args({ authorizations: [a], now: new Date('2026-10-23T14:30:00Z') })).allow, false);
  });

  it('a closed matter permits no professional action', () => {
    assert.equal(authorizeProfessionalAction(args({ matter: openMatter({ status: 'CLOSED' }) })).allow, false);
  });
});

describe('document access paths', () => {
  it('[WA-ADV-04][WA-T019] a member guessing a restricted document id gets NOT_FOUND with no title', () => {
    const d = authorizeDocumentAccess({ ...base(), principal: MEMBER_P, action: 'VIEW' });
    deniedAs(d, 'NOT_FOUND');
    assert.equal(JSON.stringify(d).includes('SYNTH-CANARY'), false);
    deniedAs(authorizeDocumentAccess({ ...base(), principal: OTHER_MEMBER_P, action: 'VIEW' }), 'NOT_FOUND');
  });

  it('[WA-T023] a member sees a released document only through an active member grant and never while a professional hold applies', () => {
    const released = document({ dataClass: 'WSIB_CORRESPONDENCE' });
    const grants = [disclosureGrant({ audience: { kind: 'MEMBER', memberId: MEMBER_P.subjectMemberId! }, matterGrantId: null })];
    assert.equal(authorizeDocumentAccess({ ...base(), document: released, disclosureGrants: grants, principal: MEMBER_P, action: 'VIEW' }).allow, true);
    const held = document({ dataClass: 'WSIB_CORRESPONDENCE', restrictionHold: { setBy: SPEC_1.userId, reason: 'privileged strategy' } });
    deniedAs(authorizeDocumentAccess({ ...base(), document: held, disclosureGrants: grants, principal: MEMBER_P, action: 'VIEW' }), 'NOT_FOUND');
  });

  it('a union user sees nothing from another union and never sees restricted classes, grant or not', () => {
    const unionGrant = disclosureGrant({ audience: { kind: 'UNION', organizationId: ORG_A }, matterGrantId: null });
    deniedAs(authorizeDocumentAccess({ ...base(), disclosureGrants: [unionGrant], principal: REP_B, action: 'VIEW' }), 'NOT_FOUND');
    deniedAs(authorizeDocumentAccess({ ...base(), disclosureGrants: [unionGrant], principal: VIEWER_A, action: 'VIEW' }), 'NOT_FOUND');
    const corr = document({ dataClass: 'WSIB_CORRESPONDENCE' });
    assert.equal(authorizeDocumentAccess({ ...base(), document: corr, disclosureGrants: [unionGrant], principal: REP_A, action: 'VIEW' }).allow, true);
  });

  it('[WA-T099] identical external claim numbers in two organizations do not widen access: authorization keys are internal ids', () => {
    const otherUnionMatter = openMatter({ id: asMatterId('FAKE-MATTER-OTHER-UNION'), ownerOrganizationId: ORG_B });
    const d = document({ matterId: otherUnionMatter.id });
    deniedAs(authorizeDocumentAccess({ ...base(), matter: otherUnionMatter, document: d, principal: REP_A, action: 'VIEW' }), 'NOT_FOUND');
  });

  it('[WA-ADV-03][WA-T018] a revoked grant stops serving an old document link', () => {
    const link: DocumentLink = { documentId: document().id, userId: SPEC_1.userId, issuedAtMs: NOW.getTime() - 1000, expiresAtMs: NOW.getTime() + 3_600_000 };
    const live = redeemDocumentLink(link, { ...base(), principal: SPEC_1, action: 'VIEW' });
    assert.equal(live.allow, true);
    const revoked = redeemDocumentLink(link, { ...base(), disclosureGrants: [disclosureGrant({ status: 'REVOKED', revokedAt: '2026-10-23T13:00:00Z' })], principal: SPEC_1, action: 'VIEW' });
    deniedAs(revoked, 'NOT_FOUND');
    const matterRevoked = redeemDocumentLink(link, { ...base(), matterGrant: matterGrant({ status: 'REVOKED' }), principal: SPEC_1, action: 'VIEW' });
    deniedAs(matterRevoked, 'NOT_FOUND');
  });

  it('[WA-T025] expired links, links for another user and links for another document are refused', () => {
    const link: DocumentLink = { documentId: document().id, userId: SPEC_1.userId, issuedAtMs: 0, expiresAtMs: NOW.getTime() };
    deniedAs(redeemDocumentLink(link, { ...base(), principal: SPEC_1, action: 'VIEW' }), 'NOT_FOUND');
    const fresh: DocumentLink = { ...link, expiresAtMs: NOW.getTime() + 60_000 };
    deniedAs(redeemDocumentLink({ ...fresh, userId: asUserId('x') }, { ...base(), principal: SPEC_1, action: 'VIEW' }), 'NOT_FOUND');
    deniedAs(redeemDocumentLink({ ...fresh, documentId: asDocumentId('other') }, { ...base(), principal: SPEC_1, action: 'VIEW' }), 'NOT_FOUND');
  });

  it('[WA-ADV-05] a cached allow stops being usable on expiry, on a newer revocation epoch, or when stale', () => {
    const entry = { userId: SPEC_1.userId, resource: 'doc:1', cachedAtMs: NOW.getTime() - 10_000, grantExpiresAtMs: NOW.getTime() + 5_000, revocationEpoch: 4 };
    assert.equal(cachedAllowIsUsable(entry, NOW, 4), true);
    assert.equal(cachedAllowIsUsable(entry, NOW, 5), false, 'a revocation happened after the entry was cached');
    assert.equal(cachedAllowIsUsable({ ...entry, grantExpiresAtMs: NOW.getTime() - 1 }, NOW, 4), false, 'grant expired while cached');
    assert.equal(cachedAllowIsUsable({ ...entry, cachedAtMs: NOW.getTime() - 61_000 }, NOW, 4), false, 'cache entries are short-lived');
    assert.equal(cachedAllowIsUsable(entry, NOW, 4, 10 * 60_000), true, 'caller cannot extend the ceiling');
    assert.equal(cachedAllowIsUsable({ ...entry, cachedAtMs: NOW.getTime() - 120_000 }, NOW, 4, 10 * 60_000), false);
  });
});

describe('professional restriction holds and release', () => {
  const policy = { holdLiftRoles: ['WORKAID_PRINCIPAL' as const], releaseRoles: ['WORKAID_SPECIALIST' as const, 'WORKAID_PRINCIPAL' as const] };

  it('[WA-ADV-13] a professional hold blocks release to member and union until a principal lifts it with a reason', () => {
    const held = placeRestrictionHold(SPEC_1, document({ dataClass: 'WSIB_CORRESPONDENCE' }), 'must remain restricted');
    assert.equal(held.ok, true);
    const heldDoc = (held as { value: ReturnType<typeof document> }).value;
    const ev = (audience: Parameters<typeof evaluateReleaseEligibility>[0]['audience'], doc = heldDoc) =>
      evaluateReleaseEligibility({ principal: SPEC_1, document: doc, matter: openMatter(), matterGrant: matterGrant(), audience, policy, now: NOW });
    assert.equal(ev({ kind: 'MEMBER', memberId: heldDoc.memberId }).allow, false);
    assert.equal(ev({ kind: 'UNION', organizationId: ORG_A }).allow, false);
    assert.equal(placeRestrictionHold(REP_A, document(), 'attempt').ok, false, 'union cannot place holds');
    assert.equal(liftRestrictionHold(SPEC_1, heldDoc, policy, 'trying to lift it myself').ok, false, 'specialist lacks lift authority under this test policy');
    const lifted = liftRestrictionHold(PRINCIPAL_1, heldDoc, policy, 'reviewed with member and counsel');
    assert.equal(lifted.ok, true);
    assert.equal(ev({ kind: 'MEMBER', memberId: heldDoc.memberId }, (lifted as { value: typeof heldDoc }).value).allow, true);
  });

  it('release eligibility refuses quarantined, medical-to-union, wrong member, wrong union and unauthorized releasers', () => {
    const ev = (d: ReturnType<typeof document>, audience: Parameters<typeof evaluateReleaseEligibility>[0]['audience'], p = SPEC_1) =>
      evaluateReleaseEligibility({ principal: p, document: d, matter: openMatter(), matterGrant: matterGrant(), audience, policy, now: NOW });
    const doc = document;
    assert.equal(ev(doc({ dataClass: 'QUARANTINED' }), { kind: 'MEMBER', memberId: MEMBER_P.subjectMemberId! }).allow, false);
    assert.equal(ev(doc({ dataClass: 'MEDICAL' }), { kind: 'UNION', organizationId: ORG_A }).allow, false);
    assert.equal(ev(doc({ dataClass: 'WSIB_CORRESPONDENCE' }), { kind: 'MEMBER', memberId: OTHER_MEMBER_P.subjectMemberId! }).allow, false);
    assert.equal(ev(doc({ dataClass: 'WSIB_CORRESPONDENCE' }), { kind: 'UNION', organizationId: ORG_B }).allow, false);
    assert.equal(ev(doc({ dataClass: 'WSIB_CORRESPONDENCE' }), { kind: 'MEMBER', memberId: MEMBER_P.subjectMemberId! }, SPEC_2).allow, false);
    assert.equal(ev(doc({ dataClass: 'WSIB_CORRESPONDENCE' }), { kind: 'MEMBER', memberId: MEMBER_P.subjectMemberId! }).allow, true);
  });
});

describe('notifications and projections', () => {
  it('[WA-ADV-14][WA-T053][WA-T091] an unapproved notification carries no title, and sensitive documents never carry a preview', () => {
    const doc = document();
    const n = buildNotification({ kind: 'DOCUMENT_UPDATED', opaqueMatterRef: 'm_9f2a', document: doc });
    assert.equal(JSON.stringify(n).includes('SYNTH-CANARY'), false);
    assert.equal(JSON.stringify(n).includes('psychiatric'), false);
    const withPreview = buildNotification({ kind: 'DOCUMENT_UPDATED', opaqueMatterRef: 'm_9f2a', document: doc, approvedPreview: { text: 'New psychiatric assessment uploaded', approvedBy: SPEC_1.userId } });
    assert.equal(withPreview.text.includes('psychiatric'), false, 'restricted class ignores previews');
    const ok = buildNotification({ kind: 'STATUS_UPDATED', opaqueMatterRef: 'm_9f2a', approvedPreview: { text: 'Your documents were sent to WSIB.', approvedBy: SPEC_1.userId } });
    assert.equal(ok.text, 'Your documents were sent to WSIB.');
    assert.equal(ok.deepLink, '/m/m_9f2a');
  });

  it('a preview that leaks a document title is discarded', () => {
    const doc = document({ dataClass: 'WSIB_CORRESPONDENCE', title: 'SYNTH-CANARY letter' });
    const n = buildNotification({ kind: 'DOCUMENT_UPDATED', opaqueMatterRef: 'm', document: doc, approvedPreview: { text: 'See SYNTH-CANARY letter', approvedBy: SPEC_1.userId } });
    assert.equal(n.text.includes('SYNTH-CANARY'), false);
  });

  it('[WA-T049][WA-T085] member status projection copies allow-listed fields only', () => {
    const p = { matterId: openMatter().id, version: 2, stage: 'DOCUMENTS_SENT_TO_WSIB', text: 'Sent.', approvedBy: SPEC_1.userId, publishedAt: '2026-10-23T00:00:00Z', withdrawnAt: null, internalNote: 'SYNTH-CANARY Clio note', professionalStrategy: 'x' };
    const projected = projectMemberStatus(p);
    assert.deepEqual(Object.keys(projected ?? {}).sort(), ['publishedAt', 'stage', 'text', 'version']);
    assert.equal(JSON.stringify(projected).includes('SYNTH-CANARY'), false);
    assert.equal(projectMemberStatus({ ...p, withdrawnAt: '2026-10-23T01:00:00Z' }), null);
  });

  it('[WA-T052][WA-T095] small cohorts are suppressed and a lone suppression is complemented', () => {
    const out = suppressSmallCells({ 'Local 1': 2, 'Local 2': 14, 'Local 3': 9 }, 5);
    assert.equal(out['Local 1'], null);
    assert.equal(out['Local 3'], null, 'secondary suppression blocks differencing against a published total');
    assert.equal(out['Local 2'], 14);
    const none = suppressSmallCells({ A: 8, B: 9 }, 5);
    assert.deepEqual(none, { A: 8, B: 9 });
  });
});
