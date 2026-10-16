import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import {
  ACCEPTANCE_AUTH_AUDIENCE,
  ACCEPTANCE_AUTH_ISSUER,
  ACCEPTANCE_AUTH_MAX_TTL_SECONDS,
  ACCEPTANCE_AUTH_VERSION,
  mintAcceptanceAuthToken,
  verifyAcceptanceAuthToken,
  type AcceptanceAuthEnv,
} from './acceptance-auth'
import {
  CORA_ACCEPTANCE_AUDIENCE,
  CORA_ACCEPTANCE_ISSUER,
  CORA_ACCEPTANCE_MAX_TTL_SECONDS,
  CORA_ACCEPTANCE_PROVIDER,
  CORA_ACCEPTANCE_TOKEN_VERSION,
  createCoraAcceptanceTrustProfile,
  verifyCoraAcceptanceIdentity,
  type CoraAcceptanceAuthEnv,
} from './cora-acceptance-auth'
import { mintAcceptanceIdentityToken } from './acceptance-trust'

const NOW = new Date('2026-10-07T12:00:00.000Z')
const CORA_SECRET = 'cora-acceptance-test-secret-32-bytes-minimum'
const UE_SECRET = 'union-eyes-acceptance-test-secret'

const CORA_ENV: CoraAcceptanceAuthEnv = {
  CORA_ACCEPTANCE_AUTH_ENABLED: 'true',
  CORA_ACCEPTANCE_AUTH_SECRET: CORA_SECRET,
  NODE_ENV: 'test',
}

const UE_ENV: AcceptanceAuthEnv = {
  UNION_EYES_ACCEPTANCE_AUTH_ENABLED: 'true',
  UNION_EYES_ACCEPTANCE_AUTH_SECRET: UE_SECRET,
  UNION_EYES_ACCEPTANCE_AUTH_USER_IDS: 'same-subject',
  NODE_ENV: 'production',
  NEXT_PUBLIC_APP_ENV: 'staging',
  UE_DEPLOYMENT_TYPE: 'staging',
}

