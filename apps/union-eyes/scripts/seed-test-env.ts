import { inArray, sql } from 'drizzle-orm'
import { db } from '@/db/db'
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
  const err = error as any
  const message = String(err.message || '').toLowerCase()
  // Check if it's a column missing error - either by code or message
  if (err.code === '42703') return true
  if (err.cause?.code === '42703') return true
  if (message.includes('column') && message.includes('does not exist')) return true
  return false
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as any
  const message = String(err.message || '').toLowerCase()
  // Check if it's a relation missing error - either by code or message
  if (err.code === '42p01') return true
  if (err.cause?.code === '42p01') return true
  if (message.includes('relation') && message.includes('does not exist')) return true
  return false
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

  const orgIds = orgs.map((o) => o.id)
  const userIds = usersFixture.map((u) => u.userId)
  const claimIds = casesFixture.map((c) => c.claimId)

  // Claims cleanup in its own transaction so a missing-table error doesn't abort the main transaction.
  await db.transaction(async (tx) => {
    try {
      await tx.delete(claimUpdates).where(inArray(claimUpdates.claimId, claimIds))
      await tx.delete(claims).where(inArray(claims.claimId, claimIds))
    } catch (error) {
      if (!isMissingRelationError(error)) throw error
      console.warn('[ue:seed:test-env] claim cleanup skipped (claim tables not present in this schema)')
    }
  })

  // Main transaction: wipe and reseed core tables
  await db.transaction(async (tx) => {
    await tx.delete(authUserSessions).where(inArray(authUserSessions.userId, userIds))
    await tx.delete(authOrganizationUsers).where(inArray(authOrganizationUsers.userId, userIds))
    await tx.delete(authOrgPolicies).where(inArray(authOrgPolicies.organizationId, orgIds))

    await tx.delete(organizationMembers).where(inArray(organizationMembers.userId, userIds))
    await tx.delete(organizationUsers).where(inArray(organizationUsers.userId, userIds))

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
  })

  // Claims insert in its own transaction so a missing-table error doesn't abort the main transaction
  try {
    await db.transaction(async (tx) => {
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
  } catch (error) {
    if (!isMissingRelationError(error)) throw error
    console.warn('[ue:seed:test-env] claims insert skipped (claims table not present in this schema)')
  }

  // Separate transaction for organization_members (may fail due to schema drift)
  try {
    await db.transaction(async (tx) => {
      await tx.insert(organizationMembers).values(
        usersFixture.map((u) => ({
          userId: u.userId,
          organizationId: u.orgId,
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
    if (!(isMissingColumnError(error) || isMissingRelationError(error))) throw error
    console.warn('[ue:seed:test-env] organization_members insert skipped due schema drift (missing column or table)')
  }

  // Separate transaction for claim_updates (may fail due to schema drift)
  if (claimIds.length > 0) {
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
      console.log('[ue:seed:test-env] claimUpdates error details:', { type: error?.constructor?.name, code: (error as any)?.code, message: (error as any)?.message })
      const isRelationError = isMissingRelationError(error)
      const isColumnError = isMissingColumnError(error)
      if (!(isColumnError || isRelationError)) {
        throw error
      }
      console.warn('[ue:seed:test-env] claim_updates insert skipped due schema drift or missing table')
    }
  } else {
    console.warn('[ue:seed:test-env] claim_updates insert skipped (no claims to create updates for)')
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
