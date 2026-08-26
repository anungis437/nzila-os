/**
 * Tests for platform-tenant.ts — Phase 0B resolver / provisioner.
 *
 * These tests use the same DB-mock chain pattern as
 * `organization-utils.test.ts` so we don't need a live PG connection.
 * The DB contract (FK + CHECK enforcement, backfill, provisioning) is
 * proved separately by:
 *   * migration 0038's dev-DB apply + verify (phase-0b-dev-migrate.log)
 *   * clean-DB replay proof (phase-0b-clean-db-proof.log)
 *   * organization-provisioning-proof.md
 *
 * These unit tests cover the resolver's SEMANTIC contract: null vs
 * throw vs string, and the provisioning ordering (precondition → insert
 * → update).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockOnConflictDoNothing: vi.fn(),
  mockExecute: vi.fn(),
}))

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    execute: mocks.mockExecute,
  },
}))

vi.mock('@/db/schema-organizations', () => ({
  organizations: { id: 'id' },
}))

vi.mock('@nzila/db/schema', () => ({
  orgs: { id: 'id' },
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
    sql: Object.assign(
      vi.fn((..._args: unknown[]) => ({ type: 'sql' })),
      { raw: vi.fn() },
    ),
    relations: vi.fn(() => ({})),
  }
})

/** Chain: db.select().from().where().limit() → Promise<rows[]> */
function primeSelect(rows: Array<Record<string, unknown>>) {
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom })
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere })
  mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit })
  mocks.mockLimit.mockResolvedValue(rows)
}

/**
 * Sequential select-chain primer for tests that call resolve/select
 * more than once (e.g. provision calls select first, then insert, then
 * update). Each invocation of `.limit()` returns the next batch.
 */
function primeSelectSequence(...batches: Array<Array<Record<string, unknown>>>) {
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom })
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere })
  mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit })
  let call = 0
  mocks.mockLimit.mockImplementation(() => {
    const idx = Math.min(call, batches.length - 1)
    call++
    return Promise.resolve(batches[idx])
  })
}

/** Chain: db.insert().values().onConflictDoNothing() → Promise */
function primeInsert() {
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues })
  mocks.mockValues.mockReturnValue({
    onConflictDoNothing: mocks.mockOnConflictDoNothing,
  })
  mocks.mockOnConflictDoNothing.mockResolvedValue(undefined)
}

