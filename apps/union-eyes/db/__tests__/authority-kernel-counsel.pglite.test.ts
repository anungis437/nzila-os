/**
 * Counsel engagement register, durable nonce store and assertion-backed verifier, against the real migrations.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, ORG_B, seedMembership, U } from './authority-kernel-harness'
import { freshDb, kit, minutesAgo, daysAhead } from './authority-kernel-testkit'
import { COUNSEL_AUDIENCE, type CounselAssertion } from '../../lib/authority/counsel-boundary'
import { auditAuthorityMutation } from '../../lib/authority/store/audit'
import { requireCounselSession } from '../../lib/authority/store/enforce'
import {
  createAssertionBackedCounselVerifier,
  createDurableNonceStore,
  loadCounselEngagement,
  recordCounselEngagement,
  revokeCounselEngagement,
} from '../../lib/authority/store/counsel'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>
const CASE = newUuid()
const MATTER = newUuid()
const ISSUER = 'counsel-gateway'
const LAWYER = U.counsel // external: no membership
const MEMBER_LAWYER = U.member2 // plain member acting in a separate capacity

const engage = (over: Partial<Parameters<typeof recordCounselEngagement>[2]> = {}, recorder = U.vp, deps = k.deps) =>
  k.as(recorder)((t) =>
    recordCounselEngagement(t, deps, {
      organizationId: ORG, recorderUserId: recorder, matterId: MATTER, counselUserId: LAWYER, capacity: 'external_counsel',
      informationBarrier: false, effectiveAt: minutesAgo(10), expiresAt: daysAhead(30), ...over,
    }),
  )

const session = (user: string, counsel: Parameters<typeof requireCounselSession>[1]['counsel']) =>
  k.as(user)((t) => requireCounselSession(t, { memberships: k.deps.memberships, counsel }, { organizationId: ORG, matterId: MATTER, claimedUserId: user }))

const withRegister = (vouch: string) => ({
  isCounselFor: async (_e: unknown, i: { userId: string }) => i.userId === vouch,
  engagement: (e: Parameters<typeof loadCounselEngagement>[0], i: { organizationId: string; matterId: string; userId: string }) => loadCounselEngagement(e, i),
})

const assertion = (over: Partial<CounselAssertion> = {}): CounselAssertion => ({
  issuer: ISSUER, audience: COUNSEL_AUDIENCE, subject: LAWYER, organizationId: ORG, matterId: MATTER,
  nonce: `nonce-${newUuid()}`, issuedAt: new Date(Date.now() - 30_000), expiresAt: new Date(Date.now() + 120_000), ...over,
})

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(async () => {
    await seedMembership(db, MEMBER_LAWYER, ORG, 'member')
    await db.query(`INSERT INTO public.grievances (id, organization_id, created_by, has_legal_implications, is_confidential) VALUES ($1,$2,$3,false,false)`, [CASE, ORG, U.member])
  })
  await k.adoptDefaultRules()
  await k.grantOffice(U.vp, U.president, U.treasurer)
  await k.as(U.steward)(async (t) => {
    await t.query(`INSERT INTO ue_authority_workaid_matters (id, organization_id, member_user_id, case_id, referred_by, referred_categories) VALUES ($1,$2,$3,$4,$5,ARRAY['status']::text[])`, [MATTER, ORG, U.member, CASE, U.steward])
    await auditAuthorityMutation(t, { organizationId: ORG, action: 'test.raw', resourceType: 'ue_authority_workaid_matters', resourceId: MATTER })
  })
})

describe('engagement register', () => {
  it('only an active executive with a live office mandate may record one', async () => {
    await expect(engage({}, U.steward)).rejects.toThrow(/ENGAGEMENT_RECORDER_NOT_AUTHORIZED/)
    await expect(engage({}, U.president)).rejects.toThrow(/ENGAGEMENT_RECORDER_NOT_AUTHORIZED/) // executive capacity, no office mandate
  })

  it('the database refuses parties, a member without a barrier or term, a bad term and a foreign matter', async () => {
    await expect(engage({ counselUserId: U.member })).rejects.toThrow(/ENGAGEMENT_PARTY_CONFLICT/)
    await expect(engage({ counselUserId: U.steward })).rejects.toThrow(/ENGAGEMENT_PARTY_CONFLICT/) // the referrer
    await expect(engage({ counselUserId: U.vp })).rejects.toThrow(/ENGAGEMENT_PARTY_CONFLICT|recorder_chk/)
    await expect(engage({ counselUserId: MEMBER_LAWYER, capacity: 'member_counsel', informationBarrier: false })).rejects.toThrow(/member_chk/)
    await expect(engage({ counselUserId: MEMBER_LAWYER, capacity: 'member_counsel', informationBarrier: true, expiresAt: null })).rejects.toThrow(/member_chk/)
    await expect(engage({ expiresAt: minutesAgo(60) })).rejects.toThrow(/term_chk/)
    await expect(engage({ matterId: newUuid() })).rejects.toThrow(/foreign key|ENGAGEMENT_MATTER_INVALID/)
    await expect(k.as(U.vp, ORG_B)((t) => recordCounselEngagement(t, k.deps, {
      organizationId: ORG_B, recorderUserId: U.vp, matterId: MATTER, counselUserId: LAWYER, capacity: 'external_counsel', informationBarrier: false, effectiveAt: minutesAgo(1),
    }))).rejects.toThrow()
  })

  it('without an engagement a registered verifier refuses even real, vouched counsel', async () => {
    await expect(session(LAWYER, withRegister(LAWYER))).rejects.toThrow(/COUNSEL_ENGAGEMENT_REQUIRED/)
  })

  it('records an engagement, clears external counsel, then revocation ends it at once', async () => {
    const id = await engage()
    expect(await session(LAWYER, withRegister(LAWYER))).toBe(LAWYER)
    await expect(engage()).rejects.toThrow(/engagement_live_uq/) // one live engagement per counsel and matter
    await expect(k.as(U.steward)((t) => revokeCounselEngagement(t, k.deps, { organizationId: ORG, revokerUserId: U.steward, engagementId: id }))).rejects.toThrow(/ENGAGEMENT_RECORDER_NOT_AUTHORIZED/)
    await k.as(U.vp)((t) => revokeCounselEngagement(t, k.deps, { organizationId: ORG, revokerUserId: U.vp, engagementId: id }))
    await expect(session(LAWYER, withRegister(LAWYER))).rejects.toThrow(/COUNSEL_ENGAGEMENT_INVALID/)
    await expect(k.as(U.vp)((t) => revokeCounselEngagement(t, k.deps, { organizationId: ORG, revokerUserId: U.vp, engagementId: id }))).rejects.toThrow(/no live engagement/)
  })

  it('a revoked row is terminal and its other columns are immutable, even for raw SQL', async () => {
    const id = (await k.asAdmin(() => db.query<{ id: string }>(`SELECT id::text id FROM ue_authority_counsel_engagements WHERE counsel_user_id = $1`, [LAWYER]))).rows[0].id
    await expect(k.as(U.vp)((t) => t.query(`UPDATE ue_authority_counsel_engagements SET revoked_at = NULL, revoked_by = NULL WHERE id = $1`, [id]))).rejects.toThrow(/terminal/)
    const fresh = await engage()
    await expect(k.as(U.vp)((t) => t.query(`UPDATE ue_authority_counsel_engagements SET capacity = 'member_counsel' WHERE id = $1`, [fresh]))).rejects.toThrow(/may only change/)
    await expect(k.as(U.vp)((t) => t.query(`UPDATE ue_authority_counsel_engagements SET revoked_at = now(), revoked_by = $2 WHERE id = $1`, [fresh, U.president]))).rejects.toThrow(/ACTOR_NOT_SESSION/)
  })

  it('a plain member acts as counsel only through a member-counsel engagement with a barrier', async () => {
    await expect(session(MEMBER_LAWYER, withRegister(MEMBER_LAWYER))).rejects.toThrow(/COUNSEL_NEEDS_SEPARATE_CAPACITY/)
    await engage({ counselUserId: MEMBER_LAWYER, capacity: 'member_counsel', informationBarrier: true })
    expect(await session(MEMBER_LAWYER, withRegister(MEMBER_LAWYER))).toBe(MEMBER_LAWYER)
  })
})

describe('durable nonce store', () => {
  const consume = (nonce: string, org = ORG, user = LAWYER) =>
    k.as(user, org)((t) => createDurableNonceStore(t, { organizationId: org, matterId: MATTER, consumedBy: user }).consume(nonce, new Date(Date.now() + 60_000)))

  it('accepts a nonce once, atomically refuses the replay, and stores only a hash', async () => {
    expect(await consume('n-aaaaaaaaaaaaaaaaaaaa')).toBe(true)
    expect(await consume('n-aaaaaaaaaaaaaaaaaaaa')).toBe(false)
    const rows = (await k.asAdmin(() => db.query<{ nonce_hash: string }>(`SELECT nonce_hash FROM ue_authority_counsel_nonces`))).rows
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r.nonce_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rows.map((r) => r.nonce_hash)).not.toContain('n-aaaaaaaaaaaaaaaaaaaa')
  })

  it('the unique index, not application code, is the replay control', async () => {
    const hash = 'a'.repeat(64)
    const raw = () => k.as(LAWYER)(async (t) => {
      await t.query(`INSERT INTO ue_authority_counsel_nonces (organization_id, matter_id, nonce_hash, consumed_by, expires_at) VALUES ($1,$2,$3,$4, now() + interval '1 minute')`, [ORG, MATTER, hash, LAWYER])
      await auditAuthorityMutation(t, { organizationId: ORG, action: 'test.raw', resourceType: 'ue_authority_counsel_nonces' })
    })
    await raw()
    await expect(raw()).rejects.toThrow(/nonce_uq/)
    await expect(k.as(LAWYER)((t) => t.query(`INSERT INTO ue_authority_counsel_nonces (organization_id, matter_id, nonce_hash, consumed_by, expires_at) VALUES ($1,$2,'not-a-hash',$3, now())`, [ORG, MATTER, LAWYER]))).rejects.toThrow(/nonce_hash_chk/)
  })

  it('a nonce is scoped to the organization, and the register is append-only', async () => {
    expect(await consume('n-cccccccccccccccccccc', ORG_B)).toBe(true)
    expect(await consume('n-cccccccccccccccccccc', ORG)).toBe(true)
    await expect(k.as(U.vp)((t) => t.query(`UPDATE ue_authority_counsel_nonces SET expires_at = now() + interval '1 year'`))).rejects.toThrow(/append-only|permission denied/)
    await expect(k.as(U.vp)((t) => t.query(`DELETE FROM ue_authority_counsel_nonces`))).rejects.toThrow(/append-only|permission denied/)
  })

  it('a rolled-back authorization does not burn the nonce', async () => {
    await expect(k.as(LAWYER)(async (t) => {
      await createDurableNonceStore(t, { organizationId: ORG, matterId: MATTER, consumedBy: LAWYER }).consume('n-dddddddddddddddddddd', new Date(Date.now() + 60_000))
      throw new Error('later step refused')
    })).rejects.toThrow(/later step refused/)
    expect(await consume('n-dddddddddddddddddddd')).toBe(true)
  })
})

describe('assertion-backed counsel verification', () => {
  const sig = { verifySignature: async () => true }
  const verifierFor = (a: CounselAssertion, signatureVerifier: typeof sig | null = sig) =>
    createAssertionBackedCounselVerifier({ assertion: a, allowedIssuers: [ISSUER], signatureVerifier: signatureVerifier ?? undefined })

  it('a valid signed assertion for exactly this counsel authorizes once; the replay is refused', async () => {
    const a = assertion()
    expect(await session(LAWYER, verifierFor(a))).toBe(LAWYER)
    await expect(session(LAWYER, verifierFor(a))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
  })

  it('fails closed with no signature verifier, a bad signature, a wrong subject, matter, issuer or audience', async () => {
    await expect(session(LAWYER, verifierFor(assertion(), null))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    await expect(session(LAWYER, verifierFor(assertion(), { verifySignature: async () => false }))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    await expect(session(LAWYER, verifierFor(assertion({ subject: U.president })))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    await expect(session(LAWYER, verifierFor(assertion({ matterId: newUuid() })))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    await expect(session(LAWYER, verifierFor(assertion({ issuer: 'union-admin-console' })))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
    await expect(session(LAWYER, verifierFor(assertion({ audience: 'union-eyes/admin' })))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
  })

  it('a union administrator holding a genuine assertion for someone else cannot become counsel', async () => {
    await expect(session(U.vp, verifierFor(assertion()))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
  })
})
