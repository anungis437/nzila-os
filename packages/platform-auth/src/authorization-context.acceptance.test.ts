import { closeAuthClients } from '@nzila/db/auth-client'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { db } from '@nzila/db/client'
import {
  auditEvents,
  platformApplicationPermissionGrants,
  platformIdentityBindings,
  platformOrganizationMemberships,
} from '@nzila/db/schema'
import { buildCanonicalPayload, computeCanonicalHash } from '@nzila/db/audit-hash'
import {
  AuthorizationResolutionError,
  resolveAuthorizationContext,
  withholdUnresolvedEvidenceRead,
  type AuthorizationResolutionInput,
} from './authorization-context'

const acceptanceDatabaseUrl = process.env.DATABASE_URL
if (
  acceptanceDatabaseUrl &&
  !/^(postgres|postgresql):\/\/[^/]+@(?:127\.0\.0\.1|localhost):55442\/nzila_platform_authz_acceptance(?:\?|$)/.test(
    acceptanceDatabaseUrl,
  )
) {
  throw new Error('Authorization acceptance tests require the dedicated loopback database')
}

const fixtures = {
  provider: 'test.acceptance',
  orgA: '61000000-0000-4000-8000-000000000001',
  orgB: '61000000-0000-4000-8000-000000000002',
  ownerMembership: '63000000-0000-4000-8000-000000000001',
  ownerGrant: '64000000-0000-4000-8000-000000000001',
}

function request(
  subject: string,
  overrides: Partial<AuthorizationResolutionInput> = {},
): AuthorizationResolutionInput {
  return {
    identityProvider: fixtures.provider,
    providerSubject: subject,
    applicationId: 'cora',
    requestId: randomUUID(),
    ...overrides,
  }
}

async function expectDenied(
  input: AuthorizationResolutionInput,
  expectedCode: string,
): Promise<AuthorizationResolutionError> {
  try {
    await resolveAuthorizationContext(input)
  } catch (error) {
    if (!(error instanceof AuthorizationResolutionError)) throw error
    expect(error.code).toBe(expectedCode)
    return error
  }
  throw new Error(`Expected authorization denial: ${expectedCode}`)
}

async function findAuditByCorrelation(correlationId: string) {
  const [row] = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.targetType, 'platform_authorization'),
        sql`${auditEvents.afterJson}->>'correlationId' = ${correlationId}`,
      ),
    )
    .limit(1)
  return row
}

