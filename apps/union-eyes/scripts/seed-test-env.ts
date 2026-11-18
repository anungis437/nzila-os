import { createHash, randomUUID } from 'crypto'
import { inArray, sql } from 'drizzle-orm'
import { assertNotProduction } from '@/lib/runtime/production-guard'
import { db } from '@/db/db'

assertNotProduction('seed-test-env')
import { organizations } from '@/db/schema-organizations'
import { claims, claimUpdates } from '@/db/schema'
import { organizationMembers } from '@/db/schema/organization-members-schema'
import { profiles } from '@/db/schema/profiles-schema'
import {
  authOrgPolicies,
  authOrganizationUsers,
  authUserSessions,
  authUsers,
  authMfaTotp,
} from '@nzila/db/schema'
import { hashPassword } from '@nzila/platform-auth/password'
import { encryptSecret } from '@nzila/platform-auth/mfa'
import {
  createRuntimeFixtureAuth,
  readRuntimeFixtureAuth,
  writeRuntimeFixtureAuth,
} from './runtime/fixture-auth'
import { UE_TEST_ORGS } from '@/tests/fixtures/test-orgs'
import { UE_TEST_USERS, UE_TEST_USER_PASSWORD } from '@/tests/fixtures/test-users'
import { UE_TEST_CASES } from '@/tests/fixtures/test-cases'
import { seedQaCaseAssignments } from './seed-test-env-kernel'
import { PLATFORM_MODULES } from '@/services/platform-economics/entitlement-guard'

