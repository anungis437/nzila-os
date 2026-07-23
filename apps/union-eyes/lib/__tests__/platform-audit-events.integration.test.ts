/**
 * Phase 0B.2R §7 — Real PostgreSQL integration test for
 * `emitPlatformAuditEvent` + `requirePlatformTenantId`.
 *
 * This test satisfies the Phase 0B.2R mandate:
 *   "at least one test must execute:
 *    API/server action → resolver → PostgreSQL.
 *    Mocks alone are insufficient."
 *
 * The chain exercised:
 *   test (server-side helper caller)
 *     → emitPlatformAuditEvent (server action)
 *       → requirePlatformTenantId (resolver)
 *         → PostgreSQL SELECT on `public.organizations` (real DB)
 *       → PostgreSQL INSERT on `public.audit_events` (real DB)
 *
 * The test is SKIPPED unless the PHASE0B2R_INTEGRATION_DB_URL environment
 * variable is set. This keeps standard `pnpm test` runs mock-only while
 * still enforcing that a real-DB proof path exists and is runnable.
 *
 * To run locally against the native dev DB:
 *   $env:PHASE0B2R_INTEGRATION_DB_URL = "postgres://nzila:nzila_dev@localhost:5433/nzila_automation"
 *   pnpm exec vitest run apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts
 *
 * The test uses fixed UUIDs so it is idempotent across runs; seed operations
 * are `ON CONFLICT DO NOTHING`. `audit_events` rows are append-only (may have
 * an immutability trigger) so the test filters its assertions by the unique
 * actor tag `test:phase0b2r-section-7:<runId>` to isolate rows from this
 * test invocation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const DB_URL = process.env.PHASE0B2R_INTEGRATION_DB_URL
const describeIfDb = DB_URL ? describe : describe.skip

// Fixed test UUIDs — deterministic seed identity.
const HAPPY_ORG_ID = '00000007-0000-4007-8007-000000000007'
const FAIL_ORG_ID = '00000007-0000-4007-8007-000000000008'
const HAPPY_ORG_SLUG = '__phase0b2r_section7_happy__'
const FAIL_ORG_SLUG = '__phase0b2r_section7_fail__'

describeIfDb('emitPlatformAuditEvent — real PostgreSQL (Phase 0B.2R §7)', () => {
  // Unique per-run actor tag so we can locate this run's audit_events rows.
  const runId = randomUUID()
  const actorUserId = `test:phase0b2r-section-7:${runId}`

  let client: ReturnType<typeof postgres>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any

  beforeAll(async () => {
    client = postgres(DB_URL!, { max: 2, prepare: false })
    db = drizzle(client)

    // Seed the "happy path" org — will be provisioned as a platform
    // participant below via the real provisionPlatformParticipant helper.
    await db.execute(sql`
      INSERT INTO public.organizations (id, name, slug, organization_type, hierarchy_path)
      VALUES (
        ${HAPPY_ORG_ID}::uuid,
        'Phase 0B.2R §7 happy-path test org',
        ${HAPPY_ORG_SLUG},
        'local',
        ARRAY[]::text[]
      )
      ON CONFLICT (slug) DO NOTHING
    `)

    // Seed the "fail-closed" org — intentionally NOT provisioned.
    // Its platform_tenant_id column stays NULL, which must cause
    // requirePlatformTenantId to throw PlatformTenantMappingRequired.
    await db.execute(sql`
      INSERT INTO public.organizations (id, name, slug, organization_type, hierarchy_path)
      VALUES (
        ${FAIL_ORG_ID}::uuid,
        'Phase 0B.2R §7 fail-closed test org',
        ${FAIL_ORG_SLUG},
        'local',
        ARRAY[]::text[]
      )
      ON CONFLICT (slug) DO NOTHING
    `)

    // Reset the fail-closed org's platform_tenant_id in case a prior
    // run of a *different* test provisioned it. This test's contract
    // requires FAIL_ORG_ID to have NULL platform_tenant_id.
    await db.execute(sql`
      UPDATE public.organizations
      SET platform_tenant_id = NULL
      WHERE id = ${FAIL_ORG_ID}::uuid
    `)
  })

  afterAll(async () => {
    await client.end({ timeout: 2 })
  })

  it('happy path — provisioning + emit round-trip inserts into public.audit_events with resolved org_id', async () => {
    // Import inside the test so the helper's module-level `db` proxy is
    // only realised when we already have DB_URL set (safety belt).
    const { provisionPlatformParticipant, requirePlatformTenantId } =
      await import('../organizations/platform-tenant')
    const { emitPlatformAuditEvent } = await import('../audit/platform-audit-events')

    // Provision — idempotent. Uses our test drizzle client, so no
    // dependency on the shared @/db/db singleton.
    const platformTenantId = await provisionPlatformParticipant(
      {
        organizationId: HAPPY_ORG_ID,
        legalName: 'Phase 0B.2R §7 happy-path test org',
        jurisdiction: 'CA',
      },
      db,
    )
    expect(platformTenantId).toBe(HAPPY_ORG_ID)

    // Resolver must now succeed.
    const resolved = await requirePlatformTenantId(HAPPY_ORG_ID, db)
    expect(resolved).toBe(HAPPY_ORG_ID)

    // Real emit.
    const emitted = await emitPlatformAuditEvent(
      {
        organizationId: HAPPY_ORG_ID,
        actorUserId,
        actorRole: 'system',
        action: 'test.phase0b2r.section7.emit',
        targetType: 'organization',
        targetId: HAPPY_ORG_ID,
        afterJson: { runId, marker: 'phase-0b2r-section-7' },
      },
      db,
    )

    expect(emitted.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(emitted.orgId).toBe(HAPPY_ORG_ID)
    expect(emitted.hash).toMatch(/^[0-9a-f]{64}$/)

    // Verify the row physically landed in PostgreSQL with the correct
    // org_id (UUID — must NOT be a prefixed text id).
    const rows = (await db.execute(sql`
      SELECT id::text AS id, org_id::text AS org_id, actor_user_id, action, hash
      FROM public.audit_events
      WHERE actor_user_id = ${actorUserId}
        AND action = 'test.phase0b2r.section7.emit'
    `)) as unknown as Array<{
      id: string
      org_id: string
      actor_user_id: string
      action: string
      hash: string
    }>

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(emitted.id)
    expect(rows[0].org_id).toBe(HAPPY_ORG_ID)
    expect(rows[0].actor_user_id).toBe(actorUserId)
    expect(rows[0].hash).toBe(emitted.hash)
  })

  it('fail-closed — unprovisioned org throws PlatformTenantMappingRequired and writes no audit_events row', async () => {
    const { emitPlatformAuditEvent } = await import('../audit/platform-audit-events')
    const { PlatformTenantMappingRequired } = await import(
      '../organizations/platform-tenant'
    )

    const failMarker = `${actorUserId}:fail`

    let caught: unknown
    try {
      await emitPlatformAuditEvent(
        {
          organizationId: FAIL_ORG_ID,
          actorUserId: failMarker,
          action: 'test.phase0b2r.section7.emit',
          targetType: 'organization',
          targetId: FAIL_ORG_ID,
        },
        db,
      )
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(PlatformTenantMappingRequired)
    // The error class exposes a stable machine-readable code.
    expect((caught as { code?: string })?.code).toBe(
      'PLATFORM_TENANT_MAPPING_REQUIRED',
    )

    // Prove no row was written.
    const rows = (await db.execute(sql`
      SELECT COUNT(*)::int AS n
      FROM public.audit_events
      WHERE actor_user_id = ${failMarker}
    `)) as unknown as Array<{ n: number }>
    expect(rows[0].n).toBe(0)
  })
})
