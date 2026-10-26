/**
 * Union-side WorkAid consent and disclosure (register UE-CONV-G-002), proved on the real kernel storage (platform 0013 +
 * 0027, cache 0020 + 0026) with the real store code and the real canonical audit chain. Only the counsel signature
 * verifier is a test double: the repository ships no counsel-side issuer, and two external gates stay open
 * (counsel-side activation; key custody UE-CONV-G-003). Not a staging pass.
 */
import { createHash } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, ORG_B, seedMembership, U } from './authority-kernel-harness'
import { daysAhead, freshDb, kit, minutesAgo } from './authority-kernel-testkit'
import { COUNSEL_AUDIENCE, type CounselAssertion } from '../../lib/authority/counsel-boundary'
import { createAssertionBackedCounselVerifier, recordCounselEngagement } from '../../lib/authority/store/counsel'
import { insertRelationship, revokeRelationship } from '../../lib/authority/store/mutations'
import { declareOwnRecusal } from '../../lib/authority/store/lifecycle'
import { recordCounselAcceptance, referToWorkAid } from '../../lib/authority/store/workflow'
import {
  adoptConsentWording,
  authoriseWorkAidDocument,
  createWorkAidShare,
  grantWorkAidConsent,
  listOpenConsentWordingProposals,
  proposeConsentWording,
  listCaseWorkAidReferrals,
  listMemberWorkAidConsents,
  listReferableWorkAidConsents,
  loadCurrentConsentText,
  readWorkAidCounselManifest,
  recordConsentText,
  referMatterToWorkAid,
  retireConsentText,
  withdrawConsentWordingProposal,
  revokeWorkAidConsent,
  revokeWorkAidDocumentAuthorisation,
} from '../../lib/authority/store/workaid-disclosure'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>

const ISSUER = 'counsel-gateway'
const COUNSEL = U.counsel
const BODY = 'TEST FIXTURE WORDING ONLY (not approved legal text): I consent to the union sharing the listed categories with WorkAid counsel for the stated purpose until the stated date.'
const SHA = createHash('sha256').update(BODY, 'utf8').digest('hex')
const sigOk = { verifySignature: async () => true }
const sigBad = { verifySignature: async () => false }

let seq = 0
const FUTURE_40D = () => new Date(Date.now() + 40 * 86_400_000)

const adminOne = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => (await k.asAdmin(() => db.query<T>(sql, params))).rows
const count = async (table: string, where = 'true', params: unknown[] = []): Promise<number> => Number((await adminOne<{ n: string }>(`SELECT count(*)::text n FROM ${table} WHERE ${where}`, params))[0].n)
const audits = (action: string) => count('public.audit_logs', 'action = $1 AND organization_id = $2', [`authority.workaid.${action}`, ORG])

const snapshot = async () => ({
  consents: await count('ue_authority_disclosure_consents', 'revoked_at IS NULL'),
  revokedConsents: await count('ue_authority_disclosure_consents', 'revoked_at IS NOT NULL'),
  grants: await count('ue_authority_workaid_consent_grants'),
  auths: await count('ue_authority_workaid_document_auths', 'revoked_at IS NULL'),
  shares: await count('ue_authority_workaid_shares', 'invalidated_at IS NULL'),
  matters: await count('ue_authority_workaid_matters', 'withdrawn_at IS NULL'),
  access: await count('ue_authority_workaid_counsel_access'),
  events: await count('ue_authority_events'),
  auditRows: await count('public.audit_logs'),
})

async function withFailingAudit(action: string, fn: () => Promise<unknown>): Promise<void> {
  await k.asAdmin(() =>
    db.exec(`CREATE OR REPLACE FUNCTION ue_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action = 'authority.workaid.${action}' THEN RAISE EXCEPTION 'audit sink unavailable'; END IF; RETURN NEW; END $$;
      DROP TRIGGER IF EXISTS ue_test_fail_audit ON public.audit_logs;
      CREATE TRIGGER ue_test_fail_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION ue_test_fail_audit();`),
  )
  try {
    await fn()
  } finally {
    await k.asAdmin(() => db.exec(`DROP TRIGGER IF EXISTS ue_test_fail_audit ON public.audit_logs; DROP FUNCTION IF EXISTS ue_test_fail_audit()`))
  }
}

const newCase = async (creator: string = U.member, org = ORG): Promise<string> => {
  const id = newUuid()
  await k.asAdmin(() => db.query(`INSERT INTO public.grievances (id, organization_id, created_by) VALUES ($1,$2,$3)`, [id, org, creator]))
  return id
}

/** A representative with a live assignee relationship to the case (issued by the president, as in the resources suite). */
const newRep = async (caseId: string, role = 'steward'): Promise<{ user: string; relationshipId: string }> => {
  const user = `user_rep_${++seq}`
  await k.asAdmin(() => seedMembership(db, user, ORG, role))
  const relationshipId = await k.as(U.president)((t) =>
    insertRelationship(t, { organizationId: ORG, principalUserId: user, resourceType: 'case', resourceId: caseId, relation: 'assignee', origin: 'derived', effectiveAt: minutesAgo() }),
  )
  return { user, relationshipId }
}

