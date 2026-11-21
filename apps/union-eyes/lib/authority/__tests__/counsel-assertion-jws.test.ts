import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { authenticateCounselAssertion, COUNSEL_AUDIENCE } from '../counsel-boundary'
import {
  COUNSEL_ASSERTION_JWS_TYPE, createCounselIssuerRegistry, parseCounselIssuerRegistry, verifyCounselAssertionJws,
  type CounselSigningAlgorithm,
} from '../counsel-assertion-jws'

const ISSUER = 'https://counsel.example.test'
const ORG = '0b7c5a3e-1f2d-4c3b-9a8e-0000000000c1'
const MATTER = '0b7c5a3e-1f2d-4c3b-9a8e-0000000000c2'
const SUBJECT = 'counsel-subject-0001'
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const ed = generateKeyPairSync('ed25519')
const other = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const pub = (k: KeyObject) => k.export({ format: 'jwk' })

const registry = createCounselIssuerRegistry([
  { issuer: ISSUER, kid: 'ec-1', alg: 'ES256', publicJwk: pub(ec.publicKey) },
  { issuer: ISSUER, kid: 'ed-1', alg: 'EdDSA', publicJwk: pub(ed.publicKey) },
])

function token(over: { claims?: Record<string, unknown>; header?: Record<string, unknown>; key?: KeyObject; alg?: CounselSigningAlgorithm } = {}) {
  const alg = over.alg ?? 'ES256'
  const now = Math.floor(Date.now() / 1000)
  const header = { alg, typ: COUNSEL_ASSERTION_JWS_TYPE, kid: alg === 'ES256' ? 'ec-1' : 'ed-1', ...over.header }
  const claims = { iss: ISSUER, aud: COUNSEL_AUDIENCE, sub: SUBJECT, org: ORG, matter: MATTER, nonce: 'n-0123456789abcdef', iat: now - 5, exp: now + 120, ...over.claims }
  const input = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`
  const key = over.key ?? (alg === 'ES256' ? ec.privateKey : ed.privateKey)
  const signature = alg === 'ES256' ? sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }) : sign(null, Buffer.from(input), key)
  return `${input}.${signature.toString('base64url')}`
}

describe('counsel assertion JWS verification', () => {
  it('verifies ES256 and EdDSA tokens from a registered issuer and maps the claims onto the assertion', () => {
    for (const alg of ['ES256', 'EdDSA'] as const) {
      const out = verifyCounselAssertionJws(token({ alg }), registry)
      expect(out.ok).toBe(true)
      if (out.ok) expect(out.assertion).toMatchObject({ issuer: ISSUER, audience: COUNSEL_AUDIENCE, subject: SUBJECT, organizationId: ORG, matterId: MATTER })
    }
  })

  it('refuses a forged signature, a foreign key, a tampered payload, an unregistered issuer or kid, and an algorithm swap', () => {
    expect(verifyCounselAssertionJws(token({ key: other.privateKey }), registry)).toMatchObject({ ok: false, reason: 'signature did not verify' })
    const [h, , s] = token().split('.')
    const tampered = `${h}.${Buffer.from(JSON.stringify({ iss: ISSUER, aud: COUNSEL_AUDIENCE, sub: 'attacker', org: ORG, matter: MATTER, nonce: 'n-0123456789abcdef', iat: 1, exp: 2 })).toString('base64url')}.${s}`
    expect(verifyCounselAssertionJws(tampered, registry).ok).toBe(false)
    expect(verifyCounselAssertionJws(token({ claims: { iss: 'https://union-admin.example.test' } }), registry)).toMatchObject({ ok: false, reason: 'issuer key is not registered' })
    expect(verifyCounselAssertionJws(token({ header: { kid: 'unknown' } }), registry)).toMatchObject({ ok: false, reason: 'issuer key is not registered' })
    expect(verifyCounselAssertionJws(token({ header: { kid: 'ed-1' } }), registry)).toMatchObject({ ok: false, reason: 'algorithm does not match the registered key' })
    expect(verifyCounselAssertionJws(token({ header: { alg: 'none' } }), registry).ok).toBe(false)
    expect(verifyCounselAssertionJws(token({ header: { alg: 'HS256' } }), registry).ok).toBe(false)
  })

  it('refuses a wrong token type, an embedded or remote key, incomplete claims and malformed input without throwing', () => {
    expect(verifyCounselAssertionJws(token({ header: { typ: 'JWT' } }), registry)).toMatchObject({ ok: false, reason: 'wrong token type' })
    expect(verifyCounselAssertionJws(token({ header: { jwk: pub(other.publicKey) } }), registry).ok).toBe(false)
    expect(verifyCounselAssertionJws(token({ header: { jku: 'https://attacker.example.test/keys' } }), registry).ok).toBe(false)
    expect(verifyCounselAssertionJws(token({ claims: { nonce: undefined } }), registry)).toMatchObject({ ok: false, reason: 'claims are incomplete' })
    for (const bad of ['', 'a.b', 'a.b.c.d', 'not base64!.x.y', 'x'.repeat(9000), undefined as unknown as string])
      expect(verifyCounselAssertionJws(bad, registry).ok).toBe(false)
  })

  it('the verifier vouches only for the exact signed assertion', async () => {
    const out = verifyCounselAssertionJws(token(), registry)
    if (!out.ok) throw new Error(out.reason)
    expect(await out.verifier.verifySignature(out.assertion)).toBe(true)
    for (const change of [{ subject: 'someone-else' }, { matterId: ORG }, { organizationId: MATTER }, { nonce: 'n-ffffffffffffffff' },
      { expiresAt: new Date(out.assertion.expiresAt.getTime() + 60_000) }])
      expect(await out.verifier.verifySignature({ ...out.assertion, ...change })).toBe(false)
  })

  it('through authenticateCounselAssertion: a verified token passes once; expiry, other matter and replay are refused', async () => {
    const used = new Set<string>()
    const nonces = { consume: async (nonce: string) => (used.has(nonce) ? false : (used.add(nonce), true)) }
    const expected = { allowedIssuers: registry.issuers, organizationId: ORG, matterId: MATTER, now: new Date() }
    const out = verifyCounselAssertionJws(token(), registry)
    if (!out.ok) throw new Error(out.reason)
    expect(await authenticateCounselAssertion(out.assertion, expected, { verifier: out.verifier, nonces })).toEqual({ ok: true, subject: SUBJECT })
    expect((await authenticateCounselAssertion(out.assertion, expected, { verifier: out.verifier, nonces })).ok).toBe(false)
    const expired = verifyCounselAssertionJws(token({ claims: { nonce: 'n-eeeeeeeeeeeeeeee', iat: 100, exp: 200 } }), registry)
    if (!expired.ok) throw new Error(expired.reason)
    expect(await authenticateCounselAssertion(expired.assertion, expected, { verifier: expired.verifier, nonces })).toMatchObject({ ok: false, reason: 'expired' })
    const otherMatter = verifyCounselAssertionJws(token({ claims: { nonce: 'n-dddddddddddddddd', matter: ORG } }), registry)
    if (!otherMatter.ok) throw new Error(otherMatter.reason)
    expect(await authenticateCounselAssertion(otherMatter.assertion, expected, { verifier: otherMatter.verifier, nonces })).toMatchObject({ ok: false, reason: 'bound to a different matter' })
  })

  it('the registry accepts public keys only and refuses malformed, mismatched or duplicate entries', () => {
    expect(() => createCounselIssuerRegistry([{ issuer: ISSUER, kid: 'p', alg: 'ES256', publicJwk: ec.privateKey.export({ format: 'jwk' }) }])).toThrow(/private key material/)
    expect(() => createCounselIssuerRegistry([{ issuer: ISSUER, kid: 'x', alg: 'ES256', publicJwk: pub(ed.publicKey) }])).toThrow(/EC P-256/)
    expect(() => createCounselIssuerRegistry([{ issuer: ISSUER, kid: 'x', alg: 'EdDSA', publicJwk: pub(ec.publicKey) }])).toThrow(/Ed25519/)
    expect(() => createCounselIssuerRegistry([{ issuer: ' ', kid: 'x', alg: 'ES256', publicJwk: pub(ec.publicKey) }])).toThrow()
    expect(() => createCounselIssuerRegistry([{ issuer: ISSUER, kid: 'a', alg: 'ES256', publicJwk: pub(ec.publicKey) }, { issuer: ISSUER, kid: 'a', alg: 'ES256', publicJwk: pub(ec.publicKey) }])).toThrow(/duplicate/)
    expect(() => parseCounselIssuerRegistry('{}')).toThrow(/array/)
    const parsed = parseCounselIssuerRegistry(JSON.stringify([{ issuer: ISSUER, kid: 'ec-1', alg: 'ES256', publicJwk: pub(ec.publicKey) }]))
    expect(parsed.issuers).toEqual([ISSUER])
    expect(verifyCounselAssertionJws(token(), parsed).ok).toBe(true)
    expect(createCounselIssuerRegistry([]).issuers).toEqual([])
  })
})
