import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { rewardWalletLedger } from '@/db/schema/domains/infrastructure/rewards'
import { createTableDatabase } from '@/app/api/__tests__/support/pglite-tables'

// DEF-0B11-PRP-WALLET-GET-READS-BALANCE-AND-LEDGER-SEPARATELY: the balance and the page of the ledger from one snapshot.

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/db', async () => {
  const { lateBoundDb } = await import('@/app/api/__tests__/support/pglite-tables')
  return { db: lateBoundDb(state) }
})

import { getWalletSnapshot } from '../wallet-service'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
let pg: PGlite

const entry = (org: string, user: string, amount: number, balanceAfter: number, minutesAgo: number) =>
  pg.query(
    `INSERT INTO reward_wallet_ledger (org_id, user_id, event_type, amount_credits, balance_after, source_type, created_at)
     VALUES ($1::uuid, $2, 'earn', $3, $4, 'award', now() - ($5 || ' minutes')::interval)`,
    [org, user, amount, balanceAfter, String(minutesAgo)],
  )

beforeAll(async () => {
  const created = await createTableDatabase([rewardWalletLedger])
  pg = created.pg
  state.db = created.db
})
afterAll(async () => {
  await pg.close()
})
beforeEach(async () => {
  await pg.exec('TRUNCATE reward_wallet_ledger')
})

describe('wallet snapshot', () => {
  it('answers the latest balance with a page of the ledger and the total', async () => {
    await entry(ORG, 'u1', 10, 10, 30)
    await entry(ORG, 'u1', 5, 15, 20)
    await entry(ORG, 'u1', 7, 22, 10)
    const first = await getWalletSnapshot(ORG, 'u1', 2, 0)
    expect(first.balance).toBe(22)
    expect(first.entries.map((e) => e.balanceAfter)).toEqual([22, 15])
    expect(first.total).toBe(3)
    const second = await getWalletSnapshot(ORG, 'u1', 2, 2)
    expect(second.balance).toBe(22)
    expect(second.entries.map((e) => e.balanceAfter)).toEqual([10])
  })

  it('reads only the caller\'s own organization and member', async () => {
    await entry(ORG, 'u1', 10, 10, 5)
    await entry(OTHER, 'u1', 99, 99, 1)
    await entry(ORG, 'u2', 50, 50, 1)
    const snapshot = await getWalletSnapshot(ORG, 'u1', 20, 0)
    expect(snapshot).toMatchObject({ balance: 10, total: 1 })
  })

  it('answers zero for a member with no ledger', async () => {
    expect(await getWalletSnapshot(ORG, 'nobody', 20, 0)).toMatchObject({ balance: 0, entries: [], total: 0 })
  })
})
