import { closeAuthClients } from '../../packages/db/src/auth-client'
import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { db } from '../../packages/db/src/client.ts'
import { auditEvents } from '../../packages/db/src/schema/index.ts'
import { AuthorizationResolutionError } from '../../packages/platform-auth/src/authorization-context.ts'
import { resolveOrgContextFromIdentity } from '../../apps/cora/lib/resolve-org'

const acceptanceDatabaseUrl = process.env.DATABASE_URL
if (
  acceptanceDatabaseUrl &&
  !/^(postgres|postgresql):\/\/[^/]+@(?:127\.0\.0\.1|localhost):55442\/nzila_platform_authz_acceptance(?:\?|$)/.test(
    acceptanceDatabaseUrl,
  )
) {
  throw new Error('Cora authorization acceptance requires the dedicated loopback database')
}

describe.skipIf(!acceptanceDatabaseUrl)('Cora canonical authorization acceptance', () => {
  afterAll(async () => {
    await closeAuthClients()
    await db.$client.end({ timeout: 5 })
  })

  it('resolves Cora context from the real canonical identity, membership, and grant rows', async () => {
    const legacySignals = {
      identityProvider: 'entra',
      providerSubject: 'acceptance-tenant:entra-owner',
      orgId: '61000000-0000-4000-8000-000000000002',
      groups: ['cora:farmer360:read'],
      permissions: ['agri:write'],
    }
    const context = await resolveOrgContextFromIdentity(legacySignals, {
      requiredPermissions: ['cora:farmer360:read'],
    })

    expect(context).toMatchObject({
      orgId: '61000000-0000-4000-8000-000000000001',
      actorId: 'platform-owner-1',
      appId: 'cora',
      membershipId: '63000000-0000-4000-8000-000000000001',
      permissions: ['cora:farmer360:read'],
      identityProvider: 'entra',
    })
    expect(context.orgId).not.toBe(legacySignals.orgId)
    expect(context.permissions).not.toContain('agri:write')
  })

  it('records a durable DENY when the canonical Farmer 360 grant is absent', async () => {
    const correlationId = `cora-acceptance-deny-${randomUUID()}`
    let error: unknown
    try {
      await resolveOrgContextFromIdentity(
        {
          identityProvider: 'test.acceptance',
          providerSubject: 'subject-no-grant',
        },
        {
          requiredPermissions: ['cora:farmer360:read'],
          correlationId,
        },
      )
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(AuthorizationResolutionError)
    expect(error).toMatchObject({ code: 'APPLICATION_PERMISSION_REQUIRED' })

    const [event] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetType, 'platform_authorization'),
          sql`${auditEvents.afterJson}->>'correlationId' = ${correlationId}`,
        ),
      )
      .limit(1)
    expect(event?.action).toBe('authorization.deny')
    expect(event?.hashVersion).toBe('canonical-v1')
    expect(event?.afterJson).toMatchObject({
      decision: 'DENY',
      reason: 'APPLICATION_PERMISSION_REQUIRED',
      requiredPermissions: ['cora:farmer360:read'],
      effectivePermissions: [],
    })
  })
})
