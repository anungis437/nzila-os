import { describe, expect, it } from 'vitest'
import { COUNSEL_AUDIENCE, validateCounselAssertion, type CounselAssertion } from '../counsel-boundary'

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
