import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { completeExternalProviderAuth } from '@nzila/platform-auth'
import { ssoOidcAttempts, ssoProviders, ssoProviderVersions } from '@/db/schema/sso-scim-schema'
import { decryptSecret, encryptSecret } from '@/lib/encryption'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'

const ATTEMPT_TTL_MS = 10 * 60_000
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const opaque = (bytes = 32) => randomBytes(bytes).toString('base64url')
const validReturnPath = (value: string | null | undefined) =>
  typeof value === 'string' && /^\/[A-Za-z0-9/_?&=.-]*$/.test(value) && !value.startsWith('//') ? value : '/dashboard'

function callbackUrl(): string {
  const base = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (!base) throw new Error('The canonical application URL is not configured')
  const url = new URL('/api/auth/sso/callback', base)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('SSO callback requires HTTPS')
  return url.toString()
}

type Discovery = {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
}

async function discover(issuerRaw: string): Promise<Discovery> {
  const issuer = new URL(issuerRaw)
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password) throw new Error('Invalid OIDC issuer')
  const wellKnown = new URL(`${issuer.pathname.replace(/\/$/, '')}/.well-known/openid-configuration`, issuer)
  const response = await fetch(wellKnown, { signal: AbortSignal.timeout(8_000), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('OIDC discovery failed')
  const body = await response.json() as Partial<Discovery>
  if (body.issuer !== issuerRaw && body.issuer !== issuerRaw.replace(/\/$/, '')) throw new Error('OIDC discovery issuer mismatch')
  for (const endpoint of [body.authorization_endpoint, body.token_endpoint, body.jwks_uri]) {
    if (!endpoint) throw new Error('OIDC discovery is incomplete')
    const parsed = new URL(endpoint)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hostname !== issuer.hostname) {
      throw new Error('OIDC endpoints must remain on the approved issuer host')
    }
  }
  return body as Discovery
}

export async function beginOidcSignIn(input: { providerId: string; returnPath?: string | null }): Promise<string> {
  const loaded = await withSystemContext(async (tx) => {
    const [row] = await tx.select().from(ssoProviders).where(and(
      eq(ssoProviders.id, input.providerId),
      eq(ssoProviders.providerType, 'oidc'),
      eq(ssoProviders.enabled, true),
      gt(ssoProviders.activeVersion, 0),
    )).limit(1)
    if (!row) return null
    const [version] = await tx.select().from(ssoProviderVersions).where(and(
      eq(ssoProviderVersions.providerId, row.id),
      eq(ssoProviderVersions.version, row.activeVersion),
      eq(ssoProviderVersions.organizationId, row.organizationId),
    )).limit(1)
    return version ? { provider: row, version } : null
  })
  if (!loaded) throw new Error('SSO provider is unavailable')
  const provider = loaded.provider
  const configuration = loaded.version.configuration as Record<string, unknown>
  const oidcIssuer = typeof configuration.oidcIssuer === 'string' ? configuration.oidcIssuer : null
  const oidcClientId = typeof configuration.oidcClientId === 'string' ? configuration.oidcClientId : null
  if (!oidcIssuer || !oidcClientId || typeof configuration.oidcClientSecret !== 'string' || !provider.approvedBy || !provider.approvedAt) {
    throw new Error('SSO provider is unavailable')
  }
  const discovery = await discover(oidcIssuer)
  const state = opaque()
  const nonce = opaque()
  const verifier = opaque(48)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  await withSystemContext(async (tx) => {
    await tx.insert(ssoOidcAttempts).values({
      organizationId: provider.organizationId,
      providerId: provider.id,
      providerVersion: provider.activeVersion,
      stateHash: digest(state),
      nonceHash: digest(nonce),
      encryptedNonce: await encryptSecret(nonce),
      encryptedCodeVerifier: await encryptSecret(verifier),
      returnPath: validReturnPath(input.returnPath),
      expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS),
    })
  })
  const authorization = new URL(discovery.authorization_endpoint)
  authorization.searchParams.set('response_type', 'code')
  authorization.searchParams.set('client_id', oidcClientId)
  authorization.searchParams.set('redirect_uri', callbackUrl())
  const scopes = Array.isArray(configuration.oidcScopes) && configuration.oidcScopes.every((scope) => typeof scope === 'string')
    ? configuration.oidcScopes as string[] : ['openid', 'profile', 'email']
  authorization.searchParams.set('scope', scopes.join(' '))
  authorization.searchParams.set('state', state)
  authorization.searchParams.set('nonce', nonce)
  authorization.searchParams.set('code_challenge', challenge)
  authorization.searchParams.set('code_challenge_method', 'S256')
  return authorization.toString()
}

