import { describe, expect, it } from 'vitest'
import {
  authenticateCounselAssertion,
  COUNSEL_AUDIENCE,
  evaluateCounselCapacity,
  validateCounselAssertion,
  type CounselAssertion,
  type CounselConflictFacts,
  type CounselEngagement,
} from '../counsel-boundary'

const NOW = new Date('2026-10-24T12:00:00Z')
const ORG = '00000000-0000-4000-8000-00000000000a'
const MATTER = '00000000-0000-4000-8000-0000000000e1'
const expected = { allowedIssuers: ['counsel-gateway'], organizationId: ORG, matterId: MATTER, now: NOW }
const base = (over: Partial<CounselAssertion> = {}): CounselAssertion => ({
  issuer: 'counsel-gateway', audience: COUNSEL_AUDIENCE, subject: 'counsel-0001', organizationId: ORG, matterId: MATTER,
  nonce: 'n-0123456789abcdef', issuedAt: new Date(NOW.getTime() - 30_000), expiresAt: new Date(NOW.getTime() + 120_000), ...over,
})
const check = (over: Partial<CounselAssertion> = {}, used: string[] = [], exp = expected) => validateCounselAssertion(base(over), exp, new Set(used))

describe('counsel assertion envelope', () => {
  it('accepts a fresh, single-use assertion bound to this organization and matter', () => {
    expect(check()).toEqual({ ok: true, subject: 'counsel-0001' })
  })

  it('refuses an unknown issuer, no allowed issuers at all, and a wrong audience', () => {
    expect(check({ issuer: 'union-admin-console' })).toMatchObject({ ok: false })
    expect(check({}, [], { ...expected, allowedIssuers: [] })).toMatchObject({ ok: false })
    expect(check({ audience: 'union-eyes/admin' })).toMatchObject({ ok: false, reason: 'wrong audience' })
  })

  it('refuses another organization or another matter (no cross-tenant or cross-matter replay)', () => {
    expect(check({ organizationId: '00000000-0000-4000-8000-00000000000b' })).toMatchObject({ ok: false, reason: 'bound to a different organization' })
    expect(check({ matterId: '00000000-0000-4000-8000-0000000000e2' })).toMatchObject({ ok: false, reason: 'bound to a different matter' })
  })

  it('refuses replay, a weak nonce, expiry, future issue and an over-long lifetime', () => {
    expect(check({}, ['n-0123456789abcdef'])).toMatchObject({ ok: false, reason: 'nonce already used' })
    expect(check({ nonce: 'short' })).toMatchObject({ ok: false })
    expect(check({ expiresAt: new Date(NOW.getTime() - 1) })).toMatchObject({ ok: false, reason: 'expired' })
    expect(check({ issuedAt: new Date(NOW.getTime() + 10 * 60_000), expiresAt: new Date(NOW.getTime() + 11 * 60_000) })).toMatchObject({ ok: false, reason: 'issued in the future' })
    expect(check({ issuedAt: new Date(NOW.getTime() - 60 * 60_000), expiresAt: new Date(NOW.getTime() + 60_000) })).toMatchObject({ ok: false, reason: 'lifetime exceeds the maximum' })
    expect(check({ issuedAt: new Date('nope'), expiresAt: new Date(NOW.getTime() + 1000) })).toMatchObject({ ok: false })
  })

  it('refuses a subject that is not a valid principal id', () => {
    for (const subject of ['', ' padded ', 'with\nnewline']) expect(check({ subject })).toMatchObject({ ok: false, reason: 'subject is not a valid principal id' })
    expect(validateCounselAssertion(undefined as never, expected, new Set())).toMatchObject({ ok: false })
  })
})

describe('authenticateCounselAssertion', () => {
  const nonces = () => {
    const seen = new Set<string>()
    return { consume: async (n: string) => (seen.has(n) ? false : (seen.add(n), true)) }
  }
  const good = { verifySignature: async () => true }

  it('accepts once and refuses the replay', async () => {
    const store = nonces()
    expect(await authenticateCounselAssertion(base(), expected, { verifier: good, nonces: store })).toEqual({ ok: true, subject: 'counsel-0001' })
    expect(await authenticateCounselAssertion(base(), expected, { verifier: good, nonces: store })).toMatchObject({ ok: false, reason: 'nonce already used' })
  })

  it('fails closed without a verifier or a nonce store, on a bad signature and on a thrown error', async () => {
    expect(await authenticateCounselAssertion(base(), expected, { nonces: nonces() })).toMatchObject({ ok: false })
    expect(await authenticateCounselAssertion(base(), expected, { verifier: good })).toMatchObject({ ok: false })
    expect(await authenticateCounselAssertion(base(), expected, { verifier: { verifySignature: async () => false }, nonces: nonces() })).toMatchObject({ ok: false, reason: 'signature did not verify' })
    expect(await authenticateCounselAssertion(base(), expected, { verifier: { verifySignature: async () => { throw new Error('kms down') } }, nonces: nonces() })).toMatchObject({ ok: false })
    expect(await authenticateCounselAssertion(base(), expected, { verifier: good, nonces: { consume: async () => { throw new Error('db down') } } })).toMatchObject({ ok: false })
  })

  it('does not burn the nonce of an assertion that failed validation or signature', async () => {
    const store = nonces()
    await authenticateCounselAssertion(base({ audience: 'wrong' }), expected, { verifier: good, nonces: store })
    await authenticateCounselAssertion(base(), expected, { verifier: { verifySignature: async () => false }, nonces: store })
    expect(await authenticateCounselAssertion(base(), expected, { verifier: good, nonces: store })).toMatchObject({ ok: true })
  })
})

