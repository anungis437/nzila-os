/**
 * Counsel assertion signature verification (WorkAid counsel boundary, register UE-CONV-G-003).
 *
 * A counsel-side issuer, outside Union Eyes, signs a compact JWS whose payload is the counsel assertion. Union Eyes holds only
 * the issuers' PUBLIC keys (an allow-listed registry; the private keys and their rotation are the issuer's key custody) and:
 *   1. parses the token and checks the protected header (alg ES256 or EdDSA, typ counsel-assertion+jwt, a registered kid);
 *   2. verifies the signature with that issuer key, refusing any key/algorithm/issuer mismatch;
 *   3. maps the claims onto the existing CounselAssertion envelope, which authenticateCounselAssertion still validates
 *      (allow-list, audience, organization and matter binding, lifetime) and whose nonce the durable store consumes once.
 * The returned CounselAssertionVerifier vouches ONLY for the exact assertion that was signed: any field changed after
 * verification (subject, matter, organization, nonce, window) is refused. Every malformed input is a refusal, never a throw
 * that a caller could mistake for success.
 */
import { createPublicKey, verify, type JsonWebKeyInput, type KeyObject } from 'node:crypto'

type JsonWebKey = JsonWebKeyInput['key']
import type { CounselAssertion, CounselAssertionVerifier } from './counsel-boundary'

export const COUNSEL_ASSERTION_JWS_TYPE = 'counsel-assertion+jwt'
export type CounselSigningAlgorithm = 'ES256' | 'EdDSA'

export interface CounselIssuerKey {
  issuer: string
  kid: string
  alg: CounselSigningAlgorithm
  /** A PUBLIC key in JWK form (EC P-256 for ES256, OKP Ed25519 for EdDSA). Private components are refused. */
  publicJwk: JsonWebKey
}

export interface CounselIssuerRegistry {
  /** Issuer identifiers that may sign counsel assertions; feeds authenticateCounselAssertion's allow-list. */
  readonly issuers: readonly string[]
  key(issuer: string, kid: string): { alg: CounselSigningAlgorithm; key: KeyObject } | null
}

const PRIVATE_JWK_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'k'] as const

/** Builds the registry from public issuer keys. Throws on any malformed, private, duplicate or mismatched key. */
export function createCounselIssuerRegistry(keys: readonly CounselIssuerKey[]): CounselIssuerRegistry {
  const byIssuerKid = new Map<string, { alg: CounselSigningAlgorithm; key: KeyObject }>()
  for (const entry of keys) {
    if (!entry || typeof entry.issuer !== 'string' || entry.issuer.trim() === '' || entry.issuer !== entry.issuer.trim())
      throw new Error('counsel issuer key: issuer must be a non-empty trimmed string')
    if (typeof entry.kid !== 'string' || entry.kid.length === 0) throw new Error(`counsel issuer key ${entry.issuer}: kid is required`)
    if (entry.alg !== 'ES256' && entry.alg !== 'EdDSA') throw new Error(`counsel issuer key ${entry.issuer}/${entry.kid}: unsupported alg`)
    const jwk = entry.publicJwk as Record<string, unknown>
    if (!jwk || typeof jwk !== 'object') throw new Error(`counsel issuer key ${entry.issuer}/${entry.kid}: publicJwk is required`)
    if (PRIVATE_JWK_MEMBERS.some((member) => member in jwk))
      throw new Error(`counsel issuer key ${entry.issuer}/${entry.kid}: private key material is never accepted`)
    if (entry.alg === 'ES256' && !(jwk.kty === 'EC' && jwk.crv === 'P-256'))
      throw new Error(`counsel issuer key ${entry.issuer}/${entry.kid}: ES256 requires an EC P-256 key`)
    if (entry.alg === 'EdDSA' && !(jwk.kty === 'OKP' && jwk.crv === 'Ed25519'))
      throw new Error(`counsel issuer key ${entry.issuer}/${entry.kid}: EdDSA requires an Ed25519 key`)
    const id = `${entry.issuer}\u0000${entry.kid}`
    if (byIssuerKid.has(id)) throw new Error(`counsel issuer key ${entry.issuer}/${entry.kid}: duplicate`)
    byIssuerKid.set(id, { alg: entry.alg, key: createPublicKey({ key: entry.publicJwk, format: 'jwk' }) })
  }
  const issuers = [...new Set(keys.map((k) => k.issuer))].sort()
  return { issuers, key: (issuer, kid) => byIssuerKid.get(`${issuer}\u0000${kid}`) ?? null }
}