/** Synthetic grants for the QA organizations only; idempotent and marked so they can never be mistaken for a contract. */
async function seedQaEntitlements(organizationIds: string[]): Promise<number> {
  const keys = Object.values(PLATFORM_MODULES)
  let granted = 0
  for (const organizationId of organizationIds) {
    for (const featureKey of keys) {
      const result = await db.execute(sql`
        INSERT INTO org_entitlements (organization_id, feature_key, status, granted_by, metadata)
        VALUES (${organizationId}::uuid, ${featureKey}, 'active', 'ue-qa-seed', '{"synthetic":true,"source":"seed:test-env"}'::jsonb)
        ON CONFLICT (organization_id, feature_key) DO UPDATE SET status = 'active', revoked_at = NULL, revoked_by = NULL, updated_at = now()
        RETURNING id`)
      granted += Array.from(result as unknown as unknown[]).length
    }
  }
  return granted
}

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
  // One row id per fixture claim, shared by the claims insert and the claim_updates foreign key.
  const claimRowIds = new Map(casesFixture.map((c) => [c.claimId, randomUUID()] as const))

  const operatorUrl = process.env.UE_RUNTIME_OPERATOR_DATABASE_URL
  const runtimeUrl = process.env.UE_RUNTIME_DATABASE_URL
  if (
    !operatorUrl ||
    operatorUrl !== process.env.DATABASE_URL ||
    !runtimeUrl ||
    process.env.UE_CANONICAL_BOOTSTRAP_V2 !== '1'
  )
    throw new Error('Explicit operator fixture setup and canonical runtime credentials required')
  const operatorTarget = new URL(operatorUrl)
  if (
    operatorTarget.hostname !== '127.0.0.1' ||
    operatorTarget.username !== 'uev2admin' ||
    operatorTarget.pathname !== '/ue_runtime'
  )
    throw new Error('Owned local fixture operator required')
  const priorAuth = readRuntimeFixtureAuth(operatorUrl)
  const present = await db
    .select({ userId: authUsers.userId, email: authUsers.email })
    .from(authUsers)
    .where(inArray(authUsers.userId, userIds))
  if (present.length) {
    if (
      present.length !== usersFixture.length ||
      !priorAuth ||
      present.some(
        (row) => usersFixture.find((user) => user.userId === row.userId)?.email !== row.email,
      ) ||
      usersFixture.some(
        (user) =>
          priorAuth.users[user.userId]?.email !== user.email ||
          priorAuth.users[user.userId]?.organizationId !== user.orgId,
      )
    )
      throw new Error(
        'Partial or conflicting owned fixture requires a new runtime or explicit fresh setup',
      )
    await seedQaCaseAssignments(operatorUrl, {
      runtimeUrl,
      sessions: Object.fromEntries(
        Object.entries(priorAuth.users).map(([id, person]) => [id, person.sessionToken]),
      ),
    })
    console.log(
      '[ue:seed:test-env] Existing owned core fixtures preserved; canonical case authority verified',
    )
    return
  }
  const authFixture = createRuntimeFixtureAuth(operatorUrl, usersFixture)
  // Initial trusted fixture data only. Existing identities, history and audit
  // records are never deleted to make a repeat execution pass.
  await db.transaction(async (tx) => {
    await tx.insert(organizations).values(
      orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        organizationType: org.organizationType,
        hierarchyPath: [...org.hierarchyPath],
        hierarchyLevel: org.hierarchyLevel,
        // Snapshot enforces NOT NULL without server DEFAULTs for several
        // columns that only have drizzle client-side .default() — set explicitly.
        sectors: [],
        clcAffiliated: false,
        memberCount: 0,
        activeMemberCount: 0,
        settings: {},
        featuresEnabled: [],
        remittanceDay: 15,
        fiscalYearEnd: '2024-12-31',
        status: 'active',
        createdAt: NOW,
        updatedAt: NOW,
      })),
    )

    // Domain `users` and packages `authUsers` both map to user_management.users.
    // Domain schema drifts ahead of the canonical snapshot (e.g. phone_verified_at);
    // seed only through authUsers which matches the snapshot column set.
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

    // Same dual-mapping issue as users — prefer authOrganizationUsers only.
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

    // Opaque private setup bearers are validated through the real auth gateway
    // for governance setup. Browser journeys obtain different sessions by password and MFA.
    await tx.insert(authUserSessions).values(
      usersFixture.map((u) => {
        const rawToken = authFixture.users[u.userId]!.sessionToken
        return {
          userId: u.userId,
          organizationId: u.orgId,
          sessionToken: rawToken,
          sessionTokenHash: createHash('sha256').update(rawToken).digest('hex'),
          ipAddress: '127.0.0.1',
          userAgent: 'playwright-e2e-auth',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isActive: u.status === 'active',
          createdAt: NOW,
          lastUsedAt: NOW,
        }
      }),
    )

    await tx
      .insert(authMfaTotp)
      .values(
        usersFixture.map((user) => ({
          userId: user.userId,
          secretEncrypted: encryptSecret(authFixture.users[user.userId]!.mfaSecret),
          enabledAt: new Date(),
          recoveryCodesHashed: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
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

    // Seed profiles deterministically so dashboard layout's profile lookup
    // resolves on the first request. Without this, the layout takes the
    // auto-create branch which races dashboard/page.tsx in parallel and can
    // leave the role redirect un-issued (institutional identity substrate gap).
    {
      await tx
        .insert(profiles)
        .values(
          usersFixture.map((u) => ({
            // Snapshot profiles.id is NOT NULL without a server DEFAULT.
            id: randomUUID(),
            userId: u.userId,
            email: u.email,
            membership: 'free' as const,
            status: u.status,
            createdAt: NOW,
            updatedAt: NOW,
          })),
        )
        .onConflictDoUpdate({
          target: profiles.userId,
          set: {
            email: sql`excluded.email`,
            status: sql`excluded.status`,
            updatedAt: NOW,
          },
        })
    }

    await tx.insert(claims).values(
      casesFixture.map((c) => ({
        // Snapshot NOT NULL columns often lack server DEFAULTs that drizzle
        // .default() assumes — set client defaults explicitly.
        id: claimRowIds.get(c.claimId)!,
        claimId: c.claimId,
        claimNumber: c.claimNumber,
        organizationId: c.organizationId,
        memberId: c.memberId,
        isAnonymous: false,
        claimType: c.claimType,
        status: c.status,
        priority: c.priority,
        description: c.description,
        incidentDate: 'incidentDate' in c ? c.incidentDate : NOW,
        location: 'location' in c ? c.location : 'Unknown Location',
        desiredOutcome: 'desiredOutcome' in c ? c.desiredOutcome : null,
        witnessesPresent: false,
        previouslyReported: false,
        filedDate: NOW,
        assignedTo: 'assignedTo' in c ? c.assignedTo : null,
        assignedAt: 'assignedTo' in c ? NOW : null,
        progress: 0,
        claimAmount: '0',
        settlementAmount: '0',
        legalCosts: '0',
        courtCosts: '0',
        attachments: [],
        voiceTranscriptions: [],
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      })),
    )
  })

  // organization_members is load-bearing for RBAC / role-landing E2E. Soft-skipping
  // on schema drift previously masked missing platform DDL (everyone fell back to
  // member). Fail hard so CI surfaces the gap instead of timing out on role-nav.
  await db.transaction(async (tx) => {
    await tx.insert(organizationMembers).values(
      usersFixture.map((u) => ({
        // Snapshot organization_members.id is NOT NULL without a server DEFAULT;
        // Drizzle defaultRandom() emits SQL DEFAULT which then violates NOT NULL.
        id: randomUUID(),
        userId: u.userId,
        // organization_members.organization_id is the organization UUID.
        organizationId: u.orgId,
        role: u.role,
        status: u.status,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        metadata: 'metadata' in u ? u.metadata : null,
        isPrimary: true,
        // Snapshot has several NOT NULL columns without server DEFAULTs; Drizzle
        // emits SQL DEFAULT for omitted schema fields which then violates NOT NULL.
        memberCategory: 'full_member',
        exemptFromPerCapita: false,
        joinedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      })),
    )
  })

  // Initial synthetic history is source data, with schema drift refused.
  await db.transaction(async (tx) => {
    await tx.insert(claimUpdates).values(
      casesFixture.map((c, index) => ({
        // Snapshot claim_updates.id/update_id often NOT NULL without server DEFAULT.
        id: randomUUID(),
        updateId: randomUUID(),
        // The FK targets claims.id, which is the row id inserted above.
        claimId: claimRowIds.get(c.claimId)!,
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

  // Case authority is relationship-based: give the QA steward the QA cases (synthetic fixture, audited by the store).
  writeRuntimeFixtureAuth(authFixture)
  const assignments = await seedQaCaseAssignments(operatorUrl, {
    runtimeUrl,
    sessions: Object.fromEntries(
      Object.entries(authFixture.users).map(([id, person]) => [id, person.sessionToken]),
    ),
  })
  console.log(`[ue:seed:test-env] QA case assignments created: ${assignments}`)

  // Module entitlements are institutional grants. The QA organizations get synthetic, clearly marked grants for every module
  // so the application can be exercised end to end; no production organization is ever touched (see assertSafeRuntime).
  const entitlementCount = await seedQaEntitlements([
    UE_TEST_ORGS.primary.id,
    UE_TEST_ORGS.secondary.id,
  ])
  console.log(`[ue:seed:test-env] QA module entitlements granted: ${entitlementCount}`)

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
      },
      null,
      2,
    ),
  )
}

seed().catch((error) => {
  const failure = error as {
    name?: string
    code?: string
    cause?: { code?: string; table?: string; column?: string }
  }
  console.error('[ue:seed:test-env] Failed', {
    name: failure.name,
    code: failure.cause?.code ?? failure.code,
    table: failure.cause?.table,
    column: failure.cause?.column,
  })
  process.exit(1)
})
