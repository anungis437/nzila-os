import { randomUUID } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'

export interface AcceptanceTrustProfile {
  readonly applicationId: string
  readonly issuer: string
  readonly audience: string
  readonly providerNamespace: string
  readonly tokenVersion: string
  readonly acceptanceMarker: string
  readonly enabled: boolean
  readonly signingSecret: string
  readonly maxTtlSeconds: number
  readonly environment: string
  readonly allowedEnvironments: readonly string[]
}

export interface AcceptanceIdentityClaims {
  readonly subject: string
  readonly applicationId: string
  readonly issuer: string
  readonly audience: string
  readonly issuedAt: number
  readonly expiresAt: number
  readonly tokenVersion: string
  readonly acceptanceMarker: string
  readonly environment: string
  readonly tokenId: string
}

export type AcceptanceIdentityVerification =
  | { readonly ok: true; readonly identity: AcceptanceIdentityClaims }
  | { readonly ok: false }

const MAX_FUTURE_IAT_SECONDS = 60

function profileIsValid(profile: AcceptanceTrustProfile): boolean {
  return (
    profile.enabled &&
    profile.applicationId.length > 0 &&
    !profile.applicationId.includes('*') &&
    profile.issuer.length > 0 &&
    profile.audience.length > 0 &&
    !profile.audience.includes('*') &&
    /^[a-z0-9][a-z0-9._-]{0,79}$/.test(profile.providerNamespace) &&
    profile.tokenVersion.length > 0 &&
    profile.acceptanceMarker.length > 0 &&
    new TextEncoder().encode(profile.signingSecret).length >= 32 &&
    Number.isSafeInteger(profile.maxTtlSeconds) &&
    profile.maxTtlSeconds > 0 &&
    profile.allowedEnvironments.includes(profile.environment)
  )
}

export async function mintAcceptanceIdentityToken(input: {
  readonly profile: AcceptanceTrustProfile
  readonly subject: string
  readonly now?: Date
  readonly ttlSeconds?: number
}): Promise<string> {
  const { profile } = input
  const ttlSeconds = input.ttlSeconds ?? profile.maxTtlSeconds
  if (
    !profileIsValid(profile) ||
    !input.subject.trim() ||
    input.subject.length > 512 ||
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds <= 0 ||
    ttlSeconds > profile.maxTtlSeconds
  ) {
    throw new Error('Acceptance trust profile or token inputs are invalid')
  }

  const issuedAt = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const expiresAt = issuedAt + ttlSeconds
  return new SignJWT({
    application: profile.applicationId,
    acceptance: profile.acceptanceMarker,
    environment: profile.environment,
    ver: profile.tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(profile.issuer)
    .setAudience(profile.audience)
    .setSubject(input.subject)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(profile.signingSecret))
}

export async function verifyAcceptanceIdentityToken(input: {
  readonly token: string | null | undefined
  readonly profile: AcceptanceTrustProfile
  readonly now?: Date
}): Promise<AcceptanceIdentityVerification> {
  const { profile } = input
  if (!input.token || !profileIsValid(profile)) return { ok: false }

  try {
    const { payload, protectedHeader } = await jwtVerify(input.token, new TextEncoder().encode(profile.signingSecret), {
      algorithms: ['HS256'],
      issuer: profile.issuer,
      audience: profile.audience,
      currentDate: input.now,
    })
    if (protectedHeader.typ !== 'JWT') return { ok: false }
    if (
      payload.iss !== profile.issuer ||
      payload.aud !== profile.audience ||
      payload.application !== profile.applicationId ||
      payload.acceptance !== profile.acceptanceMarker ||
      payload.environment !== profile.environment ||
      payload.ver !== profile.tokenVersion ||
      typeof payload.sub !== 'string' ||
      payload.sub.trim().length === 0 ||
      payload.sub.length > 512 ||
      typeof payload.jti !== 'string' ||
      payload.jti.length === 0 ||
      typeof payload.iat !== 'number' ||
      !Number.isSafeInteger(payload.iat) ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > profile.maxTtlSeconds
    ) {
      return { ok: false }
    }

    const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000)
    if (payload.iat - nowSeconds > MAX_FUTURE_IAT_SECONDS) return { ok: false }

    return {
      ok: true,
      identity: {
        subject: payload.sub,
        applicationId: profile.applicationId,
        issuer: profile.issuer,
        audience: profile.audience,
        issuedAt: payload.iat,
        expiresAt: payload.exp,
        tokenVersion: profile.tokenVersion,
        acceptanceMarker: profile.acceptanceMarker,
        environment: profile.environment,
        tokenId: payload.jti,
      },
    }
  } catch {
    return { ok: false }
  }
}