/** Parses a JSON array of CounselIssuerKey (e.g. a configured public key list). Throws on anything malformed. */
export function parseCounselIssuerRegistry(json: string): CounselIssuerRegistry {
  const value: unknown = JSON.parse(json)
  if (!Array.isArray(value)) throw new Error('counsel issuer keys must be a JSON array')
  return createCounselIssuerRegistry(value as CounselIssuerKey[])
}

export type VerifiedCounselToken =
  | { ok: true; assertion: CounselAssertion; verifier: CounselAssertionVerifier }
  | { ok: false; reason: string }

const b64urlJson = (segment: string): unknown => JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
const B64URL = /^[A-Za-z0-9_-]+$/
const sameInstant = (a: Date, b: Date) => a instanceof Date && b instanceof Date && a.getTime() === b.getTime()

function sameAssertion(a: CounselAssertion, b: CounselAssertion): boolean {
  return a.issuer === b.issuer && a.audience === b.audience && a.subject === b.subject && a.organizationId === b.organizationId &&
    a.matterId === b.matterId && a.nonce === b.nonce && sameInstant(a.issuedAt, b.issuedAt) && sameInstant(a.expiresAt, b.expiresAt)
}

/**
 * Verifies a compact counsel assertion JWS against the issuer registry. On success returns the assertion and a verifier
 * bound to exactly that signed assertion; on any failure returns a refusal reason (never throws).
 */
export function verifyCounselAssertionJws(token: string, registry: CounselIssuerRegistry): VerifiedCounselToken {
  const no = (reason: string): VerifiedCounselToken => ({ ok: false, reason })
  try {
    if (typeof token !== 'string' || token.length > 8192) return no('token is missing or too large')
    const parts = token.split('.')
    if (parts.length !== 3 || !parts.every((p) => B64URL.test(p))) return no('token is not a compact JWS')
    const [headerB64, payloadB64, signatureB64] = parts
    const header = b64urlJson(headerB64) as Record<string, unknown>
    const claims = b64urlJson(payloadB64) as Record<string, unknown>
    if (!header || typeof header !== 'object' || !claims || typeof claims !== 'object') return no('token header or payload is not an object')
    if (header.typ !== COUNSEL_ASSERTION_JWS_TYPE) return no('wrong token type')
    if (header.alg !== 'ES256' && header.alg !== 'EdDSA') return no('unsupported or missing algorithm')
    if (typeof header.kid !== 'string') return no('missing key id')
    if ('crit' in header || 'jwk' in header || 'jku' in header || 'x5u' in header || 'x5c' in header) return no('header names an embedded or remote key')
    if (typeof claims.iss !== 'string') return no('missing issuer')
    const entry = registry.key(claims.iss, header.kid)
    if (!entry) return no('issuer key is not registered')
    if (entry.alg !== header.alg) return no('algorithm does not match the registered key')
    const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'ascii')
    const signature = Buffer.from(signatureB64, 'base64url')
    const valid = entry.alg === 'ES256'
      ? verify('sha256', signingInput, { key: entry.key, dsaEncoding: 'ieee-p1363' }, signature)
      : verify(null, signingInput, entry.key, signature)
    if (!valid) return no('signature did not verify')
    const { aud, sub, org, matter, nonce, iat, exp } = claims
    if (typeof aud !== 'string' || typeof sub !== 'string' || typeof org !== 'string' || typeof matter !== 'string' ||
      typeof nonce !== 'string' || typeof iat !== 'number' || typeof exp !== 'number' || !Number.isInteger(iat) || !Number.isInteger(exp))
      return no('claims are incomplete')
    const assertion: CounselAssertion = {
      issuer: claims.iss, audience: aud, subject: sub, organizationId: org, matterId: matter, nonce,
      issuedAt: new Date(iat * 1000), expiresAt: new Date(exp * 1000),
    }
    const signed = { ...assertion, issuedAt: new Date(assertion.issuedAt), expiresAt: new Date(assertion.expiresAt) }
    return { ok: true, assertion, verifier: { verifySignature: async (candidate) => sameAssertion(candidate, signed) } }
  } catch {
    return no('token could not be verified')
  }
}