const addDoc = async (caseId: string, o: { uploadedBy?: string; label?: string; privileged?: boolean; medical?: boolean; alsoCase?: string } = {}): Promise<string> => {
  const id = newUuid()
  await k.asAdmin(async () => {
    await db.query(
      `INSERT INTO public.documents (id, organization_id, uploaded_by, privacy_label, contains_legal_privilege, contains_medical_sensitive) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, ORG, o.uploadedBy ?? U.member, o.label ?? 'team_confidential', o.privileged ?? false, o.medical ?? false],
    )
    await db.query(`INSERT INTO public.document_links (document_id, linked_entity_type, linked_entity_id) VALUES ($1,'grievance',$2)`, [id, caseId])
    if (o.alsoCase) await db.query(`INSERT INTO public.document_links (document_id, linked_entity_type, linked_entity_id) VALUES ($1,'grievance',$2)`, [id, o.alsoCase])
  })
  return id
}

const grant = (caseId: string, over: Partial<Parameters<typeof grantWorkAidConsent>[2]> = {}, member: string = U.member, org = ORG) =>
  k.as(member, org)((t) =>
    grantWorkAidConsent(t, k.deps, {
      organizationId: org, memberUserId: member, caseId, categories: ['case_summary', 'documents'], purpose: 'WSIB representation',
      textVersion: 'v1', acknowledgedTextSha256: SHA, expiresAt: daysAhead(30), ...over,
    }),
  )

const refer = (user: string, matterId: string, categories?: string[], org = ORG) => k.as(user, org)((t) => referMatterToWorkAid(t, k.deps, { organizationId: org, referrerUserId: user, matterId, categories }))
const authorise = (matterId: string, documentId: string, member: string = U.member) => k.as(member)((t) => authoriseWorkAidDocument(t, k.deps, { organizationId: ORG, memberUserId: member, matterId, documentId }))
const share = (user: string, matterId: string, o: { categories?: string[]; docs?: string[]; confirm?: boolean } = {}, deps = k.deps) =>
  k.as(user)((t) => createWorkAidShare(t, deps, { organizationId: ORG, actorUserId: user, matterId, categories: o.categories, documentAuthorisationIds: o.docs, confirm: o.confirm ?? true }))
const revoke = (consentId: string, user: string = U.member) => k.as(user)((t) => revokeWorkAidConsent(t, k.deps, { organizationId: ORG, revokerUserId: user, consentId }))
const engage = (matterId: string, counsel = COUNSEL) =>
  k.as(U.vp)((t) =>
    recordCounselEngagement(t, k.deps, { organizationId: ORG, recorderUserId: U.vp, matterId, counselUserId: counsel, capacity: 'external_counsel', informationBarrier: false, effectiveAt: minutesAgo(10), expiresAt: daysAhead(90) }),
  )

const assertion = (matterId: string, over: Partial<CounselAssertion> = {}): CounselAssertion => ({
  issuer: ISSUER, audience: COUNSEL_AUDIENCE, subject: COUNSEL, organizationId: ORG, matterId,
  nonce: `nonce-${newUuid()}`, issuedAt: new Date(Date.now() - 30_000), expiresAt: new Date(Date.now() + 120_000), ...over,
})
const counselDeps = (matterId: string, sig: { verifySignature: () => Promise<boolean> } | null = sigOk, now?: () => Date, org = ORG) => ({
  memberships: k.deps.memberships,
  now,
  counsel: createAssertionBackedCounselVerifier({ assertion: assertion(matterId, { organizationId: org }),   allowedIssuers: [ISSUER], signatureVerifier: sig ?? undefined }),
})
const readAs = (matterId: string, o: { sig?: { verifySignature: () => Promise<boolean> } | null; now?: () => Date; user?: string; org?: string } = {}) => {
  const org = o.org ?? ORG
  const user = o.user ?? COUNSEL
  return k.as(user, org)((t) => readWorkAidCounselManifest(t, counselDeps(matterId, 'sig' in o ? o.sig : sigOk, o.now, org), { organizationId: org, counselUserId: user, matterId }))
}

/** A fully referred matter: member consent, the rep's referral, and the institution's engagement of counsel. */
async function referred(o: { categories?: string[]; member?: string } = {}) {
  const caseId = await newCase(o.member ?? U.member)
  const rep = await newRep(caseId)
  const { consentId, matterId } = await grant(caseId, o.categories ? { categories: o.categories } : {}, o.member ?? U.member)
  await refer(rep.user, matterId)
  await engage(matterId)
  return { caseId, rep, consentId, matterId }
}

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(async () => {
    await seedMembership(db, U.member, ORG_B, 'member')
    await seedMembership(db, U.steward, ORG_B, 'steward')
  })
  await k.adoptDefaultRules()
  await k.grantOffice(U.vp, U.president, U.treasurer)
})

describe('consent wording is institutional: nothing is captured against text nobody recorded', () => {
  it('with no recorded wording, consent capture is refused and no current text exists', async () => {
    const c = await newCase()
    await expect(grant(c)).rejects.toThrow(/CONSENT_TEXT_UNAVAILABLE/)
    expect(await k.as(U.member)((t) => loadCurrentConsentText(t, ORG))).toBeNull()
    expect(await count('ue_authority_workaid_consent_grants')).toBe(0)
  })

  it('only an active executive with a live office mandate may record wording; the database enforces the hash', async () => {
    const record = (user: string, version = 'v1') => k.as(user)((t) => recordConsentText(t, k.deps, { organizationId: ORG, recorderUserId: user, version, body: BODY, effectiveAt: minutesAgo(5) }))
    await expect(record(U.steward)).rejects.toThrow(/CONSENT_TEXT_NOT_AUTHORIZED/)
    await expect(record(U.president)).rejects.toThrow(/CONSENT_TEXT_NOT_AUTHORIZED/) // executive capacity, no live office mandate
    await expect(k.as(U.vp)((t) => recordConsentText(t, k.deps, { organizationId: ORG, recorderUserId: U.steward, version: 'x', body: BODY, effectiveAt: minutesAgo(1) }))).rejects.toThrow(/ACTOR_NOT_SESSION/)
    await expect(k.as(U.vp)((t) => t.query(`INSERT INTO ue_authority_workaid_consent_texts (organization_id, version, body, body_sha256, recorded_by, effective_at) VALUES ($1,'bad',$2,$3,$4,now())`, [ORG, BODY, 'a'.repeat(64), U.vp]))).rejects.toThrow(/hash_chk/)
    await record(U.vp)
    await expect(record(U.vp)).rejects.toThrow(/version_uq/)
    const current = await k.as(U.member)((t) => loadCurrentConsentText(t, ORG))
    expect(current).toMatchObject({ version: 'v1', bodySha256: SHA })
    expect(await audits('consent_text_record')).toBe(1)
  })

  it('a retired wording version can no longer be consented to', async () => {
    const id = (await adminOne<{ id: string }>(`SELECT id::text id FROM ue_authority_workaid_consent_texts WHERE version = 'v1'`))[0].id
    await k.as(U.vp)((t) => recordConsentText(t, k.deps, { organizationId: ORG, recorderUserId: U.vp, version: 'v-old', body: `${BODY} (older)`, effectiveAt: minutesAgo(10) }))
    const old = (await adminOne<{ id: string }>(`SELECT id::text id FROM ue_authority_workaid_consent_texts WHERE version = 'v-old'`))[0].id
    await k.as(U.vp)((t) => retireConsentText(t, k.deps, { organizationId: ORG, retirerUserId: U.vp, textId: old }))
    const c = await newCase()
    await expect(grant(c, { textVersion: 'v-old', acknowledgedTextSha256: createHash('sha256').update(`${BODY} (older)`).digest('hex') })).rejects.toThrow(/CONSENT_TEXT_UNAVAILABLE/)
    await expect(k.as(U.steward)((t) => retireConsentText(t, k.deps, { organizationId: ORG, retirerUserId: U.steward, textId: id }))).rejects.toThrow(/CONSENT_TEXT_NOT_AUTHORIZED/)
    await expect(adminOne(`UPDATE ue_authority_workaid_consent_texts SET body = 'tampered' WHERE id = $1`, [id])).rejects.toThrow()
  })
})

describe('explicit, informed, scoped consent', () => {
  it('captures consent citing the acknowledged wording, allocating a pseudonymous matter id, audited', async () => {
    const c = await newCase()
    const before = await audits('consent_grant')
    const r = await grant(c)
    expect(r.matterId).toMatch(/^[0-9a-f-]{36}$/)
    const g = (await adminOne<{ text_version: string; text_sha256: string; member_user_id: string }>(`SELECT text_version, text_sha256, member_user_id FROM ue_authority_workaid_consent_grants WHERE consent_id = $1`, [r.consentId]))[0]
    expect(g).toMatchObject({ text_version: 'v1', text_sha256: SHA, member_user_id: U.member })
    const consent = (await adminOne<{ issuer: string; direction: string; categories: string[] | string }>(`SELECT issuer, direction, categories FROM ue_authority_disclosure_consents WHERE id = $1`, [r.consentId]))[0]
    expect(consent).toMatchObject({ issuer: 'member', direction: 'union_to_workaid' })
    expect(await audits('consent_grant')).toBe(before + 1)
    // The matter id carries nothing about the member or the case.
    expect(r.matterId).not.toContain(c.slice(-12))
    const mine = await k.as(U.member)((t) => listMemberWorkAidConsents(t, k.deps, { organizationId: ORG, memberUserId: U.member }))
    expect(mine.find((x) => x.consentId === r.consentId)).toMatchObject({ state: 'live', referred: false, caseId: c, categories: ['case_summary', 'documents'] })
  })

  it('refuses an unacknowledged text, a wildcard or unknown category, a bad term, a case that is not the member\'s, and a non-member', async () => {
    const c = await newCase()
    await expect(grant(c, { acknowledgedTextSha256: 'f'.repeat(64) })).rejects.toThrow(/CONSENT_TEXT_NOT_ACKNOWLEDGED/)
    await expect(grant(c, { categories: ['*'] })).rejects.toThrow(/CATEGORY_NOT_ALLOWED/)
    await expect(grant(c, { categories: ['medical'] })).rejects.toThrow(/CATEGORY_NOT_ALLOWED/)
    await expect(grant(c, { categories: [] })).rejects.toThrow(/CATEGORY_NOT_ALLOWED/)
    await expect(grant(c, { expiresAt: minutesAgo(5) })).rejects.toThrow(/CONSENT_TERM_INVALID/)
    await expect(grant(c, { expiresAt: daysAhead(400) })).rejects.toThrow(/CONSENT_TERM_INVALID/)
    await expect(grant(c, { purpose: '   ' })).rejects.toThrow(/CONSENT_TERM_INVALID/)
    await expect(grant(c, {}, U.member2)).rejects.toThrow(/CASE_NOT_OWNED_BY_MEMBER/) // someone else's case
    await expect(grant(c, {}, U.stranger)).rejects.toThrow(/NOT_AN_ACTIVE_MEMBER/)
    // The consenting member is the session principal, never a claim.
    await expect(k.as(U.steward)((t) => grantWorkAidConsent(t, k.deps, { organizationId: ORG, memberUserId: U.member, caseId: c, categories: ['case_summary'], purpose: 'x', textVersion: 'v1', acknowledgedTextSha256: SHA, expiresAt: daysAhead(5) }))).rejects.toThrow(/ACTOR_NOT_SESSION/)
    expect(await count('ue_authority_disclosure_consents', 'matter_id IN (SELECT matter_id FROM ue_authority_workaid_consent_grants WHERE case_id = $1)', [c])).toBe(0)
  })

  it('one live consent per case', async () => {
    const c = await newCase()
    await grant(c)
    await expect(grant(c)).rejects.toThrow(/CASE_ALREADY_REFERRED/)
  })

  it('the database refuses a forged grant: someone else\'s consent, a consent in the wrong direction, mismatched wording', async () => {
    const c = await newCase()
    const r = await grant(c)
    const textId = (await adminOne<{ id: string }>(`SELECT id::text id FROM ue_authority_workaid_consent_texts WHERE version = 'v1'`))[0].id
    const forged = (member: string, matter: string, consentId: string, hash = SHA) =>
      k.as(member)((t) => t.query(`INSERT INTO ue_authority_workaid_consent_grants (organization_id, consent_id, matter_id, case_id, member_user_id, text_id, text_version, text_sha256) VALUES ($1,$2,$3,$4,$5,$6,'v1',$7)`, [ORG, consentId, matter, c, member, textId, hash]))
    await expect(forged(U.member, r.matterId, r.consentId)).rejects.toThrow(/grant_consent_uq|duplicate/)
    await expect(forged(U.member2, newUuid(), r.consentId)).rejects.toThrow(/WORKAID_GRANT_INVALID/)
    const c2 = await newCase()
    const r2 = await grant(c2)
    await expect(forged(U.member, r2.matterId, r.consentId)).rejects.toThrow(/WORKAID_GRANT_INVALID|grant_consent_uq/)
    await expect(k.as(U.member)((t) => t.query(`UPDATE ue_authority_workaid_consent_grants SET text_version = 'v9' WHERE consent_id = $1`, [r.consentId]))).rejects.toThrow(/append-only|not permitted|permission denied/)
  })
})

describe('referral: consent first, then an authorised referrer', () => {
  it('a referral without consent is denied (no record, and the kernel itself requires member consent)', async () => {
    const c = await newCase()
    const rep = await newRep(c)
    await expect(refer(rep.user, newUuid())).rejects.toThrow(/no consent is on record/)
    await expect(k.as(rep.user)((t) => referToWorkAid(t, k.deps, { organizationId: ORG, referrerUserId: rep.user, caseId: c, memberUserId: U.member, categories: ['case_summary'], matterId: newUuid() }))).rejects.toThrow(/CONSENT_REQUIRED/)
    expect(await count('ue_authority_workaid_matters')).toBe(0)
  })

  it('an assigned representative refers; the member and case come from the consent, and it is audited', async () => {
    const c = await newCase()
    const rep = await newRep(c)
    const { consentId, matterId } = await grant(c)
    const referable = await k.as(rep.user)((t) => listReferableWorkAidConsents(t, k.deps, { organizationId: ORG, actorUserId: rep.user, caseId: c }))
    expect(referable).toEqual([expect.objectContaining({ matterId, categories: ['case_summary', 'documents'] })])
    expect(JSON.stringify(referable)).not.toContain(U.member)
    const before = await audits('refer')
    expect(await refer(rep.user, matterId)).toEqual({ matterId })
    const m = (await adminOne<{ member_user_id: string; case_id: string; referred_by: string }>(`SELECT member_user_id, case_id::text case_id, referred_by FROM ue_authority_workaid_matters WHERE id = $1`, [matterId]))[0]
    expect(m).toEqual({ member_user_id: U.member, case_id: c, referred_by: rep.user })
    expect(await audits('refer')).toBe(before + 1)
    await expect(refer(rep.user, matterId)).rejects.toThrow(/already been referred/)
    expect(consentId).toBeTruthy()
  })

  it('shows a recorded referral only to a principal the kernel still allows, without member or referrer identity', async () => {
    const c = await newCase()
    const rep = await newRep(c)
    const { matterId } = await grant(c, { categories: ['case_summary', 'case_timeline'] })
    await refer(rep.user, matterId, ['case_summary'])
    const seen = await k.as(rep.user)((t) => listCaseWorkAidReferrals(t, k.deps, { organizationId: ORG, actorUserId: rep.user, caseId: c }))
    expect(seen).toEqual([expect.objectContaining({ matterId, scopeStatus: 'recorded', referredCategories: ['case_summary'], releasedCategories: [], withdrawn: false, counselAccepted: false })])
    expect(JSON.stringify(seen)).not.toContain(U.member)
    expect(JSON.stringify(seen)).not.toContain(rep.user)
    expect(await k.as(U.steward2)((t) => listCaseWorkAidReferrals(t, k.deps, { organizationId: ORG, actorUserId: U.steward2, caseId: c }))).toEqual([])
    expect(await k.as(U.steward, ORG_B)((t) => listCaseWorkAidReferrals(t, k.deps, { organizationId: ORG_B, actorUserId: U.steward, caseId: c }))).toEqual([])
    await share(rep.user, matterId, { categories: ['case_summary'] })
    const released = await k.as(rep.user)((t) => listCaseWorkAidReferrals(t, k.deps, { organizationId: ORG, actorUserId: rep.user, caseId: c }))
    expect(released[0].releasedCategories).toEqual(['case_summary'])
    const mine = await k.as(U.member)((t) => listMemberWorkAidConsents(t, k.deps, { organizationId: ORG, memberUserId: U.member }))
    expect(mine.find((row) => row.matterId === matterId)?.releasedCategories).toEqual(['case_summary'])
    await k.as(rep.user)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: rep.user, resourceType: 'case', resourceId: c, reason: 'conflict of interest' }))
    expect(await k.as(rep.user)((t) => listCaseWorkAidReferrals(t, k.deps, { organizationId: ORG, actorUserId: rep.user, caseId: c }))).toEqual([])
  })

  it('fails closed when referral provenance is missing, malformed, or wider than the categories referred', async () => {
    const c = await newCase()
    const rep = await newRep(c)
    const { matterId, consentId } = await grant(c, { categories: ['case_summary', 'case_timeline'] })
    await refer(rep.user, matterId, ['case_summary'])
    await expect(k.as(rep.user)((t) => t.query(`UPDATE ue_authority_workaid_matters SET referred_categories = ARRAY['case_summary','case_timeline']::text[] WHERE id = $1`, [matterId]))).rejects.toThrow(/may only change/)
    await expect(share(rep.user, matterId, { categories: ['case_timeline'] })).rejects.toThrow(/REFERRAL_SCOPE_EXCEEDED/)
    await expect(share(rep.user, matterId, { categories: ['case_summary'], confirm: false })).rejects.toThrow(/RELEASE_UNCONFIRMED/)
    expect(await count('ue_authority_workaid_shares', 'matter_id = $1', [matterId])).toBe(0)

    await k.asAdmin(() => db.query(`UPDATE public.audit_logs SET details = jsonb_set(details, '{categories}', '["not-a-category"]'::jsonb) WHERE organization_id = $1 AND action = 'authority.workaid.refer' AND resource_id = $2`, [ORG, matterId]))
    const malformed = await k.as(rep.user)((t) => listCaseWorkAidReferrals(t, k.deps, { organizationId: ORG, actorUserId: rep.user, caseId: c }))
    expect(malformed[0]).toMatchObject({ scopeStatus: 'unavailable', referredCategories: [] })
    expect(malformed[0].referredCategories).not.toContain('case_timeline')

    await k.asAdmin(() => db.query(`UPDATE public.audit_logs SET details = jsonb_set(details, '{categories}', '["case_summary","case_timeline"]'::jsonb) WHERE organization_id = $1 AND action = 'authority.workaid.refer' AND resource_id = $2`, [ORG, matterId]))
    const conflict = await k.as(rep.user)((t) => listCaseWorkAidReferrals(t, k.deps, { organizationId: ORG, actorUserId: rep.user, caseId: c }))
    expect(conflict[0]).toMatchObject({ scopeStatus: 'conflict', referredCategories: [] })

    await k.asAdmin(() => db.query(`UPDATE public.audit_logs SET details = jsonb_set(details, '{categories}', '["case_summary"]'::jsonb) WHERE organization_id = $1 AND action = 'authority.workaid.refer' AND resource_id = $2`, [ORG, matterId]))
    await share(rep.user, matterId, { categories: ['case_summary'] })
    const live = await k.as(U.member)((t) => listMemberWorkAidConsents(t, k.deps, { organizationId: ORG, memberUserId: U.member }))
    const row = live.find((item) => item.consentId === consentId)
    expect(row?.disclosureHistory).toEqual([expect.objectContaining({ categories: ['case_summary'], effective: true, deliveredToCounsel: false, counselAcknowledged: false })])
    expect(row).toMatchObject({ notificationDelivered: false, notificationPolicy: 'not_adopted' })
    expect(JSON.stringify(row?.disclosureHistory)).not.toContain(rep.user)
    await revoke(consentId)
    const after = await k.as(U.member)((t) => listMemberWorkAidConsents(t, k.deps, { organizationId: ORG, memberUserId: U.member }))
    expect(after.find((item) => item.consentId === consentId)?.disclosureHistory[0]).toMatchObject({ effective: false, withdrawalReason: 'consent_revoked', deliveredToCounsel: false, counselAcknowledged: false })
    await expect(share(rep.user, matterId, { categories: ['case_summary'] })).rejects.toThrow(/CONSENT_NOT_LIVE|no live referral/)
  })

  it('the member refers their own matter (creator relationship); a different member cannot', async () => {
    const c = await newCase()
    const { matterId } = await grant(c)
    await expect(refer(U.member2, matterId)).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    await refer(U.member, matterId)
    expect((await adminOne<{ referred_by: string }>(`SELECT referred_by FROM ue_authority_workaid_matters WHERE id = $1`, [matterId]))[0].referred_by).toBe(U.member)
  })

  it('refuses a removed, recused, unrelated, down-graded or deactivated representative', async () => {
    // relationship removed
    const c1 = await newCase()
    const r1 = await newRep(c1)
    const m1 = (await grant(c1)).matterId
    await k.as(U.president)((t) => revokeRelationship(t, ORG, r1.relationshipId, U.president))
    await expect(refer(r1.user, m1)).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY/)
    // recused from the underlying case
    const c2 = await newCase()
    const r2 = await newRep(c2)
    const m2 = (await grant(c2)).matterId
    await k.as(r2.user)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: r2.user, resourceType: 'case', resourceId: c2, reason: 'conflict of interest' }))
    await expect(refer(r2.user, m2)).rejects.toThrow(/RECUSED/)
    // never related to the case
    const c3 = await newCase()
    const m3 = (await grant(c3)).matterId
    await expect(refer(U.steward2, m3)).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY/)
    // representation capacity removed
    const c4 = await newCase()
    const r4 = await newRep(c4)
    const m4 = (await grant(c4)).matterId
    await k.asAdmin(() => db.query(`UPDATE user_management.organization_users SET role = 'member' WHERE user_id = $1`, [r4.user]))
    await expect(refer(r4.user, m4)).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    // removed from the organization
    const c5 = await newCase()
    const r5 = await newRep(c5)
    const m5 = (await grant(c5)).matterId
    await k.asAdmin(() => db.query(`UPDATE user_management.organization_users SET is_active = false WHERE user_id = $1`, [r5.user]))
    await expect(refer(r5.user, m5)).rejects.toThrow(/NOT_AN_ACTIVE_MEMBER/)
    // none of them was recorded
    expect(await count('ue_authority_workaid_matters', 'case_id = ANY($1::uuid[])', [[c1, c2, c3, c4, c5]])).toBe(0)
  })

  it('a referral cannot exceed the consent scope and accepts no wildcard', async () => {
    const c = await newCase()
    const rep = await newRep(c)
    const { matterId } = await grant(c, { categories: ['case_summary'] })
    await expect(refer(rep.user, matterId, ['case_summary', 'case_timeline'])).rejects.toThrow(/CONSENT_SCOPE_EXCEEDED/)
    await expect(refer(rep.user, matterId, ['*'])).rejects.toThrow(/CATEGORY_NOT_ALLOWED/)
    expect(await refer(rep.user, matterId, ['case_summary'])).toEqual({ matterId })
  })

  it('a revoked or expired consent cannot be referred on', async () => {
    const c = await newCase()
    const rep = await newRep(c)
    const { consentId, matterId } = await grant(c)
    await revoke(consentId)
    await expect(refer(rep.user, matterId)).rejects.toThrow(/CONSENT_REQUIRED/)
    const c2 = await newCase()
    const rep2 = await newRep(c2)
    const past = () => new Date(Date.now() - 3 * 60_000)
    const r2 = await k.as(U.member)((t) => grantWorkAidConsent(t, { ...k.deps, now: past }, { organizationId: ORG, memberUserId: U.member, caseId: c2, categories: ['case_summary'], purpose: 'WSIB', textVersion: 'v1', acknowledgedTextSha256: SHA, expiresAt: new Date(Date.now() - 60_000) }))
    await expect(refer(rep2.user, r2.matterId)).rejects.toThrow(/CONSENT_REQUIRED/)
  })
})

describe('document authorisation is per document, by the consenting member, classification-bound', () => {
  it('authorises the member\'s own submission only, bound to this matter\'s case', async () => {
    const f = await referred()
    const own = await addDoc(f.caseId)
    const id = await authorise(f.matterId, own)
    const row = (await adminOne<{ classification: string; authorised_by: string }>(`SELECT classification, authorised_by FROM ue_authority_workaid_document_auths WHERE id = $1`, [id]))[0]
    expect(row).toEqual({ classification: 'member_submission', authorised_by: U.member })
    expect(await audits('document_authorise')).toBeGreaterThan(0)
    await expect(authorise(f.matterId, own)).rejects.toThrow(/live_uq|duplicate/) // one live authorisation per document

    const refusals: [string, string][] = [
      ['union working file', await addDoc(f.caseId, { uploadedBy: U.steward })],
      ['privileged by flag', await addDoc(f.caseId, { privileged: true })],
      ['privileged by label', await addDoc(f.caseId, { label: 'privileged' })],
      ['third-party restricted', await addDoc(f.caseId, { uploadedBy: U.steward, medical: true })],
      ['linked to another case too', await addDoc(f.caseId, { alsoCase: await newCase() })],
      ['linked to a different case', await addDoc(await newCase())],
    ]
    for (const [name, doc] of refusals) await expect(authorise(f.matterId, doc), name).rejects.toThrow(/DOCUMENT_NOT_SHAREABLE/)
    await expect(authorise(f.matterId, newUuid())).rejects.toThrow(/DOCUMENT_NOT_SHAREABLE/)
  })

  it('only the consenting member may authorise or revoke; a consent without the documents category cannot', async () => {
    const f = await referred()
    const doc = await addDoc(f.caseId)
    await expect(k.as(f.rep.user)((t) => authoriseWorkAidDocument(t, k.deps, { organizationId: ORG, memberUserId: f.rep.user, matterId: f.matterId, documentId: doc }))).rejects.toThrow(/NOT_THE_CONSENTING_MEMBER/)
    const id = await authorise(f.matterId, doc)
    await expect(k.as(f.rep.user)((t) => revokeWorkAidDocumentAuthorisation(t, k.deps, { organizationId: ORG, revokerUserId: f.rep.user, authorisationId: id }))).rejects.toThrow(/NOT_THE_CONSENTING_MEMBER/)
    await expect(k.as(U.member)((t) => t.query(`INSERT INTO ue_authority_workaid_document_auths (organization_id, matter_id, consent_id, document_id, classification, authorised_by, expires_at) VALUES ($1,$2,(SELECT consent_id FROM ue_authority_workaid_consent_grants WHERE matter_id = $2),$3,'union_working',$4, now() + interval '1 day')`, [ORG, f.matterId, doc, U.member]))).rejects.toThrow(/class_chk/)
    await expect(k.as(f.rep.user)((t) => t.query(`INSERT INTO ue_authority_workaid_document_auths (organization_id, matter_id, consent_id, document_id, classification, authorised_by, expires_at) VALUES ($1,$2,(SELECT consent_id FROM ue_authority_workaid_consent_grants WHERE matter_id = $2),$3,'member_submission',$4, now() + interval '1 day')`, [ORG, f.matterId, newUuid(), f.rep.user]))).rejects.toThrow(/WORKAID_DOCAUTH_INVALID/)

    const g = await referred({ categories: ['case_summary'] })
    const d2 = await addDoc(g.caseId)
    await expect(authorise(g.matterId, d2)).rejects.toThrow(/CATEGORY_NOT_ALLOWED/)
  })
})

describe('shares and the counsel read path: counsel sees only what is consented, authorised and live', () => {
  it('a share needs the consent scope and a live per-document authorisation', async () => {
    const f = await referred({ categories: ['case_summary', 'documents'] })
    const authorised = await addDoc(f.caseId)
    const notAuthorised = await addDoc(f.caseId)
    const authId = await authorise(f.matterId, authorised)
    await expect(share(f.rep.user, f.matterId, { categories: ['case_timeline'] })).rejects.toThrow(/CONSENT_SCOPE_EXCEEDED/)
    await expect(share(f.rep.user, f.matterId, { categories: ['documents'] })).rejects.toThrow(/CATEGORY_NOT_ALLOWED/)
    await expect(share(f.rep.user, f.matterId, {})).rejects.toThrow(/nothing to share/)
    await expect(share(f.rep.user, f.matterId, { docs: [newUuid()] })).rejects.toThrow(/DOCUMENT_NOT_AUTHORISED/)
    expect(notAuthorised).toBeTruthy()
    // a stranger to the case may not share on it
    await expect(share(U.steward2, f.matterId, { categories: ['case_summary'] })).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY/)
    const ids = await share(f.rep.user, f.matterId, { categories: ['case_summary'], docs: [authId] })
    expect(ids).toHaveLength(2)
    expect(await audits('share_create')).toBeGreaterThan(0)
    // the database independently refuses a share beyond the consent or for an unauthorised document
    await expect(k.as(f.rep.user)((t) => t.query(`INSERT INTO ue_authority_workaid_shares (organization_id, matter_id, consent_id, kind, categories, created_by) VALUES ($1,$2,(SELECT consent_id FROM ue_authority_workaid_consent_grants WHERE matter_id = $2),'categories',ARRAY['member_identity'],$3)`, [ORG, f.matterId, f.rep.user]))).rejects.toThrow(/WORKAID_SHARE_INVALID/)
  })

  it('with no counsel verifier configured every counsel read fails closed, before any union data is touched', async () => {
    const f = await referred()
    const before = await snapshot()
    await expect(k.as(COUNSEL)((t) => readWorkAidCounselManifest(t, { memberships: k.deps.memberships }, { organizationId: ORG, counselUserId: COUNSEL, matterId: f.matterId }))).rejects.toThrow(/COUNSEL_NOT_VERIFIABLE/)
    expect(await snapshot()).toEqual(before)
  })

  it('goes only through the counsel verifier port: no signature verifier, a bad signature, a replayed nonce and a union principal are all refused', async () => {
    const f = await referred()
    await share(f.rep.user, f.matterId, { categories: ['case_summary'] })
    await expect(readAs(f.matterId, { sig: null })).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    await expect(readAs(f.matterId, { sig: sigBad })).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    // a union administrator supplying counsel's identity is refused: the assertion names a different subject
    await expect(readAs(f.matterId, { user: U.president })).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    // a replayed nonce is refused (the first use burns it inside a committed transaction)
    const replay = counselDeps(f.matterId)
    const run = () => k.as(COUNSEL)((t) => readWorkAidCounselManifest(t, replay, { organizationId: ORG, counselUserId: COUNSEL, matterId: f.matterId }))
    await run()
    await expect(run()).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    // a counsel with no recorded engagement on this matter is refused
    await expect(k.as(U.clerk)((t) => readWorkAidCounselManifest(t, { memberships: k.deps.memberships, counsel: createAssertionBackedCounselVerifier({ assertion: assertion(f.matterId, { subject: U.clerk }), allowedIssuers: [ISSUER], signatureVerifier: sigOk }) }, { organizationId: ORG, counselUserId: U.clerk, matterId: f.matterId }))).rejects.toThrow(/COUNSEL_/)
  })

  it('counsel sees exactly the live shares inside the consent, by pseudonymous id, with no member or case identifier, and every read is audited', async () => {
    const f = await referred({ categories: ['case_summary', 'documents', 'member_identity'] })
    const doc = await addDoc(f.caseId)
    const unauthorised = await addDoc(f.caseId)
    const authId = await authorise(f.matterId, doc)
    await share(f.rep.user, f.matterId, { categories: ['case_summary'], docs: [authId] })
    const accessBefore = await count('ue_authority_workaid_counsel_access')
    const auditBefore = await audits('counsel_access')
    const m = await readAs(f.matterId)
    expect(m).toEqual({
      matterId: f.matterId,
      referredAt: expect.any(String),
      consent: { categories: ['case_summary', 'documents', 'member_identity'], purpose: 'WSIB representation', expiresAt: expect.any(String), textVersion: 'v1' },
      releasedCategories: ['case_summary', 'documents'],
      memberIdentityDisclosure: 'not_authorised', // consented to, but nothing released: consent is a ceiling, shares are the release
      documents: [{ itemRef: authId, classification: 'member_submission', authorisedUntil: expect.any(String) }],
      counselSideState: 'union_record_only',
    })
    const wire = JSON.stringify(m)
    for (const secret of [U.member, f.caseId, f.rep.user, doc, unauthorised, ORG]) expect(wire).not.toContain(secret)
    expect(await count('ue_authority_workaid_counsel_access')).toBe(accessBefore + 1)
    expect(await audits('counsel_access')).toBe(auditBefore + 1)
    // The consenting member's identity is released only by a share that names it.
    await share(f.rep.user, f.matterId, { categories: ['member_identity'] })
    expect((await readAs(f.matterId)).memberIdentityDisclosure).toBe('authorised')
  })

  it('an unknown matter, another organization\'s matter and a malformed id are refused alike', async () => {
    const f = await referred()
    await expect(readAs(newUuid())).rejects.toThrow(/COUNSEL_ACCESS_REFUSED/)
    await expect(readAs('not-a-uuid')).rejects.toThrow(/COUNSEL_ACCESS_REFUSED/)
    await expect(readAs(f.matterId, { org: ORG_B })).rejects.toThrow()
  })
})

describe('revocation and expiry take effect immediately and cascade atomically', () => {
  it('withdrawing consent stops counsel access, revokes document authorisations, invalidates in-flight shares and withdraws an unaccepted referral', async () => {
    const f = await referred()
    const doc = await addDoc(f.caseId)
    const authId = await authorise(f.matterId, doc)
    await share(f.rep.user, f.matterId, { categories: ['case_summary'], docs: [authId] })
    expect((await readAs(f.matterId)).documents).toHaveLength(1)

    await expect(revoke(f.consentId, f.rep.user)).rejects.toThrow(/NOT_THE_CONSENTING_MEMBER/)
    await expect(revoke(f.consentId, U.president)).rejects.toThrow(/NOT_THE_CONSENTING_MEMBER/)
    const before = await audits('consent_revoke')
    expect(await revoke(f.consentId)).toEqual({ documentAuthorisationsRevoked: 1, sharesInvalidated: 2, referralWithdrawn: true })
    expect(await audits('consent_revoke')).toBe(before + 1)

    await expect(readAs(f.matterId)).rejects.toThrow(/COUNSEL_ACCESS_REFUSED|CONSENT_NOT_LIVE/)
    expect(await count('ue_authority_workaid_shares', 'matter_id = $1 AND invalidated_at IS NULL', [f.matterId])).toBe(0)
    expect((await adminOne<{ invalidation_reason: string }>(`SELECT DISTINCT invalidation_reason FROM ue_authority_workaid_shares WHERE matter_id = $1`, [f.matterId]))).toEqual([{ invalidation_reason: 'consent_revoked' }])
    expect(await count('ue_authority_workaid_document_auths', 'matter_id = $1 AND revoked_at IS NULL', [f.matterId])).toBe(0)
    await expect(share(f.rep.user, f.matterId, { categories: ['case_summary'] })).rejects.toThrow(/MATTER_NOT_FOUND/)
    await expect(revoke(f.consentId)).rejects.toThrow(/already withdrawn/)
    // the case is free again and a new consent may be captured
    await grant(f.caseId)
  })

  it('after counsel accepted, withdrawal still ends the union\'s disclosure; the accepted referral stays counsel-controlled', async () => {
    const f = await referred()
    await share(f.rep.user, f.matterId, { categories: ['case_summary'] })
    await k.as(COUNSEL)((t) => recordCounselAcceptance(t, counselDeps(f.matterId), { organizationId: ORG, matterId: f.matterId }))
    expect(await revoke(f.consentId)).toMatchObject({ referralWithdrawn: false, sharesInvalidated: 1 })
    expect(await count('ue_authority_workaid_matters', 'id = $1 AND withdrawn_at IS NULL AND counsel_accepted_at IS NOT NULL', [f.matterId])).toBe(1)
    await expect(readAs(f.matterId)).rejects.toThrow(/CONSENT_NOT_LIVE/)
  })

  it('an expired consent denies counsel access and new shares at once, with no cascade needed', async () => {
    const f = await referred()
    await share(f.rep.user, f.matterId, { categories: ['case_summary'] })
    await expect(readAs(f.matterId)).resolves.toBeTruthy()
    await expect(readAs(f.matterId, { now: FUTURE_40D })).rejects.toThrow(/CONSENT_NOT_LIVE/)
    await expect(share(f.rep.user, f.matterId, { categories: ['case_summary'] }, { ...k.deps, now: FUTURE_40D })).rejects.toThrow(/CONSENT_NOT_LIVE/)
    const mine = await k.as(U.member)((t) => listMemberWorkAidConsents(t, { ...k.deps, now: FUTURE_40D }, { organizationId: ORG, memberUserId: U.member }))
    expect(mine.find((x) => x.consentId === f.consentId)?.state).toBe('expired')
  })

  it('revoking one document removes only that document and invalidates only its share', async () => {
    const f = await referred()
    const [d1, d2] = [await addDoc(f.caseId), await addDoc(f.caseId)]
    const [a1, a2] = [await authorise(f.matterId, d1), await authorise(f.matterId, d2)]
    await share(f.rep.user, f.matterId, { docs: [a1, a2] })
    expect((await readAs(f.matterId)).documents.map((d) => d.itemRef).sort()).toEqual([a1, a2].sort())
    expect(await k.as(U.member)((t) => revokeWorkAidDocumentAuthorisation(t, k.deps, { organizationId: ORG, revokerUserId: U.member, authorisationId: a1 }))).toEqual({ sharesInvalidated: 1 })
    expect((await readAs(f.matterId)).documents.map((d) => d.itemRef)).toEqual([a2])
    await expect(k.as(U.member)((t) => revokeWorkAidDocumentAuthorisation(t, k.deps, { organizationId: ORG, revokerUserId: U.member, authorisationId: a1 }))).rejects.toThrow(/already revoked/)
    await expect(share(f.rep.user, f.matterId, { docs: [a1] })).rejects.toThrow(/DOCUMENT_NOT_AUTHORISED/)
  })

  it('a document that is later reclassified as privileged or third-party is no longer shared, nor can it be newly shared', async () => {
    const f = await referred()
    const doc = await addDoc(f.caseId)
    const authId = await authorise(f.matterId, doc)
    await share(f.rep.user, f.matterId, { docs: [authId] })
    expect((await readAs(f.matterId)).documents).toHaveLength(1)
    await k.asAdmin(() => db.query(`UPDATE public.documents SET contains_legal_privilege = true WHERE id = $1`, [doc]))
    expect((await readAs(f.matterId)).documents).toEqual([])
    await expect(share(f.rep.user, f.matterId, { docs: [authId] })).rejects.toThrow(/DOCUMENT_NOT_AUTHORISED/)
  })
})

describe('every step is audited atomically: a failed audit rolls the whole step back', () => {
  it('consent grant, referral, document authorisation, share, counsel access and revocation each roll back with their audit', async () => {
    // consent grant
    const c = await newCase()
    let s = await snapshot()
    await withFailingAudit('consent_grant', async () => {
      await expect(grant(c)).rejects.toThrow(/audit sink unavailable/)
    })
    expect(await snapshot()).toEqual(s)
    const { consentId, matterId } = await grant(c)

    // referral (kernel writer audits as workaid.refer)
    const rep = await newRep(c)
    s = await snapshot()
    await withFailingAudit('refer', async () => {
      await expect(refer(rep.user, matterId)).rejects.toThrow(/audit sink unavailable/)
    })
    expect(await snapshot()).toEqual(s)
    await refer(rep.user, matterId)
    await engage(matterId)

    // document authorisation
    const doc = await addDoc(c)
    s = await snapshot()
    await withFailingAudit('document_authorise', async () => {
      await expect(authorise(matterId, doc)).rejects.toThrow(/audit sink unavailable/)
    })
    expect(await snapshot()).toEqual(s)
    const authId = await authorise(matterId, doc)

    // share
    s = await snapshot()
    await withFailingAudit('share_create', async () => {
      await expect(share(rep.user, matterId, { categories: ['case_summary'], docs: [authId] })).rejects.toThrow(/audit sink unavailable/)
    })
    expect(await snapshot()).toEqual(s)
    await share(rep.user, matterId, { categories: ['case_summary'], docs: [authId] })

    // counsel access (the access row, and the nonce the assertion burned, roll back together)
    s = await snapshot()
    await withFailingAudit('counsel_access', async () => {
      await expect(readAs(matterId)).rejects.toThrow(/audit sink unavailable/)
    })
    expect(await snapshot()).toEqual(s)
    expect((await readAs(matterId)).documents).toHaveLength(1)

    // revocation: the consent, authorisations, shares and the referral all stay as they were
    s = await snapshot()
    await withFailingAudit('consent_revoke', async () => {
      await expect(revoke(consentId)).rejects.toThrow(/audit sink unavailable/)
    })
    expect(await snapshot()).toEqual(s)
    expect((await readAs(matterId)).documents).toHaveLength(1) // counsel access was NOT cut by a half-applied revocation
    await revoke(consentId)
    await expect(readAs(matterId)).rejects.toThrow()
  })

  it('the database refuses to commit any WorkAid mutation that no canonical audit row names', async () => {
    const c = await newCase()
    const { matterId } = await grant(c)
    await expect(
      k.as(U.member)((t) =>
        t.query(`UPDATE ue_authority_disclosure_consents SET revoked_at = now(), revoked_by = $2 WHERE matter_id = $1`, [matterId, U.member]),
      ),
    ).rejects.toThrow(/AUDIT_LINK_MISSING/)
    expect(await count('ue_authority_disclosure_consents', 'matter_id = $1 AND revoked_at IS NULL', [matterId])).toBe(1)
  })
})

describe('storage is append-only, actor-bound and tenant-isolated', () => {
  it('refuses DELETE, TRUNCATE and updates outside the permitted columns, even for raw SQL', async () => {
    const f = await referred()
    const authId = await authorise(f.matterId, await addDoc(f.caseId))
    const [shareId] = await share(f.rep.user, f.matterId, { docs: [authId] })
    await expect(k.as(U.member)((t) => t.query(`DELETE FROM ue_authority_workaid_document_auths WHERE id = $1`, [authId]))).rejects.toThrow(/append-only|permission denied/)
    await expect(k.as(U.member)((t) => t.query(`DELETE FROM ue_authority_workaid_shares WHERE id = $1`, [shareId]))).rejects.toThrow(/append-only|permission denied/)
    await expect(k.as(U.member)((t) => t.query(`UPDATE ue_authority_workaid_shares SET categories = ARRAY['case_summary'] WHERE id = $1`, [shareId]))).rejects.toThrow(/may only change/)
    await expect(k.as(U.member)((t) => t.query(`UPDATE ue_authority_workaid_document_auths SET expires_at = expires_at + interval '1 day' WHERE id = $1`, [authId]))).rejects.toThrow(/may only change/)
    await expect(k.as(f.rep.user)((t) => t.query(`UPDATE ue_authority_workaid_shares SET invalidated_at = now(), invalidated_by = $2, invalidation_reason = 'consent_revoked' WHERE id = $1`, [shareId, U.member]))).rejects.toThrow(/ACTOR_NOT_SESSION/)
    await expect(k.as(U.member)((t) => t.query(`TRUNCATE ue_authority_workaid_counsel_access`))).rejects.toThrow()
  })

  it('an organization never sees, revokes, shares or reads another organization\'s WorkAid records', async () => {
    const f = await referred()
    await share(f.rep.user, f.matterId, { categories: ['case_summary'] })
    // row level security: ORG_B sees nothing of ORG's five relations
    for (const table of ['ue_authority_workaid_consent_grants', 'ue_authority_workaid_consent_texts', 'ue_authority_workaid_document_auths', 'ue_authority_workaid_shares', 'ue_authority_workaid_counsel_access']) {
      expect((await k.as(U.member, ORG_B)((t) => t.query<{ n: string }>(`SELECT count(*)::text n FROM ${table}`))).rows[0].n, table).toBe('0')
    }
    await expect(k.as(U.member, ORG_B)((t) => revokeWorkAidConsent(t, k.deps, { organizationId: ORG_B, revokerUserId: U.member, consentId: f.consentId }))).rejects.toThrow(/no WorkAid consent/)
    await expect(k.as(U.steward, ORG_B)((t) => referMatterToWorkAid(t, k.deps, { organizationId: ORG_B, referrerUserId: U.steward, matterId: f.matterId }))).rejects.toThrow(/no consent is on record/)
    await expect(k.as(U.steward, ORG_B)((t) => createWorkAidShare(t, k.deps, { organizationId: ORG_B, actorUserId: U.steward, matterId: f.matterId, categories: ['case_summary'] }))).rejects.toThrow(/MATTER_NOT_FOUND/)
    await expect(readAs(f.matterId, { org: ORG_B })).rejects.toThrow()
    // a principal of ORG_B cannot grant consent on an ORG case by naming it
    await expect(k.as(U.member, ORG_B)((t) => grantWorkAidConsent(t, k.deps, { organizationId: ORG_B, memberUserId: U.member, caseId: f.caseId, categories: ['case_summary'], purpose: 'x', textVersion: 'v1', acknowledgedTextSha256: SHA, expiresAt: daysAhead(5) }))).rejects.toThrow()
    // and ORG's own state is untouched by all of it
    expect((await readAs(f.matterId)).releasedCategories).toEqual(['case_summary'])
  })

  it('a member sees only their own consents', async () => {
    const f = await referred()
    const other = await k.as(U.member2)((t) => listMemberWorkAidConsents(t, k.deps, { organizationId: ORG, memberUserId: U.member2 }))
    expect(other.find((x) => x.consentId === f.consentId)).toBeUndefined()
    await expect(k.as(U.member2)((t) => listMemberWorkAidConsents(t, k.deps, { organizationId: ORG, memberUserId: U.member }))).rejects.toThrow(/ACTOR_NOT_SESSION/)
  })
})

describe('consent wording adoption requires a second executive', () => {
  const version = 'fixture-adoption-1'
  const body = 'TEST FIXTURE WORDING ONLY (not approved legal text): second-executive adoption sample.'

  it('keeps capture closed until a different executive adopts the stored text', async () => {
    const propose = (user: string) => k.as(user)((t) => proposeConsentWording(t, k.deps, { organizationId: ORG, proposerUserId: user, version, body }))
    await expect(propose(U.steward)).rejects.toThrow(/CONSENT_TEXT_NOT_AUTHORIZED/)
    await expect(propose(U.president)).rejects.toThrow(/CONSENT_TEXT_NOT_AUTHORIZED/)
    const proposalId = await propose(U.vp)
    await expect(k.as(U.vp)((t) => adoptConsentWording(t, k.deps, { organizationId: ORG, adopterUserId: U.vp, proposalId }))).rejects.toThrow(/WORDING_ADOPTION_SEGREGATION/)
    await expect(k.as(U.treasurer)((t) => adoptConsentWording(t, k.deps, { organizationId: ORG, adopterUserId: U.treasurer, proposalId }))).rejects.toThrow(/CONSENT_TEXT_NOT_AUTHORIZED/)
    expect(await k.as(U.member)((t) => loadCurrentConsentText(t, ORG))).toMatchObject({ version: 'v1' })

    await k.grantOffice(U.treasurer, U.president, U.vp)
    const open = await k.as(U.treasurer)((t) => listOpenConsentWordingProposals(t, k.deps, { organizationId: ORG, reviewerUserId: U.treasurer }))
    expect(open.find((row) => row.id === proposalId)).toMatchObject({ version, body, ownProposal: false })
    const own = await k.as(U.vp)((t) => listOpenConsentWordingProposals(t, k.deps, { organizationId: ORG, reviewerUserId: U.vp }))
    expect(own.find((row) => row.id === proposalId)?.ownProposal).toBe(true)

    const adopted = await k.as(U.treasurer)((t) => adoptConsentWording(t, k.deps, { organizationId: ORG, adopterUserId: U.treasurer, proposalId }))
    expect(adopted.version).toBe(version)
    expect(await k.as(U.member)((t) => loadCurrentConsentText(t, ORG))).toMatchObject({ version, bodySha256: adopted.bodySha256 })
    const caseId = await newCase()
    const granted = await grant(caseId, { textVersion: version, acknowledgedTextSha256: adopted.bodySha256 })
    expect(granted.matterId).toMatch(/^[0-9a-f-]{36}$/)

    expect((await k.as(U.member, ORG_B)((t) => t.query<{ n: string }>(`SELECT count(*)::text n FROM ue_authority_workaid_consent_text_proposals`))).rows[0].n).toBe('0')
    await expect(k.as(U.treasurer, ORG_B)((t) => adoptConsentWording(t, k.deps, { organizationId: ORG_B, adopterUserId: U.treasurer, proposalId }))).rejects.toThrow(/CONSENT_TEXT_NOT_AUTHORIZED/)
    await expect(k.as(U.treasurer)((t) => adoptConsentWording(t, k.deps, { organizationId: ORG, adopterUserId: U.treasurer, proposalId: newUuid() }))).rejects.toThrow(/NOT_FOUND|no consent wording proposal/)
    await expect(k.as(U.vp)((t) => withdrawConsentWordingProposal(t, k.deps, { organizationId: ORG, proposerUserId: U.vp, proposalId }))).rejects.toMatchObject({ code: 'ALREADY_TERMINAL' })
  })
})
