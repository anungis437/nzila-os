import { randomUUID } from 'node:crypto'
import { SignJWT } from 'jose'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { db } from '@nzila/db/client'
import { auditEvents, authAuditLog } from '@nzila/db/schema'
import { mintAcceptanceIdentityToken } from './acceptance-trust'
import {
  authenticateCoraAcceptanceIdentity,
  createCoraAcceptanceTrustProfile,
  CORA_ACCEPTANCE_AUDIENCE,
  CORA_ACCEPTANCE_ISSUER,
  CORA_ACCEPTANCE_MAX_TTL_SECONDS,
  type CoraAcceptanceAuthEnv,
} from './cora-acceptance-auth'
import {
  AuthorizationResolutionError,
  resolveAuthorizationContext,
} from './authorization-context'

const acceptanceDatabaseUrl = process.env.DATABASE_URL
if (
  acceptanceDatabaseUrl &&
  !/^(postgres|postgresql):\/\/[^/]+@(?:127\.0\.0\.1|localhost):55442\/nzila_platform_authz_acceptance(?:\?|$)/.test(
    acceptanceDatabaseUrl,
  )
) {
  throw new Error('Cora acceptance trust tests require the dedicated loopback database')
}

const authEnv: CoraAcceptanceAuthEnv = {
  CORA_ACCEPTANCE_AUTH_ENABLED: 'true',
  CORA_ACCEPTANCE_AUTH_SECRET: process.env.CORA_ACCEPTANCE_AUTH_SECRET,
  NODE_ENV: 'test',
}
const requiredPermission = 'cora:farmer360:read'
const orgA = '61000000-0000-4000-8000-000000000001'
const orgB = '61000000-0000-4000-8000-000000000002'

