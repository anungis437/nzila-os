import { beforeEach, describe, expect, it, vi } from 'vitest'
import { txDouble } from '@/lib/page-data/__tests__/tx-double'

vi.mock('@/lib/db/with-rls-context', async () =>
  (await import('@/lib/page-data/__tests__/tx-double')).txDoubleModule(),
)

const totals = vi.hoisted(() => ({ calculateRewardTotals: vi.fn() }))
vi.mock('@/lib/utils/rewards-stats-utils', () => totals)

import {
  HISTORY_PAGE_SIZES,
  loadActiveProgram,
  loadCreditHistory,
  loadMemberNames,
  loadWalletBalance,
  loadWalletOverview,
  parseCreditHistoryQuery,
} from '../page-reads'

const ORG = '4f0d6b5e-8a52-4c5e-9d0e-2f3b8d9a1c11'
const USER = 'member-1'

beforeEach(() => {
  txDouble.reset()
  totals.calculateRewardTotals.mockReset()
})

/** Everything ran in the organization's context, and each statement was filtered by it. */
function expectOrganizationScoped(statementCount: number): void {
  expect(txDouble.contexts).toEqual([{ organizationId: ORG }])
  expect(txDouble.systemContexts).toBe(0)
  expect(txDouble.statements).toHaveLength(statementCount)
  for (const statement of txDouble.statements) {
    expect(statement.context).toBe(ORG)
    expect(statement.where?.params).toContain(ORG)
  }
}

describe('parseCreditHistoryQuery', () => {
  it('uses the whole ledger, 50 to a page and the first page when nothing is asked', () => {
    expect(parseCreditHistoryQuery({})).toEqual({ eventType: 'all', limit: 50, page: 1 })
  })

  it.each(['earn', 'spend', 'expire', 'revoke', 'refund', 'adjust'])(
    'keeps the event type %s',
    (eventType) => {
      expect(parseCreditHistoryQuery({ eventType }).eventType).toBe(eventType)
    },
  )

  it.each([['nonsense'], ['EARN'], ["earn' OR '1'='1"], ['']])(
    'makes the unknown event type %j "all"',
    (eventType) => {
      expect(parseCreditHistoryQuery({ eventType }).eventType).toBe('all')
    },
  )

  it.each(HISTORY_PAGE_SIZES)('keeps the offered page size %i', (limit) => {
    expect(parseCreditHistoryQuery({ limit: String(limit) }).limit).toBe(limit)
  })

  it.each([['7'], ['0'], ['-25'], ['100000'], ['abc']])(
    'replaces the page size %j with 50',
    (limit) => {
      expect(parseCreditHistoryQuery({ limit }).limit).toBe(50)
    },
  )

  it.each([
    ['3', 3],
    ['1', 1],
    ['0', 1],
    ['-2', 1],
    ['x', 1],
    [undefined, 1],
  ])('reads the page %j as %i', (page, expected) => {
    expect(parseCreditHistoryQuery({ page }).page).toBe(expected)
  })
})

describe('loadMemberNames', () => {
  it('names the members of the organization by user id, leaving out anybody without a name', async () => {
    txDouble.queue([
      { userId: 'u1', name: 'Alice Member' },
      { userId: 'u2', name: '' },
    ])

    expect(await loadMemberNames(ORG, ['u1', 'u2', 'u3'])).toEqual({ u1: 'Alice Member' })

    expectOrganizationScoped(1)
    expect(txDouble.statements[0].where?.params).toEqual([ORG, 'u1', 'u2', 'u3'])
  })

  it('opens no transaction at all when there is nobody to name', async () => {
    expect(await loadMemberNames(ORG, [])).toEqual({})

    expect(txDouble.contexts).toEqual([])
    expect(txDouble.statements).toEqual([])
  })
})

describe('loadActiveProgram', () => {
  it('is the newest active program of the organization', async () => {
    txDouble.queue([{ id: 'program-1', name: 'Recognition' }])

    expect(await loadActiveProgram(ORG)).toEqual({ id: 'program-1', name: 'Recognition' })

    expectOrganizationScoped(1)
    expect(txDouble.statements[0].where?.sql).toMatch(
      /"recognition_programs"\."org_id" = \$1 and "recognition_programs"\."status" = \$2/,
    )
    expect(txDouble.statements[0].where?.params).toEqual([ORG, 'active'])
  })

  it('is null for an organization with no active program, and rejects when the database fails', async () => {
    txDouble.queue([])
    expect(await loadActiveProgram(ORG)).toBeNull()

    txDouble.reset()
    txDouble.queue(new Error('connection lost'))
    await expect(loadActiveProgram(ORG)).rejects.toThrow('connection lost')
  })
})

describe('held credit page adapters', () => {
  it.each([
    () => loadWalletBalance(ORG, USER),
    () => loadWalletOverview(ORG, USER),
    () => loadCreditHistory(ORG, USER, parseCreditHistoryQuery({})),
  ])('does not disguise unavailable credit state as an empty wallet/history', async (operation) => {
    await expect(Promise.resolve().then(operation)).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
      status: 501,
    })
    expect(txDouble.contexts).toEqual([])
    expect(txDouble.statements).toEqual([])
    expect(totals.calculateRewardTotals).not.toHaveBeenCalled()
  })
})
