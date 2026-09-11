import { describe, expect, it, vi } from 'vitest'

/**
 * Round 56 regression test: external_calendar_connections stores raw OAuth
 * access/refresh tokens per connecting user. The collection + item routes
 * previously scoped only by `organizationId` (via `orgScoped: true`), which
 * let ANY authenticated org member read every other member's raw OAuth
 * tokens through the generic CRUD factory. The fix adds `ownerColumn:
 * 'userId'` (restricts every operation to the caller's own row) and a
 * `beforeCreate` hook that force-stamps `userId` from the authenticated
 * caller so ownership can never be spoofed via the request body.
 *
 * This test asserts the ROUTE CONFIGURATION passed to `crudRoutes` — the
 * factory's own `ownerColumn`/`beforeCreate` enforcement is covered by
 * lib/api/__tests__/crud-factory.test.ts.
 */

const mocks = vi.hoisted(() => ({
  crudRoutes: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() })),
}))

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: mocks.crudRoutes }))
vi.mock('@/db/schema', () => ({ externalCalendarConnections: { __table: 'external_calendar_connections' } }))

describe('calendar-sync/connections routes (round 56 — owner-scoping credential fix)', () => {
  it('collection route configures ownerColumn + beforeCreate userId stamping', async () => {
    mocks.crudRoutes.mockClear()
    await import('@/app/api/calendar-sync/connections/route')

    expect(mocks.crudRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        orgScoped: true,
        ownerColumn: 'userId',
        beforeCreate: expect.any(Function),
      })
    )

    const config = mocks.crudRoutes.mock.calls[0][0]
    const stamped = config.beforeCreate({ userId: 'attacker-supplied-other-user' }, { userId: 'caller-own-id', organizationId: 'org-1' })
    expect(stamped.userId).toBe('caller-own-id')
  })

  it('item route configures ownerColumn (no beforeCreate needed — GET/PATCH/DELETE only)', async () => {
    mocks.crudRoutes.mockClear()
    await import('@/app/api/calendar-sync/connections/[id]/route')

    expect(mocks.crudRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        orgScoped: true,
        ownerColumn: 'userId',
        itemRoute: true,
      })
    )
  })
})