describe.skipIf(!acceptanceDatabaseUrl)('platform authorization database acceptance', () => {
  afterAll(async () => {
    await closeAuthClients()
    await db.$client.end({ timeout: 5 })
  })

  it('applies migration 0041 exactly to the Drizzle authority contract', async () => {
    const expectedTables = [
      ['platform_identity_bindings', platformIdentityBindings],
      ['platform_organization_memberships', platformOrganizationMemberships],
      ['platform_application_permission_grants', platformApplicationPermissionGrants],
    ] as const
    const columns = await db.execute(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in (
          'platform_identity_bindings',
          'platform_organization_memberships',
          'platform_application_permission_grants'
        )
      order by table_name, ordinal_position
    `)

    for (const [tableName, drizzleTable] of expectedTables) {
      const actualNames = columns
        .filter((row) => (row as { table_name: string }).table_name === tableName)
        .map((row) => (row as { column_name: string }).column_name)
      expect(actualNames).toEqual(
        Object.values(getTableColumns(drizzleTable)).map((column) => column.name),
      )
    }
  })

  it('resolves the canonical provider binding, membership, and only in-scope grants', async () => {
    const context = await resolveAuthorizationContext(
      request('subject-owner', {
        requiredPermissions: ['cora:farmer360:read'],
        correlationId: `acceptance-allow-${randomUUID()}`,
      }),
    )

    expect(context.platformUser.id).toBe('platform-owner-1')
    expect(context.organization.id).toBe(fixtures.orgA)
    expect(context.membership.id).toBe(fixtures.ownerMembership)
    expect(context.permissions).toEqual(['cora:farmer360:read'])
    expect(context.permissions).not.toContain('union-eyes:case:read')
    expect(context.permissions).not.toContain('cora:expired:read')
    expect(context.permissions).not.toContain('cora:future:read')
    expect(context.permissions).not.toContain('cora:revoked:read')

    const audit = await findAuditByCorrelation(context.correlationId)
    expect(audit?.action).toBe('authorization.allow')
    expect(audit?.hashVersion).toBe('canonical-v1')
    expect(audit?.afterJson).toMatchObject({
      decision: 'ALLOW',
      platformUserId: 'platform-owner-1',
      organizationId: fixtures.orgA,
      permissionGrantIds: [fixtures.ownerGrant],
    })
  })

  it('keeps provider subjects namespaced by provider', async () => {
    const context = await resolveAuthorizationContext(
      request('subject-shared', {
        identityProvider: 'test.other',
        applicationId: 'cora',
      }),
    )
    expect(context.platformUser.id).toBe('platform-cross-provider')
    expect(context.organization.id).toBe(fixtures.orgB)
  })

  it('does not treat legacy membership, primary-org, or permissions as authority', async () => {
    await expectDenied(
      request('subject-no-grant', {
        requiredPermissions: ['cora:farmer360:read'],
      }),
      'APPLICATION_PERMISSION_REQUIRED',
    )
    const audit = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, 'authorization.deny'),
          sql`${auditEvents.afterJson}->>'reason' = 'APPLICATION_PERMISSION_REQUIRED'`,
          sql`${auditEvents.afterJson}->>'platformUserId' = 'platform-no-grant'`,
        ),
      )
      .orderBy(desc(auditEvents.createdAt))
      .limit(1)
    expect(audit[0]?.orgId).toBe(fixtures.orgA)
    expect(audit[0]?.afterJson).toMatchObject({
      decision: 'DENY',
      effectivePermissions: [],
      requiredPermissions: ['cora:farmer360:read'],
    })

    const legacyOnly = await db.execute(sql`
      select permissions
      from user_management.organization_users
      where user_id = 'platform-no-grant'
    `)
    expect(legacyOnly.length).toBeGreaterThan(0)
  })

  it('denies a caller-selected organization without relying on the legacy primary organization', async () => {
    const correlationId = `wrong-org-${randomUUID()}`
    await expectDenied(
      request('subject-owner', {
        requestedOrganizationId: fixtures.orgB,
        correlationId,
      }),
      'MEMBERSHIP_REQUIRED',
    )
    const auditRows = await db.execute(sql`
      select id, metadata
      from user_management.auth_audit_log
      where metadata->>'correlationId' = ${correlationId}
    `)
    const [audit] = auditRows
    expect(audit).toBeDefined()
    expect(audit.metadata).toMatchObject({
      decision: 'DENY',
      reason: 'MEMBERSHIP_REQUIRED',
      externalIdentityReference: expect.any(String),
    })
    expect(JSON.stringify(audit.metadata)).not.toContain('subject-owner')
  })

  it('denies ambiguous memberships independent of row ordering', async () => {
    const first = await expectDenied(request('subject-ambiguous'), 'AMBIGUOUS_ORGANIZATION')
    await db
      .update(platformOrganizationMemberships)
      .set({ createdAt: new Date('2026-01-01T00:00:00.000Z') })
      .where(eq(platformOrganizationMemberships.id, '63000000-0000-4000-8000-000000000007'))
    await db
      .update(platformOrganizationMemberships)
      .set({ createdAt: new Date('2027-01-01T00:00:00.000Z') })
      .where(eq(platformOrganizationMemberships.id, '63000000-0000-4000-8000-000000000008'))
    const second = await expectDenied(request('subject-ambiguous'), 'AMBIGUOUS_ORGANIZATION')
    expect(first.audit.reason).toBe(second.audit.reason)
    expect(first.audit.organizationId).toBeUndefined()
    const auditRows = await db.execute(sql`
      select id, metadata
      from user_management.auth_audit_log
      where metadata->>'reason' = 'AMBIGUOUS_ORGANIZATION'
      order by created_at desc
      limit 1
    `)
    const [audit] = auditRows
    expect(audit).toBeDefined()
    expect(audit.metadata).toMatchObject({ decision: 'DENY', reason: 'AMBIGUOUS_ORGANIZATION' })
  })

  it('denies unknown, disabled, revoked, unverified, inactive, and ineffective identities', async () => {
    const cases: Array<{
      subject: string
      code: string
      overrides?: Partial<AuthorizationResolutionInput>
    }> = [
      { subject: 'subject-missing', code: 'IDENTITY_NOT_BOUND' },
      { subject: 'subject-disabled', code: 'IDENTITY_NOT_BOUND' },
      { subject: 'subject-revoked', code: 'IDENTITY_NOT_BOUND' },
      { subject: 'subject-unverified', code: 'IDENTITY_BINDING_INACTIVE' },
      { subject: 'subject-inactive', code: 'IDENTITY_NOT_BOUND' },
      { subject: 'subject-no-membership', code: 'MEMBERSHIP_REQUIRED' },
      { subject: 'subject-membership-states', code: 'MEMBERSHIP_REQUIRED' },
      { subject: 'subject-expired-membership', code: 'MEMBERSHIP_REQUIRED' },
      { subject: 'subject-future-membership', code: 'MEMBERSHIP_REQUIRED' },
      {
        subject: 'subject-inactive-org',
        code: 'ORGANIZATION_INACTIVE',
        overrides: { requestedOrganizationId: '61000000-0000-4000-8000-000000000003' },
      },
    ] as const
    for (const { subject, code, overrides } of cases) {
      await expectDenied(request(subject, overrides), code)
    }

    const safeDenials = await db.execute(sql`
      select metadata from user_management.auth_audit_log
      where event_type = 'authorization_decision'
    `)
    expect(safeDenials.length).toBeGreaterThanOrEqual(8)
    expect(JSON.stringify(safeDenials)).not.toContain('subject-disabled')
  })

  it('keeps other applications isolated and permits a revoked grant to be regranted', async () => {
    const context = await resolveAuthorizationContext(
      request('subject-owner', {
        applicationId: 'union-eyes',
        requiredPermissions: ['union-eyes:case:read'],
      }),
    )
    expect(context.permissions).toEqual(['union-eyes:case:read'])

    await expect(
      db.insert(platformApplicationPermissionGrants).values({
        id: randomUUID(),
        membershipId: fixtures.ownerMembership,
        organizationId: fixtures.orgB,
        applicationId: 'cora',
        permission: 'cora:cross-org:read',
        state: 'active',
        grantSource: 'acceptance-test',
        effectiveFrom: new Date(),
        grantedBy: 'acceptance-test',
      }),
    ).rejects.toThrow()

    await expect(
      db.insert(platformApplicationPermissionGrants).values({
        id: randomUUID(),
        membershipId: fixtures.ownerMembership,
        organizationId: fixtures.orgA,
        applicationId: 'cora',
        permission: 'cora:farmer360:read',
        state: 'active',
        grantSource: 'acceptance-test',
        effectiveFrom: new Date(),
        grantedBy: 'acceptance-test',
      }),
    ).rejects.toThrow()

    await expect(
      db.insert(platformApplicationPermissionGrants).values({
        id: randomUUID(),
        membershipId: fixtures.ownerMembership,
        organizationId: fixtures.orgA,
        applicationId: 'cora',
        permission: 'cora:revoked:read',
        state: 'active',
        grantSource: 'acceptance-test',
        effectiveFrom: new Date(),
        grantedBy: 'acceptance-test',
      }),
    ).resolves.toBeDefined()

    await expect(
      db.insert(platformApplicationPermissionGrants).values({
        id: randomUUID(),
        membershipId: fixtures.ownerMembership,
        organizationId: fixtures.orgA,
        applicationId: 'cora',
        permission: 'cora:*',
        state: 'active',
        grantSource: 'acceptance-test',
        effectiveFrom: new Date(),
        grantedBy: 'acceptance-test',
      }),
    ).rejects.toThrow()
  })

  it('withholds unresolved evidence authority for every evidence class', async () => {
    const context = await resolveAuthorizationContext(request('subject-owner'))
    for (const authorityClass of [
      'ORG_OWNED_INTERNAL',
      'SUBJECT_CONTROLLED',
      'EXTERNALLY_LICENSED',
      'AGGREGATED',
      'PUBLIC_OPEN',
      'RESTRICTED',
    ] as const) {
      const decision = withholdUnresolvedEvidenceRead({
        authorizationContext: context,
        authorityClass,
        resource: { id: `evidence-${authorityClass}`, organizationId: fixtures.orgA },
        purpose: 'acceptance',
      })
      expect(decision.decision).toBe('WITHHOLD')
    }
  })

  it('persists canonical hash-linked ALLOW and DENY rows and rejects mutation', async () => {
    await resolveAuthorizationContext(
      request('subject-owner', {
        correlationId: `chain-allow-${randomUUID()}`,
      }),
    )
    await expectDenied(
      request('subject-no-grant', {
        requiredPermissions: ['cora:farmer360:read'],
        correlationId: `chain-deny-${randomUUID()}`,
      }),
      'APPLICATION_PERMISSION_REQUIRED',
    )
    const rows = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.orgId, fixtures.orgA))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    const authorizationRows = rows
      .filter((row) => row.targetType === 'platform_authorization')
      .reverse()
    expect(authorizationRows.length).toBeGreaterThanOrEqual(2)
    expect(authorizationRows).toHaveLength(rows.length)
    for (const [index, row] of authorizationRows.entries()) {
      expect(row.hashVersion).toBe('canonical-v1')
      expect(row.previousHash).toBe(index === 0 ? null : authorizationRows[index - 1].hash)
      expect(row.hash).toBe(
        computeCanonicalHash(
          buildCanonicalPayload({
            action: row.action,
            actorClerkUserId: row.actorClerkUserId,
            actorRole: row.actorRole,
            afterJson: row.afterJson as Record<string, unknown>,
            hashTimestamp: row.occurredAt.toISOString(),
            orgId: row.orgId,
            targetId: row.targetId,
            targetType: row.targetType,
          }),
          row.previousHash,
        ),
      )
    }

    const target = authorizationRows[authorizationRows.length - 1]
    const triggerRows = await db.execute(sql`
      select tgname
      from pg_trigger
      where tgrelid = 'audit_events'::regclass
        and not tgisinternal
        and tgname in ('audit_events_no_update', 'audit_events_no_delete')
    `)
    expect(triggerRows).toHaveLength(2)
    await expect(
      db.update(auditEvents).set({ action: 'tampered' }).where(eq(auditEvents.id, target.id)),
    ).rejects.toThrow()
    await expect(db.delete(auditEvents).where(eq(auditEvents.id, target.id))).rejects.toThrow()
  })
})