async function tokenFor(subject: string, claims?: Record<string, unknown>): Promise<string> {
  const profile = createCoraAcceptanceTrustProfile(authEnv)
  if (!claims) return mintAcceptanceIdentityToken({ profile, subject })

  const issuedAt = Math.floor(Date.now() / 1000)
  return new SignJWT({
    application: profile.applicationId,
    acceptance: profile.acceptanceMarker,
    environment: profile.environment,
    ver: profile.tokenVersion,
    ...claims,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(CORA_ACCEPTANCE_ISSUER)
    .setAudience(CORA_ACCEPTANCE_AUDIENCE)
    .setSubject(subject)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + CORA_ACCEPTANCE_MAX_TTL_SECONDS)
    .sign(new TextEncoder().encode(authEnv.CORA_ACCEPTANCE_AUTH_SECRET))
}

async function authorize(
  subject: string,
  options: { claims?: Record<string, unknown>; organizationId?: string } = {},
) {
  const correlationId = `cora-acceptance-${randomUUID()}`
  const identity = await authenticateCoraAcceptanceIdentity({
    token: await tokenFor(subject, options.claims),
    env: authEnv,
    correlationId,
  })
  if (!identity) throw new Error('Synthetic Cora identity was not authenticated')
  const context = await resolveAuthorizationContext({
    identityProvider: identity.identityProvider,
    providerSubject: identity.providerSubject,
    applicationId: identity.applicationId,
    requestedOrganizationId: options.organizationId,
    requiredPermissions: [requiredPermission],
    requestId: correlationId,
    correlationId,
  })
  return { context, correlationId }
}

async function expectDenied(
  subject: string,
  code: AuthorizationResolutionError['code'],
  options: { claims?: Record<string, unknown>; organizationId?: string } = {},
) {
  const identity = await authenticateCoraAcceptanceIdentity({
    token: await tokenFor(subject, options.claims),
    env: authEnv,
    correlationId: `cora-acceptance-deny-${randomUUID()}`,
  })
  if (!identity) throw new Error('Synthetic Cora identity was not authenticated')
  await expect(
    resolveAuthorizationContext({
      identityProvider: identity.identityProvider,
      providerSubject: identity.providerSubject,
      applicationId: identity.applicationId,
      requestedOrganizationId: options.organizationId,
      requiredPermissions: [requiredPermission],
      correlationId: `cora-denial-${randomUUID()}`,
    }),
  ).rejects.toMatchObject({ code })
}

describe.skipIf(!acceptanceDatabaseUrl)('Cora acceptance identity to canonical authorization acceptance', () => {
  afterAll(async () => {
    await db.$client.end({ timeout: 5 })
  })

  it('resolves a signed acceptance identity through canonical binding, membership, and Cora grant', async () => {
    const token = await tokenFor('actor-a', {
      organizationId: orgB,
      permissions: [requiredPermission],
      role: 'administrator',
      evidenceEntitlement: true,
    })
    const correlationId = `cora-acceptance-allow-${randomUUID()}`
    const identity = await authenticateCoraAcceptanceIdentity({ token, env: authEnv, correlationId })
    expect(identity).toMatchObject({
      identityProvider: 'cora-acceptance',
      providerSubject: 'actor-a',
      applicationId: 'cora',
    })
    if (!identity) throw new Error('Cora acceptance identity authentication failed')

    const context = await resolveAuthorizationContext({
      identityProvider: identity.identityProvider,
      providerSubject: identity.providerSubject,
      applicationId: identity.applicationId,
      requestedOrganizationId: orgA,
      requiredPermissions: [requiredPermission],
      correlationId,
    })

    expect(context.platformUser.id).toBe('platform-cora-acceptance')
    expect(context.platformUser.id).not.toBe(identity.providerSubject)
    expect(context.identity.provider).toBe('cora-acceptance')
    expect(context.organization.id).toBe(orgA)
    expect(context.applicationId).toBe('cora')
    expect(context.permissions).toEqual([requiredPermission])

    const [authorizationAudit] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetType, 'platform_authorization'),
          sql`${auditEvents.afterJson}->>'correlationId' = ${correlationId}`,
        ),
      )
      .limit(1)
    expect(authorizationAudit?.afterJson).toMatchObject({
      decision: 'ALLOW',
      platformUserId: 'platform-cora-acceptance',
      organizationId: orgA,
      applicationId: 'cora',
      effectivePermissions: [requiredPermission],
    })

    const [authenticationAudit] = await db
      .select({ metadata: authAuditLog.metadata })
      .from(authAuditLog)
      .where(sql`${authAuditLog.metadata}->>'correlationId' = ${correlationId}`)
      .limit(1)
    expect(authenticationAudit?.metadata).toMatchObject({
      provider: 'cora-acceptance',
      applicationId: 'cora',
      decision: 'ALLOW',
      externalIdentityReference: expect.any(String),
    })
    expect(JSON.stringify(authenticationAudit?.metadata)).not.toContain(token)
    expect(JSON.stringify(authenticationAudit?.metadata)).not.toContain('actor-a')
  })

  it('resolves a second synthetic actor only to its own canonical org and grant', async () => {
    const { context } = await authorize('actor-b')
    expect(context.platformUser.id).toBe('platform-cross-provider')
    expect(context.organization.id).toBe(orgB)
    expect(context.permissions).toEqual([requiredPermission])
  })

  it('denies missing or inactive canonical bindings and memberships', async () => {
    await expectDenied('actor-without-binding', 'IDENTITY_NOT_BOUND')
    await expectDenied('actor-disabled', 'IDENTITY_BINDING_INACTIVE')
    await expectDenied('actor-no-membership', 'MEMBERSHIP_REQUIRED')
    await expectDenied('actor-suspended', 'MEMBERSHIP_NOT_ACTIVE', { organizationId: orgB })
  })

  it('requires canonical grants despite token-embedded permission and organization claims', async () => {
    await expectDenied('actor-no-permission', 'APPLICATION_PERMISSION_REQUIRED', {
      claims: {
        organizationId: orgA,
        permissions: [requiredPermission],
        role: 'administrator',
        evidenceEntitlement: true,
      },
    })
    await expectDenied('actor-a', 'MEMBERSHIP_REQUIRED', {
      claims: { organizationId: orgB },
      organizationId: orgB,
    })
  })

  it('denies ambiguous canonical active memberships', async () => {
    await expectDenied('actor-ambiguous', 'AMBIGUOUS_ORGANIZATION')
  })
})

