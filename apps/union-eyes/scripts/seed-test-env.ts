import { createHash } from 'crypto'
import { inArray, sql } from 'drizzle-orm'
import { assertNotProduction } from '@/lib/runtime/production-guard'
import { db } from '@/db/db'

assertNotProduction('seed-test-env')
import { organizations } from '@/db/schema-organizations'
import { claims, claimUpdates } from '@/db/schema'
import { organizationMembers } from '@/db/schema/organization-members-schema'
import { users, organizationUsers } from '@/db/schema/domains/member/user-management'
import { authOrgPolicies, authOrganizationUsers, authUserSessions, authUsers } from '@nzila/db/schema'
import { hashPassword } from '@nzila/platform-auth/password'
import { UE_TEST_ORGS } from '@/tests/fixtures/test-orgs'
import { UE_TEST_USERS, UE_TEST_USER_PASSWORD } from '@/tests/fixtures/test-users'
import { UE_TEST_CASES } from '@/tests/fixtures/test-cases'

const NOW = new Date('2026-05-01T00:00:00.000Z')

function assertSafeRuntime(): void {
  const qaTestEnv =
    (process.env.QA_TEST_ENV ?? '').toLowerCase() === 'true' ||
    (process.env.UE_QA_GATE ?? '').toLowerCase() === 'true'

  if (!qaTestEnv) {
    throw new Error(
      '[ue:seed:test-env] Safety check failed: QA_TEST_ENV=true is required for deterministic reset operations.',
    )
  }

  const databaseUrl = (process.env.DATABASE_URL ?? '').toLowerCase()
  if (!databaseUrl) {
    throw new Error('[ue:seed:test-env] Safety check failed: DATABASE_URL is required')
  }

  const forbiddenHints = ['prod', 'production', 'azure.com', 'rds.amazonaws.com']
  const allowProd = (process.env.QA_TEST_ENV_ALLOW_PROD_URL ?? '').toLowerCase() === 'true'
  if (!allowProd && forbiddenHints.some((hint) => databaseUrl.includes(hint))) {
    throw new Error(
      '[ue:seed:test-env] Safety check failed: DATABASE_URL appears production-like. Refusing to continue without QA_TEST_ENV_ALLOW_PROD_URL=true.',
    )
  }
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const cause = (error as { cause?: { code?: string } }).cause
  return cause?.code === '42703'
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const cause = (error as { cause?: { code?: string } }).cause
  return cause?.code === '42P01'
}

function assertDeterministicInputs(): void {
  const orgIds = Object.values(UE_TEST_ORGS).map((o) => o.id)
  const userIds = Object.values(UE_TEST_USERS).map((u) => u.userId)
  const claimIds = Object.values(UE_TEST_CASES).map((c) => c.claimId)

  const hasDup = (arr: string[]) => new Set(arr).size !== arr.length
  if (hasDup(orgIds) || hasDup(userIds) || hasDup(claimIds)) {
    throw new Error('Deterministic fixture IDs must be unique')
  }
}