function bytes(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

function withClaims(
  claims: Record<string, unknown>,
  overrides: {
    issuer?: string
    audience?: string
    secret?: string
    subject?: string
    issuedAt?: number
    expiresAt?: number
  } = {},
): Promise<string> {
  const issuedAt = overrides.issuedAt ?? Math.floor(NOW.getTime() / 1000)
  return new SignJWT({
    application: 'cora',
    acceptance: 'local-test-acceptance',
    environment: 'test',
    ver: CORA_ACCEPTANCE_TOKEN_VERSION,
    ...claims,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(overrides.issuer ?? CORA_ACCEPTANCE_ISSUER)
    .setAudience(overrides.audience ?? CORA_ACCEPTANCE_AUDIENCE)
    .setSubject(overrides.subject ?? 'synthetic-cora-actor')
    .setJti('cora-test-jti')
    .setIssuedAt(issuedAt)
    .setExpirationTime(overrides.expiresAt ?? issuedAt + CORA_ACCEPTANCE_MAX_TTL_SECONDS)
    .sign(bytes(overrides.secret ?? CORA_SECRET))
}

describe('Cora application-scoped acceptance identity', () => {
  it('accepts an explicitly enabled local/test Cora identity profile', async () => {
    const profile = createCoraAcceptanceTrustProfile(CORA_ENV)
    const token = await mintAcceptanceIdentityToken({
      profile,
      subject: 'synthetic-cora-actor',
      now: NOW,
    })

    await expect(
      verifyCoraAcceptanceIdentity({ token, env: CORA_ENV, now: NOW }),
    ).resolves.toMatchObject({
      ok: true,
      identity: {
        identityProvider: CORA_ACCEPTANCE_PROVIDER,
        providerSubject: 'synthetic-cora-actor',
        applicationId: 'cora',
      },
    })
  })

  it('isolates Cora and Union Eyes tokens in both directions', async () => {
    const coraToken = await mintAcceptanceIdentityToken({
      profile: createCoraAcceptanceTrustProfile(CORA_ENV),
      subject: 'same-subject',
      now: NOW,
    })
    const ueToken = await mintAcceptanceAuthToken({
      userId: 'same-subject',
      secret: UE_SECRET,
      now: NOW,
    })

    expect(
      (await verifyCoraAcceptanceIdentity({ token: coraToken, env: CORA_ENV, now: NOW })).ok,
    ).toBe(true)
    expect((await verifyAcceptanceAuthToken({ token: coraToken, env: UE_ENV, now: NOW })).ok).toBe(
      false,
    )
    expect((await verifyAcceptanceAuthToken({ token: ueToken, env: UE_ENV, now: NOW })).ok).toBe(
      true,
    )
    expect(
      (await verifyCoraAcceptanceIdentity({ token: ueToken, env: CORA_ENV, now: NOW })).ok,
    ).toBe(false)
    expect(CORA_ACCEPTANCE_PROVIDER).not.toBe('union-eyes-acceptance')
  })

  it.each([
    ['missing enable flag', { ...CORA_ENV, CORA_ACCEPTANCE_AUTH_ENABLED: undefined }],
    ['disabled flag', { ...CORA_ENV, CORA_ACCEPTANCE_AUTH_ENABLED: 'false' }],
    ['missing secret', { ...CORA_ENV, CORA_ACCEPTANCE_AUTH_SECRET: undefined }],
    ['production NODE_ENV', { ...CORA_ENV, NODE_ENV: 'production' }],
    ['production app environment', { ...CORA_ENV, NEXT_PUBLIC_APP_ENV: 'production' }],
    ['production deployment environment', { ...CORA_ENV, DEPLOYMENT_ENVIRONMENT: 'prod' }],
  ] as const)('fails closed for %s', async (_label, env) => {
    const validToken = await mintAcceptanceIdentityToken({
      profile: createCoraAcceptanceTrustProfile(CORA_ENV),
      subject: 'synthetic-cora-actor',
      now: NOW,
    })
    await expect(
      verifyCoraAcceptanceIdentity({ token: validToken, env, now: NOW }),
    ).resolves.toEqual({ ok: false })
  })

  it('rejects invalid secrets, expired tokens, excess TTL, and future-issued tokens', async () => {
    const validProfile = createCoraAcceptanceTrustProfile(CORA_ENV)
    const validToken = await mintAcceptanceIdentityToken({
      profile: validProfile,
      subject: 'synthetic-cora-actor',
      now: NOW,
    })
    await expect(
      verifyCoraAcceptanceIdentity({
        token: validToken,
        env: { ...CORA_ENV, CORA_ACCEPTANCE_AUTH_SECRET: 'invalid' },
        now: NOW,
      }),
    ).resolves.toEqual({ ok: false })

    const nowSeconds = Math.floor(NOW.getTime() / 1000)
    const expired = await withClaims(
      {},
      {
        issuedAt: nowSeconds - 600,
        expiresAt: nowSeconds - 540,
      },
    )
    const oversized = await withClaims(
      {},
      {
        issuedAt: nowSeconds - (CORA_ACCEPTANCE_MAX_TTL_SECONDS + 1),
        expiresAt: nowSeconds + 60,
      },
    )
    const future = await withClaims(
      {},
      {
        issuedAt: nowSeconds + 120,
        expiresAt: nowSeconds + 180,
      },
    )

    await expect(
      verifyCoraAcceptanceIdentity({ token: expired, env: CORA_ENV, now: NOW }),
    ).resolves.toEqual({ ok: false })
    await expect(
      verifyCoraAcceptanceIdentity({ token: oversized, env: CORA_ENV, now: NOW }),
    ).resolves.toEqual({ ok: false })
    await expect(
      verifyCoraAcceptanceIdentity({ token: future, env: CORA_ENV, now: NOW }),
    ).resolves.toEqual({ ok: false })
  })

  it('rejects wrong issuer, audience, application, and token version', async () => {
    const wrongIssuer = await withClaims({}, { issuer: 'other-issuer' })
    const wrongAudience = await withClaims({}, { audience: 'other-audience' })
    const wrongApp = await withClaims({ application: 'union-eyes' })
    const wrongVersion = await withClaims({ ver: 'other-version' })
    const wrongMarker = await withClaims({ acceptance: false })

    for (const token of [wrongIssuer, wrongAudience, wrongApp, wrongVersion, wrongMarker]) {
      await expect(
        verifyCoraAcceptanceIdentity({ token, env: CORA_ENV, now: NOW }),
      ).resolves.toEqual({ ok: false })
    }
  })

  it('returns identity-only claims and discards token-embedded organization and permissions', async () => {
    const token = await withClaims({
      organizationId: 'attacker-org',
      permissions: ['cora:farmer360:read'],
      role: 'administrator',
      evidenceEntitlement: true,
    })
    const result = await verifyCoraAcceptanceIdentity({ token, env: CORA_ENV, now: NOW })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.identity).not.toHaveProperty('organizationId')
      expect(result.identity).not.toHaveProperty('permissions')
      expect(result.identity).not.toHaveProperty('role')
      expect(result.identity).not.toHaveProperty('evidenceEntitlement')
    }
  })

  it('preserves the existing Union Eyes trust constants and token contract', () => {
    expect(ACCEPTANCE_AUTH_ISSUER).toBe('union-eyes-staging-acceptance')
    expect(ACCEPTANCE_AUTH_AUDIENCE).toBe('union-eyes-runtime')
    expect(ACCEPTANCE_AUTH_VERSION).toBe('ue-acceptance-v1')
    expect(ACCEPTANCE_AUTH_MAX_TTL_SECONDS).toBe(15 * 60)
    expect(CORA_ACCEPTANCE_ISSUER).not.toBe(ACCEPTANCE_AUTH_ISSUER)
    expect(CORA_ACCEPTANCE_AUDIENCE).not.toBe(ACCEPTANCE_AUTH_AUDIENCE)
    expect(CORA_ACCEPTANCE_TOKEN_VERSION).not.toBe(ACCEPTANCE_AUTH_VERSION)
  })
})
