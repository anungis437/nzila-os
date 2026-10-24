/**
 * Authoritative resource loaders on PGlite: every decision rests on a current,
 * server-side, organization-scoped record. Seniority, uploader identity, platform
 * status and client claims never substitute for one. Not a staging pass.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, ORG_B, seedMembership, U } from './authority-kernel-harness'
import { daysAhead, freshDb, kit, minutesAgo } from './authority-kernel-testkit'
import { enforceAuthority, enforceDocumentRead } from '../../lib/authority/store/enforce'
import { insertConsent, insertRelationship } from '../../lib/authority/store/mutations'
import { decimalToMinor, derivedId } from '../../lib/authority/store/resources'
import { recordFinancialStep, recordCounselAcceptance, referToWorkAid, registerReview } from '../../lib/authority/store/workflow'
import { auditAuthorityMutation } from '../../lib/authority/store/audit'
import { declareOwnRecusal, liftRecusal } from '../../lib/authority/store/lifecycle'
import type { Action, ResourceType } from '../../lib/authority/ontology'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>
// Stands in for the counsel-side authenticator the union kernel does not own: it vouches for exactly one identity.
let withCounsel: Parameters<typeof recordCounselAcceptance>[1]

const CASE = newUuid()
const CASE_PRIV = newUuid()
const CASE_CONF = newUuid()
const CASE_ORG_B = newUuid()
const ACCT = newUuid()
const T2 = 'user_treasurer_two'

const decide = (user: string, action: Action, type: ResourceType, id: string, org = ORG, extra: Record<string, unknown> = {}) =>
  k.as(user, org)((t) => enforceAuthority(t, k.deps, { principalUserId: user, organizationId: org, action, resource: { type, id, organizationId: org }, ...extra }, { authenticated: true }))
const readCase = (user: string, id = CASE, action: Action = 'case:read') => decide(user, action, 'case', id)
const codes = (d: { reasons: readonly { code: string }[] }) => d.reasons.map((r) => r.code)

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  withCounsel = { counsel: { isCounselFor: async (_exec, i) => i.userId === U.counsel } }
  await k.asAdmin(async () => {
    await seedMembership(db, T2, ORG, 'secretary_treasurer')
    await seedMembership(db, U.member, ORG_B, 'member')
    await db.query(`INSERT INTO public.grievances (id, organization_id, created_by, has_legal_implications, is_confidential) VALUES
      ($1,$5,$6,false,false), ($2,$5,$6,true,false), ($3,$5,$6,false,true), ($4,$7,$6,false,false)`, [CASE, CASE_PRIV, CASE_CONF, CASE_ORG_B, ORG, U.member, ORG_B])
    await db.query(`INSERT INTO public.grievance_case_access_assignments (organization_id, grievance_id, user_id, granted_by, can_comment, can_view_private_documents)
      VALUES ($1,$2,$3,$4,true,false), ($1,$5,$3,$4,true,true)`, [ORG, CASE, U.steward, U.chief, CASE_PRIV])
  })
  await k.adoptDefaultRules()
})

describe('case loader: relationship, not rank', () => {
  it('the creator reads their own case, member-visible only', async () => {
    const d = await readCase(U.member)
    expect(d.effect).toBe('allow')
    expect(d.scope.visibility).toBe('member_visible')
    expect(d.authority[0].kind).toBe('relationship')
  })

  it('nobody gains access from seniority, an office or platform status', async () => {
    for (const who of [U.president, U.vp, U.treasurer, U.officer, U.chief, U.steward2, U.clerk, U.stranger]) {
      const d = await readCase(who)
      expect(d.effect, who).toBe('deny')
    }
    // case_read_any-style shortcuts do not exist: even a role named like one is just a role label.
    await k.asAdmin(() => seedMembership(db, 'user_case_read_any', ORG, 'case_read_any'))
    expect((await readCase('user_case_read_any')).effect).toBe('deny')
  })

  it('a foreign-organization case is not found, whoever asks', async () => {
    // Asked in the wrong organization: no record, no authority.
    expect((await readCase(U.member, CASE_ORG_B)).effect).toBe('deny')
    // Asked in its own organization, the creator there is allowed, and no principal of ORG reaches it.
    expect((await decide(U.member, 'case:read', 'case', CASE_ORG_B, ORG_B)).effect).toBe('allow')
    expect((await decide(U.president, 'case:read', 'case', CASE_ORG_B, ORG_B)).effect).toBe('deny')
  })

  it('an explicit collaborator row grants exactly the flags it carries', async () => {
    expect((await readCase(U.steward)).effect).toBe('allow')
    expect((await decide(U.steward, 'case:comment', 'case', CASE)).effect).toBe('allow')
    expect((await decide(U.steward, 'case:write', 'case', CASE)).effect).toBe('deny')
    expect((await decide(U.steward, 'case:assign', 'case', CASE)).effect).toBe('deny')
  })

  it('expired, revoked or self-granted collaborator rows grant nothing', async () => {
    const mk = (cols: string) => k.asAdmin(() => db.query(`INSERT INTO public.grievance_case_access_assignments (organization_id, grievance_id, user_id, granted_by, ${cols.split('|')[0]}) VALUES ($1,$2,$3,$4,${cols.split('|')[1]})`, [ORG, CASE, 'x', 'y']))
    void mk
    await k.asAdmin(async () => {
      await db.query(`INSERT INTO public.grievance_case_access_assignments (organization_id, grievance_id, user_id, granted_by, expires_at) VALUES ($1,$2,$3,$4, now() - interval '1 hour')`, [ORG, CASE, U.steward2, U.chief])
      await db.query(`INSERT INTO public.grievance_case_access_assignments (organization_id, grievance_id, user_id, granted_by, status) VALUES ($1,$2,$3,$4,'revoked')`, [ORG, CASE, U.officer, U.chief])
      await db.query(`INSERT INTO public.grievance_case_access_assignments (organization_id, grievance_id, user_id, granted_by) VALUES ($1,$2,$3,$3)`, [ORG, CASE, U.chief])
    })
    expect((await readCase(U.steward2)).effect).toBe('deny')
    expect((await readCase(U.officer)).effect).toBe('deny')
    const self = await readCase(U.chief)
    expect(self.effect).toBe('deny')
    expect(codes(self)).toContain('INSTRUMENT_INVALID')
  })

  it('a collaborator who is not a representative (capacity) is refused', async () => {
    await k.asAdmin(() => db.query(`INSERT INTO public.grievance_case_access_assignments (organization_id, grievance_id, user_id, granted_by) VALUES ($1,$2,$3,$4)`, [ORG, CASE, U.clerk, U.chief]))
    expect(codes(await readCase(U.clerk))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('legal implications make a case privileged: the creator and a plain collaborator cannot read it', async () => {
    await k.asAdmin(async () => {
      await seedMembership(db, 'user_plain_collab', ORG, 'steward')
      await db.query(`INSERT INTO public.grievance_case_access_assignments (organization_id, grievance_id, user_id, granted_by, can_view_private_documents) VALUES ($1,$2,$3,$4,false)`, [ORG, CASE_PRIV, 'user_plain_collab', U.chief])
    })
    expect((await readCase(U.member, CASE_PRIV)).effect).toBe('deny')
    expect((await readCase('user_plain_collab', CASE_PRIV)).effect).toBe('deny')
  })

  it('an explicit privileged-access collaborator can read the privileged case', async () => {
    const d = await readCase(U.steward, CASE_PRIV, 'case:read_privileged')
    expect(d.effect).toBe('allow')
  })

  it('confidential is not privileged: relationships still work, mandates need a confidential ceiling', async () => {
    expect((await readCase(U.member, CASE_CONF)).effect).toBe('allow')
    await k.grantMandate('supervisory', U.officer, ['read'], { scope: { resourceIds: [CASE_CONF] } })
    const denied = await readCase(U.officer, CASE_CONF)
    expect(denied.effect).toBe('deny')
    expect(codes(denied)).toContain('CLASSIFICATION_EXCEEDS_MANDATE')
    await k.grantMandate('supervisory', U.chief, ['read'], { scope: { resourceIds: [CASE_CONF], classificationCeiling: 'confidential' } })
    expect((await readCase(U.chief, CASE_CONF)).effect).toBe('allow')
  })

  it('a change to the record takes effect on the next decision (no cached authority)', async () => {
    expect((await readCase(U.member)).effect).toBe('allow')
    await k.asAdmin(() => db.query(`UPDATE public.grievances SET has_legal_implications = true WHERE id = $1`, [CASE]))
    expect((await readCase(U.member)).effect).toBe('deny')
    await k.asAdmin(() => db.query(`UPDATE public.grievances SET has_legal_implications = false WHERE id = $1`, [CASE]))
    expect((await readCase(U.member)).effect).toBe('allow')
  })

  it('derived relationship ids are deterministic, uuid-shaped and distinct', () => {
    const a = derivedId('creator', CASE, U.member)
    expect(a).toBe(derivedId('creator', CASE, U.member))
    expect(a).not.toBe(derivedId('creator', CASE, U.steward))
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

const DOC_OWN = newUuid() // uploaded by the case creator (team_confidential by default)

describe('classified document access: the case file, the member\'s own submissions and privileged material are separate domains', () => {
  const D = {
    internal: newUuid(), publicInternal: newUuid(), restricted: newUuid(), ownPriv: newUuid(), privileged: newUuid(),
    privOwn: newUuid(), privInternal: newUuid(), orphan: newUuid(), two: newUuid(), bare: newUuid(), foreign: newUuid(),
    unlabelled: newUuid(), stewardUpload: newUuid(),
  }
  const read = (user: string, doc: string, org = ORG) => k.as(user, org)((t) => enforceDocumentRead(t, k.deps, { principalUserId: user, organizationId: org, documentId: doc, authenticated: true }))

  beforeAll(async () => {
    await k.asAdmin(async () => {
      await seedMembership(db, U.member2, ORG, 'member')
      const ins = (id: string, by: string, label: string | null, priv = false, org = ORG) =>
        db.query(`INSERT INTO public.documents (id, organization_id, uploaded_by, privacy_label, contains_legal_privilege) VALUES ($1,$2,$3,$4,$5)`, [id, org, by, label, priv])
      await ins(D.internal, U.officer, 'team_confidential')
      await ins(D.publicInternal, U.officer, 'public_internal')
      await ins(D.restricted, U.officer, 'case_restricted')
      await ins(DOC_OWN, U.member, 'team_confidential')
      await ins(D.ownPriv, U.member, 'team_confidential', true)
      await ins(D.privileged, U.officer, 'privileged')
      await ins(D.privOwn, U.member, 'team_confidential')
      await ins(D.privInternal, U.officer, 'team_confidential')
      await ins(D.orphan, U.officer, 'team_confidential')
      await ins(D.two, U.member, 'team_confidential')
      await ins(D.bare, U.member, 'team_confidential')
      await ins(D.foreign, U.member, 'team_confidential', false, ORG_B)
      await ins(D.unlabelled, U.officer, 'not_a_known_label')
      await ins(D.stewardUpload, U.member2, 'team_confidential')
      const link = (doc: string, type: string, c: string) => db.query(`INSERT INTO public.document_links (document_id, linked_entity_type, linked_entity_id) VALUES ($1,$2,$3)`, [doc, type, c])
      for (const d of [D.internal, D.publicInternal, D.restricted, DOC_OWN, D.ownPriv, D.privileged, D.unlabelled, D.stewardUpload]) await link(d, 'grievance', CASE)
      for (const d of [D.privOwn, D.privInternal]) await link(d, 'grievance', CASE_PRIV)
      await link(D.two, 'grievance', CASE); await link(D.two, 'grievance', CASE_PRIV)
      await link(D.bare, 'case', CASE)
    })
  })

  it('creating the case does not open the union\'s internal or restricted documents to the creator', async () => {
    for (const doc of [D.internal, D.restricted, D.unlabelled]) {
      const d = await read(U.member, doc)
      expect(d.effect, doc).toBe('deny')
    }
  })

  it('a document labelled public_internal is visible to anyone with live case access, including the member', async () => {
    expect((await read(U.member, D.publicInternal)).effect).toBe('allow')
    expect((await read(U.steward, D.publicInternal)).effect).toBe('allow')
    for (const who of [U.president, U.stranger, U.member2]) expect((await read(who, D.publicInternal)).effect, who).toBe('deny')
  })

  it('the member always reads their OWN non-privileged submission, whatever its label', async () => {
    const d = await read(U.member, DOC_OWN)
    expect(d.effect).toBe('allow')
    expect(d.scope.visibility).toBe('member_visible')
    expect(d.reasons.map((r) => r.code)).toContain('ALLOWED_AS_SUBJECT')
  })

  it('uploader identity alone grants nothing: someone who is not the creator, or who uploaded to a case they have no relationship to, is denied', async () => {
    expect((await read(U.member2, D.stewardUpload)).effect).toBe('deny') // uploaded it, no relationship to the case
    expect((await read(U.officer, D.internal)).effect).toBe('deny') // uploaded it, no relationship to the case
  })

  it('own-submission authority is bound to the document, not the case: another document the member did not upload stays closed', async () => {
    expect((await read(U.member, D.stewardUpload)).effect).toBe('deny')
    // And the action cannot be asked for directly with a forged document id.
    const forged = await decide(U.member, 'case:read_own_submission', 'case', CASE, ORG, { documentId: D.internal })
    expect(forged.effect).toBe('deny')
    const none = await decide(U.member, 'case:read_own_submission', 'case', CASE)
    expect(none.effect).toBe('deny')
    const someoneElse = await decide(U.member2, 'case:read_own_submission', 'case', CASE, ORG, { documentId: D.stewardUpload })
    expect(someoneElse.effect).toBe('deny') // uploaded it but holds no creator/represented-member relationship
  })

  it('a privileged document is not an own submission: the creator cannot read it, a privileged-access collaborator is separate', async () => {
    expect((await read(U.member, D.ownPriv)).effect).toBe('deny') // own upload, but flagged legally privileged
    expect((await read(U.member, D.privileged)).effect).toBe('deny')
    expect((await read(U.steward, D.privileged)).effect).toBe('deny') // collaborator on CASE has no private-document grant
  })

  it('a privileged case classification does not erase the member\'s own submissions, but still closes the union file', async () => {
    expect((await read(U.member, D.privOwn)).effect).toBe('allow')
    expect((await read(U.member, D.privInternal)).effect).toBe('deny')
    expect((await read(U.steward, D.privInternal)).effect).toBe('allow') // explicit privileged-access collaborator working the internal file
    expect((await read(U.president, D.privInternal)).effect).toBe('deny')
  })

  it('the representation handler reads the internal file; a read-only collaborator does not', async () => {
    expect((await read(U.steward, D.internal)).effect).toBe('allow') // secondary_lro collaborator
    await k.asAdmin(() => db.query(`INSERT INTO public.grievance_case_access_assignments (organization_id, grievance_id, user_id, granted_by, access_role) VALUES ($1,$2,$3,$4,'read_only')`, [ORG, CASE, U.officer, U.chief]))
    await k.asAdmin(() => seedMembership(db, U.officer, ORG, 'steward'))
    const ro = await read(U.officer, D.internal)
    expect(ro.effect).toBe('deny')
    await k.asAdmin(() => seedMembership(db, U.officer, ORG, 'officer'))
  })

  it('a document with no authoritative case link, two links, or only a bare case link has no basis for access', async () => {
    expect(codes(await read(U.member, D.orphan))).toContain('NO_SOURCE_OF_AUTHORITY')
    expect(codes(await read(U.member, D.two))).toContain('NO_SOURCE_OF_AUTHORITY')
    expect(codes(await read(U.member, D.bare))).toContain('NO_SOURCE_OF_AUTHORITY')
  })

  it('a document in another organization is not found, and a malformed id fails closed', async () => {
    expect(codes(await read(U.member, D.foreign))).toContain('RESOURCE_FACTS_MISSING')
    expect((await read(U.member, 'not-a-uuid')).effect).toBe('deny')
  })

  it('an adverse party or a recused principal loses even their own submission', async () => {
    await k.as(U.member)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: CASE, reason: 'conflict declared' }))
    expect((await read(U.member, DOC_OWN)).effect).toBe('deny')
    const rec = (await k.asAdmin(() => db.query<{ id: string }>(`SELECT id::text id FROM ue_authority_recusals WHERE principal_user_id = $1 AND resource_id = $2`, [U.member, CASE]))).rows[0].id
    await k.as(U.president)((t) => liftRecusal(t, k.deps, { organizationId: ORG, issuerUserId: U.president, recusalId: rec }))
    expect((await read(U.member, DOC_OWN)).effect).toBe('allow')
  })
})
describe('financial workflow: amounts, states and segregation of duties', () => {
  const PAY = newUuid()
  const money = (over: Record<string, unknown> = {}) => ({ scope: { accountIds: [ACCT] }, monetaryLimitMinor: 500_000, currency: 'CAD', ...over })
  const step = (who: string, step: 'registered' | 'prepared' | 'approved' | 'executed' | 'reconciled', pay = PAY, extra: Record<string, unknown> = {}) =>
    k.as(who)((t) => recordFinancialStep(t, k.deps, { organizationId: ORG, actorUserId: who, paymentId: pay, step, ...extra }))
  const state = async (pay = PAY) => {
    const d = await decide(U.treasurer, 'finance:view', 'financial_transaction', pay)
    return d
  }

  beforeAll(async () => {
    await k.asAdmin(() => db.query(`INSERT INTO public.payments (id, organization_id, member_id, amount, currency) VALUES ($1,$2,$3,'1234.50','CAD')`, [PAY, ORG, U.member]))
    await k.grantMandate('financial', U.treasurer, ['view', 'prepare'], money({ approver: U.vp }))
    await k.grantMandate('financial', U.vp, ['approve'], money({ issuer: U.president, approver: U.treasurer }))
    await k.grantMandate('financial', U.president, ['execute'], money({ issuer: U.vp, approver: U.treasurer }))
    await k.grantMandate('financial', T2, ['reconcile'], money({ approver: U.vp }))
  })

  it('exact decimal parsing: no floating point, no exponents, no negatives, no excess precision', () => {
    expect(decimalToMinor('1234.50')).toBe(123450)
    expect(decimalToMinor('0.1')).toBe(10)
    expect(decimalToMinor('1234.5')).toBe(123450)
    expect(decimalToMinor('7')).toBe(700)
    for (const bad of ['1e3', '-1', '1.234', '', 'abc', '99999999999999999.00', '1,000.00']) expect(() => decimalToMinor(bad)).toThrow()
  })

  it('an unregistered payment has no financial facts', async () => {
    expect((await state()).effect).toBe('deny')
  })

  it('registration needs the same authority as preparing: a mandate on that account', async () => {
    await expect(step(U.vp, 'registered', PAY, { accountId: ACCT, requiredApprovals: 1 })).rejects.toThrow(/denied/)
    await expect(step(U.treasurer, 'registered', PAY, { accountId: newUuid(), requiredApprovals: 1 })).rejects.toThrow(/OUT_OF_SCOPE|NO_SOURCE_OF_AUTHORITY/)
    await expect(step(U.treasurer, 'registered', PAY, { accountId: ACCT, requiredApprovals: 0 })).rejects.toThrow(/at least one required approval/)
    await step(U.treasurer, 'registered', PAY, { accountId: ACCT, requiredApprovals: 1 })
    await expect(step(U.treasurer, 'registered', PAY, { accountId: ACCT, requiredApprovals: 1 })).rejects.toThrow(/fin_step_uq/)
  })

  it('steps must follow the order; each needs its own mandate duty; the preparer cannot approve', async () => {
    await expect(step(U.vp, 'approved')).rejects.toThrow(/STATE_NOT_ELIGIBLE/) // not prepared yet
    await expect(step(U.president, 'executed')).rejects.toThrow(/STATE_NOT_ELIGIBLE/)
    await step(U.treasurer, 'prepared')
    await expect(step(U.treasurer, 'approved')).rejects.toThrow(/denied/) // lacks the approve duty, and is the preparer
    await expect(step(U.president, 'approved')).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY|ACTION_NOT_COVERED/) // executor duty only
    await step(U.vp, 'approved')
    await expect(step(U.vp, 'approved')).rejects.toThrow(/denied|SEGREGATION|approver_uq/)
  })

  it('the executor is independent of preparer and approver; the reconciler of everyone', async () => {
    await expect(step(U.vp, 'executed')).rejects.toThrow(/denied/) // approver, and no execute duty
    await step(U.president, 'executed')
    await expect(step(U.treasurer, 'reconciled')).rejects.toThrow(/denied/)
    await step(T2, 'reconciled')
    const events = await k.asAdmin(() => db.query<{ n: string }>(`SELECT count(*)::text n FROM ue_authority_financial_steps WHERE subject_id = $1`, [PAY]))
    expect(Number(events.rows[0].n)).toBe(5)
  })

  it('the database refuses a broken order or a conflicted actor even if the kernel is bypassed', async () => {
    const P2 = newUuid()
    await k.asAdmin(() => db.query(`INSERT INTO public.payments (id, organization_id, member_id, amount, currency) VALUES ($1,$2,$3,'10.00','CAD')`, [P2, ORG, U.member]))
    const raw = (who: string, s: string, reg = false) => k.as(who)(async (t) => {
      await t.query(
        `INSERT INTO ue_authority_financial_steps (organization_id, subject_type, subject_id, step, actor${reg ? ', account_id, required_approvals, amount_minor, currency' : ''})
         VALUES ($1,'payment',$2,$3,$4${reg ? `,$5,1,1000,'CAD'` : ''})`, reg ? [ORG, P2, s, who, ACCT] : [ORG, P2, s, who])
      await auditAuthorityMutation(t, { organizationId: ORG, action: 'test.raw', resourceType: 'ue_authority_financial_steps' })
    })
    await expect(raw(U.treasurer, 'prepared')).rejects.toThrow(/not registered/)
    await raw(U.treasurer, 'registered', true)
    await raw(U.treasurer, 'prepared')
    await expect(raw(U.treasurer, 'approved')).rejects.toThrow(/SEGREGATION_OF_DUTIES/)
    await raw(U.vp, 'approved')
    await expect(raw(U.vp, 'executed')).rejects.toThrow(/SEGREGATION_OF_DUTIES/)
    await expect(raw(U.treasurer, 'executed')).rejects.toThrow(/SEGREGATION_OF_DUTIES/)
    await raw(U.president, 'executed')
    await expect(raw(U.president, 'reconciled')).rejects.toThrow(/SEGREGATION_OF_DUTIES/)
    await expect(raw(U.president, 'voided')).rejects.toThrow(/cannot be voided/)
    await expect(k.as(U.treasurer)((t) => t.query(`UPDATE ue_authority_financial_steps SET actor = 'x' WHERE subject_id = $1`, [P2]))).rejects.toThrow(/append-only|permission denied/)
  })

  it('a changed source amount after registration makes the record contradictory and denies everything', async () => {
    const P3 = newUuid()
    await k.asAdmin(() => db.query(`INSERT INTO public.payments (id, organization_id, member_id, amount, currency) VALUES ($1,$2,$3,'50.00','CAD')`, [P3, ORG, U.member]))
    await step(U.treasurer, 'registered', P3, { accountId: ACCT, requiredApprovals: 1 })
    await step(U.treasurer, 'prepared', P3)
    await k.asAdmin(() => db.query(`UPDATE public.payments SET amount = '5000.00' WHERE id = $1`, [P3]))
    const d = await decide(U.vp, 'finance:approve', 'financial_transaction', P3)
    expect(d.effect).toBe('deny')
    expect(d.reasons.map((r) => r.detail).join(' ')).toMatch(/changed after registration/)
    await k.asAdmin(() => db.query(`UPDATE public.payments SET amount = '50.00', currency = 'USD' WHERE id = $1`, [P3]))
    expect((await decide(U.vp, 'finance:approve', 'financial_transaction', P3)).effect).toBe('deny')
  })

  it('the mandate limit applies to the amount on record', async () => {
    const P4 = newUuid()
    await k.asAdmin(() => db.query(`INSERT INTO public.payments (id, organization_id, member_id, amount, currency) VALUES ($1,$2,$3,'5000.01','CAD')`, [P4, ORG, U.member]))
    await expect(step(U.treasurer, 'registered', P4, { accountId: ACCT, requiredApprovals: 1 })).rejects.toThrow(/AMOUNT_EXCEEDS_LIMIT/)
  })

  it('a payee who holds financial duties cannot act on their own payment', async () => {
    const P5 = newUuid()
    await k.asAdmin(() => db.query(`INSERT INTO public.payments (id, organization_id, member_id, amount, currency) VALUES ($1,$2,$3,'20.00','CAD')`, [P5, ORG, U.treasurer]))
    await expect(step(U.treasurer, 'registered', P5, { accountId: ACCT, requiredApprovals: 1 })).rejects.toThrow(/ADVERSE_PARTY/)
  })

  it('a payment of another organization is not found', async () => {
    expect((await decide(U.treasurer, 'finance:view', 'financial_transaction', PAY, ORG_B)).effect).toBe('deny')
  })
})

describe('governance review register and WorkAid referral', () => {
  it('any active member opens a review; opening confers no authority; adverse parties are excluded', async () => {
    const adverseReviewer = U.reviewer
    const review = await k.as(U.member)((t) => registerReview(t, k.deps, { organizationId: ORG, openedBy: U.member, reviewType: 'complaint', complainantUserId: U.member, adverseUserIds: [adverseReviewer] }))
    expect((await decide(U.member, 'review:monitor', 'governance_review', review)).effect).toBe('deny')
    await expect(k.as(U.stranger)((t) => registerReview(t, k.deps, { organizationId: ORG, openedBy: U.stranger, reviewType: 'complaint' }))).rejects.toThrow(/only an active member/)
    await k.grantMandate('governance_review', U.auditor, ['monitor'], { scope: { resourceIds: [review] } })
    expect((await decide(U.auditor, 'review:monitor', 'governance_review', review)).effect).toBe('allow')
    await k.grantMandate('governance_review', adverseReviewer, ['monitor'], { scope: { resourceIds: [review] } })
    const d = await decide(adverseReviewer, 'review:monitor', 'governance_review', review)
    expect(d.effect).toBe('deny')
    expect(codes(d)).toContain('ADVERSE_PARTY')
    // Powers are independent: a monitor cannot enforce or issue findings.
    expect((await decide(U.auditor, 'review:enforce', 'governance_review', review)).effect).toBe('deny')
    expect((await decide(U.auditor, 'review:issue_finding', 'governance_review', review)).effect).toBe('deny')
  })

  it('referral needs a live owner/assignee relationship AND live member consent naming the categories', async () => {
    const matter = newUuid()
    await k.asAdmin(() => seedMembership(db, 'user_assignee', ORG, 'steward'))
    await k.as(U.president)((t) => insertRelationship(t, { organizationId: ORG, principalUserId: 'user_assignee', resourceType: 'case', resourceId: CASE, relation: 'assignee', origin: 'derived', effectiveAt: minutesAgo() }))
    const refer = (cats: string[]) => k.as('user_assignee')((t) => referToWorkAid(t, k.deps, { organizationId: ORG, referrerUserId: 'user_assignee', caseId: CASE, memberUserId: U.member, categories: cats, matterId: matter }))
    await expect(refer(['status'])).rejects.toThrow(/CONSENT_REQUIRED/)
    await k.as(U.member)((t) => insertConsent(t, { organizationId: ORG, memberUserId: U.member, matterId: matter, direction: 'union_to_workaid', issuer: 'member', issuedBy: U.member, categories: ['status'], purpose: 'legal referral', grantedAt: minutesAgo(), expiresAt: daysAhead(30) }))
    await expect(refer(['status', 'medical'])).rejects.toThrow(/CONSENT_SCOPE_EXCEEDED/)
    await expect(refer(['*'])).rejects.toThrow(/CONSENT_SCOPE_EXCEEDED/)
    await expect(k.as(U.steward)((t) => referToWorkAid(t, k.deps, { organizationId: ORG, referrerUserId: U.steward, caseId: CASE, memberUserId: U.member, categories: ['status'], matterId: matter }))).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY/)
    expect(await refer(['status'])).toBe(matter)
    // One live referral per case, enforced by the database even if the kernel is bypassed.
    await expect(k.as('user_assignee')(async (t) => {
      await t.query(`INSERT INTO ue_authority_workaid_matters (organization_id, member_user_id, case_id, referred_by) VALUES ($1,$2,$3,$4)`, [ORG, U.member, CASE, 'user_assignee'])
      await auditAuthorityMutation(t, { organizationId: ORG, action: 'test.raw', resourceType: 'ue_authority_workaid_matters' })
    })).rejects.toThrow(/workaid_case_uq/)
  })

  it('after counsel accepts, privileged reads are refused for everyone and counsel material is unreachable', async () => {
    const m = (await k.asAdmin(() => db.query<{ id: string }>(`SELECT id::text id FROM ue_authority_workaid_matters WHERE case_id = $1`, [CASE]))).rows[0].id
    expect((await readCase(U.member)).effect).toBe('allow')
    const accept = (as: string, deps: Parameters<typeof recordCounselAcceptance>[1]) => k.as(as)((t) => recordCounselAcceptance(t, deps, { organizationId: ORG, matterId: m }))
    // Impersonation: no actor can be supplied, and a union principal can never satisfy the counsel check.
    await expect(accept(U.president, k.deps)).rejects.toThrow(/COUNSEL_NOT_VERIFIABLE/)
    await expect(accept(U.counsel, k.deps)).rejects.toThrow(/COUNSEL_NOT_VERIFIABLE/) // even real counsel, with no verifier configured
    await expect(accept(U.president, withCounsel)).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    await expect(accept(U.member, withCounsel)).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    await expect(accept('user_assignee', withCounsel)).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    // The database refuses the same forgery without the TypeScript layer.
    await expect(k.as(U.president)((t) => t.query(`UPDATE ue_authority_workaid_matters SET counsel_accepted_at = now(), counsel_accepted_by = $2 WHERE id = $1`, [m, U.counsel]))).rejects.toThrow(/ACTOR_NOT_SESSION/)
    await expect(k.as(U.member)((t) => t.query(`UPDATE ue_authority_workaid_matters SET counsel_accepted_at = now(), counsel_accepted_by = $2 WHERE id = $1`, [m, U.member]))).rejects.toThrow(/acceptor_chk/)
    expect((await k.asAdmin(() => db.query(`SELECT 1 FROM ue_authority_workaid_matters WHERE id = $1 AND counsel_accepted_at IS NOT NULL`, [m]))).rows).toHaveLength(0)
    await accept(U.counsel, withCounsel)
    await expect(accept(U.counsel, withCounsel)).rejects.toThrow(/no un-accepted/)
    const rec = (await k.asAdmin(() => db.query<{ counsel_accepted_by: string }>(`SELECT counsel_accepted_by FROM ue_authority_workaid_matters WHERE id = $1`, [m]))).rows[0]
    expect(rec.counsel_accepted_by).toBe(U.counsel)
    for (const who of [U.member, U.steward, 'user_assignee', U.president]) {
      const d = await readCase(who, CASE, 'case:read_privileged')
      expect(d.effect, who).toBe('deny')
      expect(codes(d), who).toContain('COUNSEL_CONTROLLED')
    }
    // The union's own case file is unchanged: authority over counsel's content is what is removed, not the member's file.
    expect((await readCase(U.member)).effect).toBe('allow')
    for (const who of [U.president, 'user_assignee', U.member]) {
      expect((await decide(who, 'workaid:read_counsel_material', 'workaid_matter', m, ORG, { categories: ['status'] })).effect).toBe('deny')
    }
  })

  it('a counsel-issued disclosure naming the recipient allows receipt, only to that recipient and only for its categories', async () => {
    const m = (await k.asAdmin(() => db.query<{ id: string }>(`SELECT id::text id FROM ue_authority_workaid_matters WHERE case_id = $1`, [CASE]))).rows[0].id
    const disclosure = { organizationId: ORG, memberUserId: U.member, matterId: m, direction: 'workaid_to_union' as const, issuer: 'counsel' as const, categories: ['status'], recipientUserId: 'user_assignee', purpose: 'update', grantedAt: minutesAgo(), expiresAt: daysAhead(5) }
    // A union officer cannot author a counsel disclosure, by naming counsel or by naming themself.
    await expect(k.as(U.president)((t) => insertConsent(t, { ...disclosure, issuedBy: U.counsel }, withCounsel))).rejects.toThrow(/ACTOR_NOT_SESSION/)
    await expect(k.as(U.president)((t) => insertConsent(t, { ...disclosure, issuedBy: U.president }, withCounsel))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    await expect(k.as(U.counsel)((t) => insertConsent(t, { ...disclosure, issuedBy: U.counsel }))).rejects.toThrow(/COUNSEL_NOT_VERIFIABLE/)
    await expect(k.as(U.president)((t) => t.query(
      `INSERT INTO ue_authority_disclosure_consents (organization_id, member_user_id, matter_id, direction, issuer, issued_by, categories, recipient_user_id, purpose, granted_at, expires_at)
       VALUES ($1,$2,$3,'workaid_to_union','counsel',$4,ARRAY['status'],'user_assignee','forged', now(), now() + interval '1 day')`, [ORG, U.member, m, U.counsel]))).rejects.toThrow(/ACTOR_NOT_SESSION/)
    const d = await k.as(U.counsel)((t) => insertConsent(t, { ...disclosure, issuedBy: U.counsel }, withCounsel))
    const recv = (who: string, cats: string[]) => decide(who, 'workaid:receive_disclosure', 'workaid_matter', m, ORG, { categories: cats, disclosureId: d })
    expect((await recv('user_assignee', ['status'])).effect).toBe('allow')
    expect((await recv('user_assignee', ['medical'])).effect).toBe('deny')
    expect((await recv(U.president, ['status'])).effect).toBe('deny')
  })
})
