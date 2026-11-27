/**
 * Unit tests for the org_entitlements DB adapter (Watch 3).
 *
 * The adapter is intentionally decoupled from `platformDb`: it accepts a
 * narrow `EntitlementsDb` interface so we can verify the query shape
 * without booting Drizzle.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { resolveEntitlementFromDb, type EntitlementsDb } from './entitlements-db'

function buildDb(rows: readonly unknown[]): {
  db: EntitlementsDb
  spies: {
    select: ReturnType<typeof vi.fn>
    from: ReturnType<typeof vi.fn>
    where: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
  }
} {
  const limit = vi.fn(async () => rows)
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  return {
    db: { select } as unknown as EntitlementsDb,
    spies: { select, from, where, limit },
  }
}

describe('resolveEntitlementFromDb', () => {
  const orgId = '11111111-1111-4111-8111-111111111111'
  const feature = 'decisions.replay'

  it('returns null when no row matches', async () => {
    const { db, spies } = buildDb([])
    const result = await resolveEntitlementFromDb(db, orgId, feature)
    expect(result).toBeNull()
    expect(spies.select).toHaveBeenCalledTimes(1)
    expect(spies.where).toHaveBeenCalledTimes(1)
    expect(spies.limit).toHaveBeenCalledWith(1)
  })

  it('hydrates a row with no expiry', async () => {
    const { db } = buildDb([
      {
        tier: 'professional',
        limit: 100,
        expiresAt: null,
        source: 'stripe',
      },
    ])
    const result = await resolveEntitlementFromDb(db, orgId, feature)
    expect(result).toEqual({
      tier: 'professional',
      limit: 100,
      expiresAt: null,
      source: 'stripe',
    })
  })

  it('serialises Date expiresAt as ISO string', async () => {
    const expiry = new Date('2027-01-01T00:00:00.000Z')
    const { db } = buildDb([
      {
        tier: 'enterprise',
        limit: null,
        expiresAt: expiry,
        source: 'manual',
      },
    ])
    const result = await resolveEntitlementFromDb(db, orgId, feature)
    expect(result).toEqual({
      tier: 'enterprise',
      limit: null,
      expiresAt: '2027-01-01T00:00:00.000Z',
      source: 'manual',
    })
  })

  it('passes through string expiresAt unchanged', async () => {
    const iso = '2027-06-01T12:00:00.000Z'
    const { db } = buildDb([
      {
        tier: 'standard',
        limit: 10,
        expiresAt: iso,
        source: 'pilot-grant',
      },
    ])
    const result = await resolveEntitlementFromDb(db, orgId, feature)
    expect(result?.expiresAt).toBe(iso)
  })

  it('normalises missing limit to null', async () => {
    const { db } = buildDb([
      {
        tier: 'free',
        limit: undefined,
        expiresAt: null,
        source: 'seed',
      },
    ])
    const result = await resolveEntitlementFromDb(db, orgId, feature)
    expect(result?.limit).toBeNull()
  })

  it('propagates DB errors', async () => {
    const failingLimit = vi.fn(async () => {
      throw new Error('connection refused')
    })
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: failingLimit }),
        }),
      }),
    } as unknown as EntitlementsDb

    await expect(resolveEntitlementFromDb(db, orgId, feature)).rejects.toThrow(
      'connection refused',
    )
  })
})