export async function completeOidcSignIn(input: {
  state: string
  code: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ returnPath: string; requiresMfa: false }> {
  const claimed = await withSystemContext(async (tx) => {
    const [attempt] = await tx.update(ssoOidcAttempts).set({ claimedAt: new Date() }).where(and(
      eq(ssoOidcAttempts.stateHash, digest(input.state)),
      isNull(ssoOidcAttempts.claimedAt),
      isNull(ssoOidcAttempts.consumedAt),
      gt(ssoOidcAttempts.expiresAt, new Date()),
    )).returning()
    if (!attempt) throw new Error('SSO attempt is invalid, expired or already used')
    const [provider] = await tx.select().from(ssoProviders).where(and(
      eq(ssoProviders.id, attempt.providerId),
      eq(ssoProviders.organizationId, attempt.organizationId),
      eq(ssoProviders.enabled, true),
      eq(ssoProviders.activeVersion, attempt.providerVersion),
    )).limit(1)
    if (!provider) throw new Error('SSO provider changed during sign-in')
    const [version] = await tx.select().from(ssoProviderVersions).where(and(
      eq(ssoProviderVersions.providerId, provider.id),
      eq(ssoProviderVersions.version, attempt.providerVersion),
      eq(ssoProviderVersions.organizationId, provider.organizationId),
    )).limit(1)
    if (!version) throw new Error('SSO provider version is unavailable')
    return { attempt, provider, version }
  })
  const { attempt, provider, version } = claimed
  const configuration = version.configuration as Record<string, unknown>
  const oidcIssuer = typeof configuration.oidcIssuer === 'string' ? configuration.oidcIssuer : null
  const oidcClientId = typeof configuration.oidcClientId === 'string' ? configuration.oidcClientId : null
  const encryptedClientSecret = typeof configuration.oidcClientSecret === 'string' ? configuration.oidcClientSecret : null
  if (!oidcIssuer || !oidcClientId || !encryptedClientSecret) throw new Error('SSO provider version is incomplete')
  const discovery = await discover(oidcIssuer)
  const verifier = await decryptSecret(attempt.encryptedCodeVerifier)
  const nonce = await decryptSecret(attempt.encryptedNonce)
  if (digest(nonce) !== attempt.nonceHash) throw new Error('SSO nonce record is invalid')
  const secret = await decryptSecret(encryptedClientSecret)
  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: callbackUrl(),
      client_id: oidcClientId,
      client_secret: secret,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!tokenResponse.ok) throw new Error('OIDC token exchange failed')
  const tokens = await tokenResponse.json() as { id_token?: string }
  if (!tokens.id_token) throw new Error('OIDC identity token is missing')
  const verified = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(discovery.jwks_uri)), {
    issuer: discovery.issuer,
    audience: oidcClientId,
    maxTokenAge: '10 minutes',
  })
  if (verified.payload.nonce !== nonce || typeof verified.payload.sub !== 'string') throw new Error('OIDC subject or nonce is invalid')
  const amr = Array.isArray(verified.payload.amr) ? verified.payload.amr.filter((v): v is string => typeof v === 'string') : []
  const result = await completeExternalProviderAuth({
    provider: `ue-oidc:${provider.id}`,
    providerSubject: `${discovery.issuer}|${verified.payload.sub}`,
    organizationId: provider.organizationId,
    mfaSatisfied: amr.some((method) => ['mfa', 'otp', 'hwk', 'swk'].includes(method.toLowerCase())),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })
  await withSystemContext(async (tx) => {
    await tx.update(ssoOidcAttempts).set({ consumedAt: new Date() }).where(eq(ssoOidcAttempts.id, attempt.id))
    await persistAtomicAudit(tx, {
      organizationId: provider.organizationId,
      userId: result.userId,
      action: 'sso.oidc.sign_in',
      resourceType: 'sso_providers',
      resourceId: provider.id,
      details: { providerVersion: attempt.providerVersion, mfaSatisfied: amr.length > 0 },
    })
  })
  return { returnPath: validReturnPath(attempt.returnPath), requiresMfa: false }
}