async function seed(): Promise<void> {
  assertSafeRuntime()
  assertDeterministicInputs()

  const qaPasswordHash = await hashPassword(UE_TEST_USER_PASSWORD)

  const orgs = Object.values(UE_TEST_ORGS)
  const usersFixture = Object.values(UE_TEST_USERS)
  const casesFixture = Object.values(UE_TEST_CASES)
  const orgSlugById = new Map(orgs.map((org) => [org.id, org.slug]))

  const orgIds = orgs.map((o) => o.id)
  const userIds = usersFixture.map((u) => u.userId)
  const claimIds = casesFixture.map((c) => c.claimId)

  // Main transaction: wipe and reseed core tables
  await db.transaction(async (tx) => {
    const safeCleanup = async (label: string, fn: () => Promise<void>): Promise<void> => {
      try {
        await fn()
      } catch (error) {
        if (isMissingRelationError(error)) {
          console.warn(`[ue:seed:test-env] cleanup skipped, relation missing: ${label}`)
          return
        }
        throw error
      }
    }

    const tableExists = async (qualifiedName: string): Promise<boolean> => {
      const result = await tx.execute(sql`select to_regclass(${qualifiedName}) as regclass`)
      const row = (result as unknown as Array<{ regclass?: string | null }>)[0]
      return Boolean(row?.regclass)
    }

    // Wipe deterministic test footprint only.
    if (await tableExists('claim_updates')) {
      await safeCleanup('claim_updates', async () => {
        await tx.delete(claimUpdates).where(inArray(claimUpdates.claimId, claimIds))
      })
    }
    if (await tableExists('claims')) {
      await safeCleanup('claims', async () => {
        await tx.delete(claims).where(inArray(claims.claimId, claimIds))
      })
    }

    await tx.delete(authUserSessions).where(inArray(authUserSessions.userId, userIds))
    await tx.delete(authOrganizationUsers).where(inArray(authOrganizationUsers.userId, userIds))
    await tx.delete(authOrgPolicies).where(inArray(authOrgPolicies.organizationId, orgIds))

    await tx.delete(organizationMembers).where(inArray(organizationMembers.userId, userIds))
    await tx.delete(organizationUsers).where(inArray(organizationUsers.userId, userIds))

    // Deterministic QA reset: clear audit/security tables entirely so no FK residue blocks user cleanup.
    await tx.execute(sql`delete from audit_security.security_events`)
    await tx.execute(sql`delete from audit_security.audit_logs`)

    // Remove existing QA orgs and recreate deterministically.
    await tx.delete(organizations).where(inArray(organizations.id, orgIds))

    await tx.insert(organizations).values(
      orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        organizationType: org.organizationType,
        hierarchyPath: [...org.hierarchyPath],
        hierarchyLevel: org.hierarchyLevel,
        status: 'active',
        createdAt: NOW,
        updatedAt: NOW,
      })),
    )

    await tx
      .insert(users)
      .values(
        usersFixture.map((u) => ({
          userId: u.userId,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          displayName: `${u.firstName} ${u.lastName}`,
          isActive: u.status === 'active',
          isSystemAdmin: false,
          createdAt: NOW,
          updatedAt: NOW,
        })),
      )
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          email: sql`excluded.email`,
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          displayName: sql`excluded.display_name`,
          isActive: sql`excluded.is_active`,
          isSystemAdmin: false,
          updatedAt: NOW,
        },
      })

    await tx
      .insert(authUsers)
      .values(
        usersFixture.map((u) => ({
          userId: u.userId,
          email: u.email,
          emailVerified: true,
          emailVerifiedAt: NOW,
          passwordHash: qaPasswordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          displayName: `${u.firstName} ${u.lastName}`,
          isActive: true,
          isSystemAdmin: false,
          accountSource: 'local',
          lifecycleState: u.status === 'active' ? 'active' : 'suspended',
          passwordChangedAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
        })),
      )
      .onConflictDoUpdate({
        target: authUsers.userId,
        set: {
          emailVerified: true,
          emailVerifiedAt: NOW,
          passwordHash: qaPasswordHash,
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          displayName: sql`excluded.display_name`,
          isActive: true,
          isSystemAdmin: false,
          accountSource: 'local',
          lifecycleState: sql`excluded.lifecycle_state`,
          passwordChangedAt: NOW,
          updatedAt: NOW,
        },
      })

    await tx.insert(organizationUsers).values(
      usersFixture.map((u) => ({
        organizationId: u.orgId,
        userId: u.userId,
        role: u.role,
        permissions: [],
        isActive: u.status === 'active',
        isPrimary: true,
        joinedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      })),
    )

    await tx
      .insert(authOrganizationUsers)
      .values(
        usersFixture.map((u) => ({
          organizationId: u.orgId,
          userId: u.userId,
          role: u.role,
          permissions: [],
          isActive: u.status === 'active',
          isPrimary: true,
          joinedAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
        })),
      )
      .onConflictDoUpdate({
        target: [authOrganizationUsers.userId, authOrganizationUsers.organizationId],
        set: {
          role: sql`excluded.role`,
          permissions: sql`excluded.permissions`,
          isActive: sql`excluded.is_active`,
          isPrimary: true,
          joinedAt: NOW,
          updatedAt: NOW,
        },
      })

    // Seed one deterministic localhost session per user to keep risk scoring
    // in low tier for QA E2E password logins.
    await tx.insert(authUserSessions).values(
      usersFixture.map((u) => {
        const rawToken = `ue-seed-session-${u.userId}`
        return {
          userId: u.userId,
          organizationId: u.orgId,
          sessionToken: rawToken,
          sessionTokenHash: createHash('sha256').update(rawToken).digest('hex'),
          ipAddress: '127.0.0.1',
          userAgent: 'playwright-e2e-auth',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          isActive: true,
          createdAt: NOW,
          lastUsedAt: NOW,
        }
      }),
    )

    await tx.insert(authOrgPolicies).values(
      orgs.map((org) => ({
        organizationId: org.id,
        allowLocalAuth: true,
        allowMagicLink: true,
        allowSso: true,
        requireSso: false,
        requireInvite: false,
        passwordResetAllowed: true,
        allowedEmailDomains: [],
        mfaRequiredForRoles: [],
        updatedBy: 'ue:seed:test-env',
        updatedAt: NOW,
        createdAt: NOW,
      })),
    )

    await tx.insert(claims).values(
      casesFixture.map((c) => ({
        claimId: c.claimId,
        claimNumber: c.claimNumber,
        organizationId: c.organizationId,
        memberId: c.memberId,
        claimType: c.claimType,
        status: c.status,
        priority: c.priority,
        description: c.description,
        incidentDate: 'incidentDate' in c ? c.incidentDate : NOW,
        location: 'location' in c ? c.location : 'Unknown Location',
        desiredOutcome: 'desiredOutcome' in c ? c.desiredOutcome : null,
        filedDate: NOW,
        assignedTo: 'assignedTo' in c ? c.assignedTo : null,
        assignedAt: 'assignedTo' in c ? NOW : null,
        createdAt: NOW,
        updatedAt: NOW,
      })),
    )
  })

  // Separate transaction for organization_members (may fail due to schema drift)
  try {
    await db.transaction(async (tx) => {
      await tx.insert(organizationMembers).values(
        usersFixture.map((u) => ({
          userId: u.userId,
          organizationId: orgSlugById.get(u.orgId) ?? u.orgId,
          role: u.role,
          status: u.status,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          metadata: 'metadata' in u ? u.metadata : null,
          isPrimary: true,
          joinedAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
        })),
      )
    })
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    console.warn('[ue:seed:test-env] organization_members insert skipped due schema drift (missing column)')
  }

  // Separate transaction for claim_updates (may fail due to schema drift)
  try {
    await db.transaction(async (tx) => {
      await tx.insert(claimUpdates).values(
        casesFixture.map((c, index) => ({
          claimId: c.claimId,
          updateType: 'seed_baseline',
          message: `Deterministic QA baseline #${index + 1}`,
          createdBy: c.memberId,
          isInternal: false,
          visibilityScope: 'member' as const,
          metadata: {
            seed: true,
            narRequired: true,
            decisionRequired: true,
          },
          createdAt: NOW,
          updatedAt: NOW,
        })),
      )
    })
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    console.warn('[ue:seed:test-env] claim_updates insert skipped due schema drift (missing column)')
  }

  // Required containment artifacts for external UX tester access.
  console.log('[ue:seed:test-env] Seed complete')
  console.log(
    JSON.stringify(
      {
        testOrgs: orgIds.length,
        testUsers: userIds.length,
        testCases: claimIds.length,
        externalTesterOrg: UE_TEST_ORGS.uxTesterIsolated.id,
        externalTesterUser: UE_TEST_USERS.restrictedUxTester.userId,
        suspendedUser: UE_TEST_USERS.suspendedMember.userId,
        productionLikeOrgGuardrail: UE_TEST_ORGS.productionLike.id,
        qaPassword: UE_TEST_USER_PASSWORD,
      },
      null,
      2,
    ),
  )
}

seed().catch((error) => {
  console.error('[ue:seed:test-env] Failed', error)
  process.exit(1)
})
