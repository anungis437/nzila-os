import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import {
  ACCEPTANCE_AUTH_AUDIENCE,
  ACCEPTANCE_AUTH_ISSUER,
  ACCEPTANCE_AUTH_MAX_TTL_SECONDS,
  ACCEPTANCE_AUTH_VERSION,
  type AcceptanceAuthEnv,
  type AcceptanceDb,
  isAcceptanceAuthRuntimeEnabled,
  mintAcceptanceAuthToken,
  resolveAcceptanceAuthUser,
  verifyAcceptanceAuthToken,
} from './acceptance-auth'

const NOW = new Date('2026-09-15T12:00:00.000Z')
const SECRET = 'acceptance-auth-secret-at-least-32-characters'

const BASE_ENV: AcceptanceAuthEnv = {
  UNION_EYES_ACCEPTANCE_AUTH_ENABLED: 'true',
  UNION_EYES_ACCEPTANCE_AUTH_SECRET: SECRET,
  UNION_EYES_ACCEPTANCE_AUTH_USER_IDS: 'p1,p2',
  NODE_ENV: 'production',
  NEXT_PUBLIC_APP_ENV: 'staging',
  UE_DEPLOYMENT_TYPE: 'staging',
}

function secretBytes(secret = SECRET): Uint8Array {
  return new TextEncoder().encode(secret)
}

function fakeDb(resultSets: unknown[][]): AcceptanceDb {
  const pending = [...resultSets]
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => pending.shift() ?? [],
  }

  return {
    select: () => chain,
  } as unknown as AcceptanceDb
}

async function signedToken(input: {
  subject: string
  secret?: string
  issuedAt?: number
  expiresAt?: number
  env?: string
  jti?: string
}) {
  const issuedAt = input.issuedAt ?? Math.floor(NOW.getTime() / 1000)
  const expiresAt = input.expiresAt ?? issuedAt + ACCEPTANCE_AUTH_MAX_TTL_SECONDS

  return new SignJWT({
    ver: ACCEPTANCE_AUTH_VERSION,
    env: input.env ?? 'staging',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ACCEPTANCE_AUTH_ISSUER)
    .setAudience(ACCEPTANCE_AUTH_AUDIENCE)
    .setSubject(input.subject)
    .setJti(input.jti ?? 'test-jti')
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secretBytes(input.secret))
}

function tamperSubject(token: string, subject: string) {
  const [header, payload, signature] = token.split('.')
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  decoded.sub = subject
  return [header, Buffer.from(JSON.stringify(decoded)).toString('base64url'), signature].join('.')
}

