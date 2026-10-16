import { createHash } from 'node:crypto'
import { db } from '@nzila/db/client'
import { authAuditLog } from '@nzila/db/schema'
import {
  verifyAcceptanceIdentityToken,
  type AcceptanceIdentityClaims,
  type AcceptanceTrustProfile,
} from './acceptance-trust'

export const CORA_ACCEPTANCE_APPLICATION = 'cora'
export const CORA_ACCEPTANCE_PROVIDER = 'cora-acceptance'
export const CORA_ACCEPTANCE_ISSUER = 'nzila-cora-local-acceptance'
export const CORA_ACCEPTANCE_AUDIENCE = 'nzila-cora-local-runtime'
export const CORA_ACCEPTANCE_TOKEN_VERSION = 'cora-acceptance-v1'
export const CORA_ACCEPTANCE_MAX_TTL_SECONDS = 5 * 60

export interface CoraAcceptanceAuthEnv {
  readonly CORA_ACCEPTANCE_AUTH_ENABLED?: string
  readonly CORA_ACCEPTANCE_AUTH_SECRET?: string
  readonly NODE_ENV?: string
  readonly NEXT_PUBLIC_APP_ENV?: string
  readonly NZILA_MODE?: string
  readonly DEPLOYMENT_ENVIRONMENT?: string
}

export interface CoraAcceptanceIdentity {
  readonly identityProvider: typeof CORA_ACCEPTANCE_PROVIDER
  readonly providerSubject: string
  readonly applicationId: typeof CORA_ACCEPTANCE_APPLICATION
  readonly tokenId: string
  readonly claims: AcceptanceIdentityClaims
}

function environmentSignals(env: CoraAcceptanceAuthEnv): string[] {
  return [env.NODE_ENV, env.NEXT_PUBLIC_APP_ENV, env.NZILA_MODE, env.DEPLOYMENT_ENVIRONMENT]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().toLowerCase())
}

export function createCoraAcceptanceTrustProfile(
  env: CoraAcceptanceAuthEnv = process.env,
): AcceptanceTrustProfile {
  const environments = environmentSignals(env)
  const allowedEnvironments = ['development', 'local', 'test']
  const environment = environments[0] ?? ''
  const enabled =
    env.CORA_ACCEPTANCE_AUTH_ENABLED?.trim().toLowerCase() === 'true' &&
    environments.length > 0 &&
    environments.every((value) => allowedEnvironments.includes(value))

  return {
    applicationId: CORA_ACCEPTANCE_APPLICATION,
    issuer: CORA_ACCEPTANCE_ISSUER,
    audience: CORA_ACCEPTANCE_AUDIENCE,
    providerNamespace: CORA_ACCEPTANCE_PROVIDER,
    tokenVersion: CORA_ACCEPTANCE_TOKEN_VERSION,
    acceptanceMarker: 'local-test-acceptance',
    enabled,
    signingSecret: env.CORA_ACCEPTANCE_AUTH_SECRET ?? '',
    maxTtlSeconds: CORA_ACCEPTANCE_MAX_TTL_SECONDS,
    environment,
    allowedEnvironments,
  }
}

function subjectReference(subject: string): string {
  return createHash('sha256').update(`${CORA_ACCEPTANCE_PROVIDER}\u0000${subject}`).digest('hex')
}

export async function verifyCoraAcceptanceIdentity(input: {
  readonly token: string | null | undefined
  readonly env?: CoraAcceptanceAuthEnv
  readonly now?: Date
}): Promise<
  { readonly ok: true; readonly identity: CoraAcceptanceIdentity } | { readonly ok: false }
> {
  const result = await verifyAcceptanceIdentityToken({
    token: input.token,
    profile: createCoraAcceptanceTrustProfile(input.env),
    now: input.now,
  })
  if (!result.ok) return { ok: false }

  return {
    ok: true,
    identity: {
      identityProvider: CORA_ACCEPTANCE_PROVIDER,
      providerSubject: result.identity.subject,
      applicationId: CORA_ACCEPTANCE_APPLICATION,
      tokenId: result.identity.tokenId,
      claims: result.identity,
    },
  }
}

export async function authenticateCoraAcceptanceIdentity(input: {
  readonly token: string | null | undefined
  readonly env?: CoraAcceptanceAuthEnv
  readonly now?: Date
  readonly correlationId: string
}): Promise<CoraAcceptanceIdentity | null> {
  const verified = await verifyCoraAcceptanceIdentity(input)
  await db.insert(authAuditLog).values({
    eventType: verified.ok ? 'acceptance_auth.allow' : 'acceptance_auth.deny',
    metadata: {
      provider: CORA_ACCEPTANCE_PROVIDER,
      applicationId: CORA_ACCEPTANCE_APPLICATION,
      decision: verified.ok ? 'ALLOW' : 'DENY',
      reason: verified.ok ? 'ACCEPTANCE_TOKEN_VERIFIED' : 'TOKEN_VERIFICATION_FAILED',
      externalIdentityReference: verified.ok
        ? subjectReference(verified.identity.providerSubject)
        : undefined,
      correlationId: input.correlationId,
      occurredAt: (input.now ?? new Date()).toISOString(),
    },
  })
  return verified.ok ? verified.identity : null
}