describe('platform-tenant resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockExecute.mockResolvedValue(undefined)
  })

  // ── resolvePlatformTenantId ────────────────────────────────────────

  describe('resolvePlatformTenantId', () => {
    it('returns the platform_tenant_id when set', async () => {
      const orgId = '11111111-1111-4111-8111-111111111111'
      primeSelect([{ platformTenantId: orgId }])

      const { resolvePlatformTenantId } = await import('../organizations/platform-tenant')
      const result = await resolvePlatformTenantId(orgId)

      expect(result).toBe(orgId)
      expect(mocks.mockSelect).toHaveBeenCalledOnce()
    })

    it('returns null when platform_tenant_id is NULL', async () => {
      const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      primeSelect([{ platformTenantId: null }])

      const { resolvePlatformTenantId } = await import('../organizations/platform-tenant')
      const result = await resolvePlatformTenantId(orgId)

      expect(result).toBeNull()
    })

    it('returns null when the organizations row does not exist', async () => {
      primeSelect([])

      const { resolvePlatformTenantId } = await import('../organizations/platform-tenant')
      const result = await resolvePlatformTenantId(
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      )

      expect(result).toBeNull()
    })
  })

  // ── requirePlatformTenantId ────────────────────────────────────────

  describe('requirePlatformTenantId', () => {
    it('returns the id when platform_tenant_id is set', async () => {
      const orgId = '22222222-2222-4222-8222-222222222222'
      primeSelect([{ platformTenantId: orgId }])

      const { requirePlatformTenantId } = await import('../organizations/platform-tenant')
      const result = await requirePlatformTenantId(orgId)

      expect(result).toBe(orgId)
    })

    it('throws PlatformTenantMappingRequired when platform_tenant_id is NULL', async () => {
      const orgId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      primeSelect([{ platformTenantId: null }])

      const { requirePlatformTenantId, PlatformTenantMappingRequired } =
        await import('../organizations/platform-tenant')

      await expect(requirePlatformTenantId(orgId)).rejects.toBeInstanceOf(
        PlatformTenantMappingRequired,
      )
      await expect(requirePlatformTenantId(orgId)).rejects.toMatchObject({
        code: 'PLATFORM_TENANT_MAPPING_REQUIRED',
        organizationId: orgId,
      })
    })

    it('throws PlatformTenantMappingRequired when organizations row is missing', async () => {
      primeSelect([])

      const { requirePlatformTenantId, PlatformTenantMappingRequired } =
        await import('../organizations/platform-tenant')

      await expect(
        requirePlatformTenantId('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
      ).rejects.toBeInstanceOf(PlatformTenantMappingRequired)
    })
  })

  // ── provisionPlatformParticipant ───────────────────────────────────

  describe('provisionPlatformParticipant', () => {
    it('inserts orgs row and updates platform_tenant_id (idempotent)', async () => {
      const orgId = '33333333-3333-4333-8333-333333333333'
      // 1st select: precondition check finds organizations row.
      primeSelectSequence([{ id: orgId }])
      primeInsert()

      const { provisionPlatformParticipant } = await import('../organizations/platform-tenant')
      const result = await provisionPlatformParticipant({
        organizationId: orgId,
        legalName: 'UE QA External Tester Sandbox',
        jurisdiction: 'CA-ON',
        policyConfig: { synthetic: true, provenance: 'phase-0b-synthetic-qa' },
      })

      expect(result).toBe(orgId)
      // Precondition select happened.
      expect(mocks.mockSelect).toHaveBeenCalledOnce()
      // Insert into orgs with same-UUID id happened.
      expect(mocks.mockInsert).toHaveBeenCalledOnce()
      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: orgId,
          legalName: 'UE QA External Tester Sandbox',
          jurisdiction: 'CA-ON',
          status: 'active',
        }),
      )
      expect(mocks.mockOnConflictDoNothing).toHaveBeenCalledOnce()
      // UPDATE organizations.platform_tenant_id happened.
      expect(mocks.mockExecute).toHaveBeenCalledOnce()
    })

    it('rejects when organizations row does not exist (boundary respected)', async () => {
      primeSelectSequence([]) // precondition check → empty
      primeInsert()

      const { provisionPlatformParticipant } = await import('../organizations/platform-tenant')

      await expect(
        provisionPlatformParticipant({
          organizationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          legalName: 'nope',
          jurisdiction: 'CA-ON',
        }),
      ).rejects.toThrow(/organizations row .* does not exist/)

      // Must NOT have attempted an insert into orgs.
      expect(mocks.mockInsert).not.toHaveBeenCalled()
      expect(mocks.mockExecute).not.toHaveBeenCalled()
    })

    it('is idempotent when called twice for the same organization', async () => {
      const orgId = '44444444-4444-4444-8444-444444444444'
      // Both invocations: precondition finds the row.
      primeSelectSequence([{ id: orgId }], [{ id: orgId }])
      primeInsert()

      const { provisionPlatformParticipant } = await import('../organizations/platform-tenant')

      const first = await provisionPlatformParticipant({
        organizationId: orgId,
        legalName: 'UE Production Like Guardrail Org',
        jurisdiction: 'CA-ON',
      })
      const second = await provisionPlatformParticipant({
        organizationId: orgId,
        legalName: 'UE Production Like Guardrail Org',
        jurisdiction: 'CA-ON',
      })

      expect(first).toBe(orgId)
      expect(second).toBe(orgId)
      // Both calls exercised insert (ON CONFLICT DO NOTHING makes second a no-op at DB level).
      expect(mocks.mockInsert).toHaveBeenCalledTimes(2)
      expect(mocks.mockOnConflictDoNothing).toHaveBeenCalledTimes(2)
      // Both calls exercised the guarded UPDATE (WHERE platform_tenant_id IS NULL makes second a no-op at DB level).
      expect(mocks.mockExecute).toHaveBeenCalledTimes(2)
    })

    it('defaults policyConfig to empty object when omitted', async () => {
      const orgId = '55555555-5555-4555-8555-555555555555'
      primeSelectSequence([{ id: orgId }])
      primeInsert()

      const { provisionPlatformParticipant } = await import('../organizations/platform-tenant')
      await provisionPlatformParticipant({
        organizationId: orgId,
        legalName: 'X',
        jurisdiction: 'CA-ON',
      })

      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ policyConfig: {} }),
      )
    })
  })
})