describe('UnionEyes staging acceptance auth', () => {
  it('is enabled only for explicitly configured staging runtime', () => {
    expect(isAcceptanceAuthRuntimeEnabled(BASE_ENV)).toBe(true)
    expect(isAcceptanceAuthRuntimeEnabled({ ...BASE_ENV, UNION_EYES_ACCEPTANCE_AUTH_ENABLED: 'false' })).toBe(false)
    expect(isAcceptanceAuthRuntimeEnabled({ ...BASE_ENV, UNION_EYES_ACCEPTANCE_AUTH_SECRET: '' })).toBe(false)
    expect(isAcceptanceAuthRuntimeEnabled({ ...BASE_ENV, NEXT_PUBLIC_APP_ENV: 'production' })).toBe(false)
    expect(isAcceptanceAuthRuntimeEnabled({ ...BASE_ENV, UE_DEPLOYMENT_TYPE: 'prod' })).toBe(false)
    expect(isAcceptanceAuthRuntimeEnabled({ ...BASE_ENV, NODE_ENV: 'development' })).toBe(false)
  })

  it.each(['p1', 'p2'])('resolves signed allowlisted synthetic user %s', async (userId) => {
    const token = await mintAcceptanceAuthToken({ userId, secret: SECRET, now: NOW, jti: `${userId}-jti` })

    const user = await resolveAcceptanceAuthUser({
      token,
      env: BASE_ENV,
      now: NOW,
      db: fakeDb([
        [{ id: userId, email: `${userId}@example.test`, firstName: userId, lastName: null }],
        [{ organizationId: 'specialist-org' }],
      ]),
    })

    expect(user).toEqual(expect.objectContaining({
      id: userId,
      organizationId: 'specialist-org',
      sessionId: `acceptance:${userId}-jti`,
    }))
  })

  it('denies unsigned tokens', async () => {
    const token = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJwMSIsInZlciI6InVlLWFjY2VwdGFuY2UtdjEiLCJlbnYiOiJzdGFnaW5nIn0.'

    await expect(verifyAcceptanceAuthToken({ token, env: BASE_ENV, now: NOW })).resolves.toEqual({ ok: false })
  })

  it('denies modified payloads, including P1-to-P2 subject tampering', async () => {
    const token = await mintAcceptanceAuthToken({ userId: 'p1', secret: SECRET, now: NOW, jti: 'p1-jti' })
    const tampered = tamperSubject(token, 'p2')

    await expect(verifyAcceptanceAuthToken({ token: tampered, env: BASE_ENV, now: NOW })).resolves.toEqual({ ok: false })
  })

  it('denies tokens with the wrong signature', async () => {
    const token = await mintAcceptanceAuthToken({ userId: 'p1', secret: 'wrong-secret-at-least-32-characters', now: NOW })

    await expect(verifyAcceptanceAuthToken({ token, env: BASE_ENV, now: NOW })).resolves.toEqual({ ok: false })
  })

  it('denies expired tokens', async () => {
    const issuedAt = Math.floor(NOW.getTime() / 1000) - 120
    const token = await signedToken({ subject: 'p1', issuedAt, expiresAt: issuedAt + 60 })

    await expect(verifyAcceptanceAuthToken({ token, env: BASE_ENV, now: NOW })).resolves.toEqual({ ok: false })
  })

  it('denies tokens issued too far in the future', async () => {
    const nowSeconds = Math.floor(NOW.getTime() / 1000)
    const token = await signedToken({ subject: 'p1', issuedAt: nowSeconds + 120, expiresAt: nowSeconds + 180 })

    await expect(verifyAcceptanceAuthToken({ token, env: BASE_ENV, now: NOW })).resolves.toEqual({ ok: false })
  })

  it('denies tokens for the wrong runtime environment', async () => {
    const token = await signedToken({ subject: 'p1', env: 'production' })

    await expect(verifyAcceptanceAuthToken({ token, env: BASE_ENV, now: NOW })).resolves.toEqual({ ok: false })
  })

  it('denies when the secret is missing, disabled, or production-enabled', async () => {
    const token = await mintAcceptanceAuthToken({ userId: 'p1', secret: SECRET, now: NOW })

    await expect(verifyAcceptanceAuthToken({ token, env: { ...BASE_ENV, UNION_EYES_ACCEPTANCE_AUTH_SECRET: '' }, now: NOW })).resolves.toEqual({ ok: false })
    await expect(verifyAcceptanceAuthToken({ token, env: { ...BASE_ENV, UNION_EYES_ACCEPTANCE_AUTH_ENABLED: 'false' }, now: NOW })).resolves.toEqual({ ok: false })
    await expect(verifyAcceptanceAuthToken({ token, env: { ...BASE_ENV, NEXT_PUBLIC_APP_ENV: 'production' }, now: NOW })).resolves.toEqual({ ok: false })
  })

  it('denies real, unknown, inactive, and non-member users', async () => {
    const realUserToken = await mintAcceptanceAuthToken({ userId: 'real-user', secret: SECRET, now: NOW })
    await expect(resolveAcceptanceAuthUser({
      token: realUserToken,
      env: BASE_ENV,
      now: NOW,
      db: fakeDb([
        [{ id: 'real-user', email: 'real@example.test', firstName: 'Real', lastName: 'User' }],
        [{ organizationId: 'union-org' }],
      ]),
    })).resolves.toBeNull()

    const p1Token = await mintAcceptanceAuthToken({ userId: 'p1', secret: SECRET, now: NOW })
    await expect(resolveAcceptanceAuthUser({
      token: p1Token,
      env: BASE_ENV,
      now: NOW,
      db: fakeDb([[], [{ organizationId: 'specialist-org' }]]),
    })).resolves.toBeNull()

    await expect(resolveAcceptanceAuthUser({
      token: p1Token,
      env: BASE_ENV,
      now: NOW,
      db: fakeDb([[{ id: 'p1', email: 'p1@example.test', firstName: 'P', lastName: 'One' }], []]),
    })).resolves.toBeNull()
  })
})