describe('evaluateCounselCapacity', () => {
  const org = ORG
  const facts = (over: Partial<CounselConflictFacts> = {}): CounselConflictFacts => ({
    userId: 'lawyer', memberUserId: 'member', referrerUserId: 'referrer', adverseUserIds: [], unionCapacities: [], holdsLiveMandate: false, hasCaseRelationship: false, ...over,
  })
  const eng = (over: Partial<CounselEngagement> = {}): CounselEngagement => ({
    engagementId: 'e', organizationId: org, matterId: MATTER, counselUserId: 'lawyer', capacity: 'member_counsel', informationBarrier: true,
    effectiveAt: new Date(NOW.getTime() - 1000), expiresAt: null, revokedAt: null, ...over,
  })
  const run = (f: CounselConflictFacts, e: CounselEngagement | null) => evaluateCounselCapacity(f, e, org, MATTER, NOW)

  it('clears external counsel with no union membership', () => {
    expect(run(facts(), null)).toEqual({ ok: true, capacity: 'external_counsel' })
    expect(run(facts(), eng({ revokedAt: NOW }))).toMatchObject({ ok: false, code: 'COUNSEL_ENGAGEMENT_INVALID' })
  })

  it('refuses the member, the referrer and an adverse party whatever else is true', () => {
    expect(run(facts({ userId: 'member' }), eng({ counselUserId: 'member' }))).toMatchObject({ code: 'COUNSEL_IS_PARTY' })
    expect(run(facts({ userId: 'referrer' }), null)).toMatchObject({ code: 'COUNSEL_IS_PARTY' })
    expect(run(facts({ adverseUserIds: ['lawyer'] }), null)).toMatchObject({ code: 'COUNSEL_ADVERSE' })
  })

  it('does not exclude a plain member, but requires a live matter-bound member-counsel engagement with a barrier', () => {
    const member = facts({ unionCapacities: ['member'] })
    expect(run(member, eng())).toEqual({ ok: true, capacity: 'member_counsel' })
    expect(run(member, null)).toMatchObject({ code: 'COUNSEL_NEEDS_SEPARATE_CAPACITY' })
    expect(run(member, eng({ capacity: 'external_counsel' }))).toMatchObject({ code: 'COUNSEL_NEEDS_SEPARATE_CAPACITY' })
    expect(run(member, eng({ matterId: 'other' }))).toMatchObject({ code: 'COUNSEL_NEEDS_SEPARATE_CAPACITY' })
    expect(run(member, eng({ counselUserId: 'someone-else' }))).toMatchObject({ code: 'COUNSEL_NEEDS_SEPARATE_CAPACITY' })
    expect(run(member, eng({ effectiveAt: new Date(NOW.getTime() + 1000) }))).toMatchObject({ code: 'COUNSEL_NEEDS_SEPARATE_CAPACITY' })
    expect(run(member, eng({ expiresAt: NOW }))).toMatchObject({ code: 'COUNSEL_NEEDS_SEPARATE_CAPACITY' })
    expect(run(member, eng({ informationBarrier: false }))).toMatchObject({ code: 'COUNSEL_NO_INFORMATION_BARRIER' })
  })

  it('refuses a member whose union role, mandate or case relationship conflicts, even with a good engagement', () => {
    expect(run(facts({ unionCapacities: ['member', 'steward'] }), eng())).toMatchObject({ code: 'COUNSEL_CONFLICTING_CAPACITY' })
    expect(run(facts({ unionCapacities: ['auditor'] }), eng())).toMatchObject({ code: 'COUNSEL_CONFLICTING_CAPACITY' })
    expect(run(facts({ unionCapacities: ['member'], holdsLiveMandate: true }), eng())).toMatchObject({ code: 'COUNSEL_HOLDS_UNION_MANDATE' })
    expect(run(facts({ unionCapacities: ['member'], hasCaseRelationship: true }), eng())).toMatchObject({ code: 'COUNSEL_CASE_RELATIONSHIP' })
  })
})
