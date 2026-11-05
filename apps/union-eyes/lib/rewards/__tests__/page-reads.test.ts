import { beforeEach, describe, expect, it, vi } from 'vitest';
import { txDouble } from '@/lib/page-data/__tests__/tx-double';

vi.mock('@/lib/db/with-rls-context', async () => (await import('@/lib/page-data/__tests__/tx-double')).txDoubleModule());

const totals = vi.hoisted(() => ({ calculateRewardTotals: vi.fn() }));
vi.mock('@/lib/utils/rewards-stats-utils', () => totals);

import {
  HISTORY_PAGE_SIZES,
  WALLET_PAGE_SIZE,
  listRecognitionCandidates,
  loadActiveProgram,
  loadCreditHistory,
  loadMemberNames,
  loadWalletBalance,
  loadWalletOverview,
  parseCreditHistoryQuery,
} from '../page-reads';

const ORG = '4f0d6b5e-8a52-4c5e-9d0e-2f3b8d9a1c11';
const USER = 'member-1';

beforeEach(() => {
  txDouble.reset();
  totals.calculateRewardTotals.mockReset();
});

/** Everything ran in the organization's context, and each statement was filtered by it. */
function expectOrganizationScoped(statementCount: number): void {
  expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
  expect(txDouble.systemContexts).toBe(0);
  expect(txDouble.statements).toHaveLength(statementCount);
  for (const statement of txDouble.statements) {
    expect(statement.context).toBe(ORG);
    expect(statement.where?.params).toContain(ORG);
  }
}

describe('loadWalletBalance', () => {
  it('is the balance after the newest entry of the member, read in the organization', async () => {
    txDouble.queue([{ balanceAfter: 70 }]);

    expect(await loadWalletBalance(ORG, USER)).toBe(70);

    expectOrganizationScoped(1);
    expect(txDouble.statements[0].where?.sql).toMatch(/"reward_wallet_ledger"\."org_id" = \$1 and "reward_wallet_ledger"\."user_id" = \$2/);
    expect(txDouble.statements[0].where?.params).toEqual([ORG, USER]);
  });

  it('is zero for a member with no entry, and rejects instead of showing zero when the database fails', async () => {
    txDouble.queue([]);
    expect(await loadWalletBalance(ORG, USER)).toBe(0);

    txDouble.reset();
    txDouble.queue(new Error('connection lost'));
    await expect(loadWalletBalance(ORG, USER)).rejects.toThrow('connection lost');
  });
});

describe('parseCreditHistoryQuery', () => {
  it('uses the whole ledger, 50 to a page and the first page when nothing is asked', () => {
    expect(parseCreditHistoryQuery({})).toEqual({ eventType: 'all', limit: 50, page: 1 });
  });

  it.each(['earn', 'spend', 'expire', 'revoke', 'refund', 'adjust'])('keeps the event type %s', (eventType) => {
    expect(parseCreditHistoryQuery({ eventType }).eventType).toBe(eventType);
  });

  it.each([['nonsense'], ['EARN'], ["earn' OR '1'='1"], ['']])('makes the unknown event type %j "all"', (eventType) => {
    expect(parseCreditHistoryQuery({ eventType }).eventType).toBe('all');
  });

  it.each(HISTORY_PAGE_SIZES)('keeps the offered page size %i', (limit) => {
    expect(parseCreditHistoryQuery({ limit: String(limit) }).limit).toBe(limit);
  });

  it.each([['7'], ['0'], ['-25'], ['100000'], ['abc']])('replaces the page size %j with 50', (limit) => {
    expect(parseCreditHistoryQuery({ limit }).limit).toBe(50);
  });

  it.each([
    ['3', 3],
    ['1', 1],
    ['0', 1],
    ['-2', 1],
    ['x', 1],
    [undefined, 1],
  ])('reads the page %j as %i', (page, expected) => {
    expect(parseCreditHistoryQuery({ page }).page).toBe(expected);
  });
});

describe('loadCreditHistory', () => {
  const perType = [
    { eventType: 'earn', entries: 3, credits: 150 },
    { eventType: 'spend', entries: 2, credits: -40 },
    { eventType: 'expire', entries: 1, credits: -10 },
  ];

  it('reads a page of the matching entries and the totals over the whole ledger, in the organization', async () => {
    txDouble.queue([{ id: 'e1' }], perType);

    const history = await loadCreditHistory(ORG, USER, { eventType: 'all', limit: 25, page: 2 });

    expect(history).toEqual({ entries: [{ id: 'e1' }], matching: 6, totalTransactions: 6, totalEarned: 150, totalSpent: 40, totalExpired: 10 });
    expectOrganizationScoped(2);
    expect(txDouble.statements[0].where?.params).toEqual([ORG, USER]);
    expect(txDouble.statements[1].where?.params).toEqual([ORG, USER]);
  });

  it('filters the entries by the event type in the database, and the totals still cover every type', async () => {
    txDouble.queue([{ id: 'e2' }], perType);

    const history = await loadCreditHistory(ORG, USER, { eventType: 'spend', limit: 50, page: 1 });

    expect(txDouble.statements[0].where?.sql).toMatch(/"event_type" = \$3/);
    expect(txDouble.statements[0].where?.params).toEqual([ORG, USER, 'spend']);
    expect(txDouble.statements[1].where?.sql).not.toMatch(/event_type/);
    expect(history).toMatchObject({ matching: 2, totalTransactions: 6, totalEarned: 150, totalSpent: 40 });
  });

  it('finds nothing matching, and zero totals, for a member with no entries', async () => {
    txDouble.queue([], []);

    expect(await loadCreditHistory(ORG, USER, { eventType: 'refund', limit: 50, page: 1 })).toEqual({
      entries: [],
      matching: 0,
      totalTransactions: 0,
      totalEarned: 0,
      totalSpent: 0,
      totalExpired: 0,
    });
  });

  it('rejects when the database fails, rather than answering an empty history', async () => {
    txDouble.queue(new Error('connection lost'));

    await expect(loadCreditHistory(ORG, USER, { eventType: 'all', limit: 50, page: 1 })).rejects.toThrow('connection lost');
  });
});

describe('loadWalletOverview', () => {
  it('is the newest entries, the balance after the newest of them, and the totals, read in the organization', async () => {
    txDouble.queue([{ balanceAfter: 70 }, { balanceAfter: 100 }]);
    totals.calculateRewardTotals.mockResolvedValue({ totalEarned: 100, totalRedeemed: 30 });

    const overview = await loadWalletOverview(ORG, USER);

    expect(overview).toEqual({ balance: 70, entries: [{ balanceAfter: 70 }, { balanceAfter: 100 }], totalEarned: 100, totalRedeemed: 30 });
    expect(totals.calculateRewardTotals).toHaveBeenCalledWith(USER, ORG);
    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(WALLET_PAGE_SIZE).toBe(20);
  });

  it('is an empty wallet for a member with no entry', async () => {
    txDouble.queue([]);
    totals.calculateRewardTotals.mockResolvedValue({ totalEarned: 0, totalRedeemed: 0 });

    expect(await loadWalletOverview(ORG, USER)).toEqual({ balance: 0, entries: [], totalEarned: 0, totalRedeemed: 0 });
  });
});

describe('listRecognitionCandidates', () => {
  const rows = [
    { userId: 'u1', name: 'Alice Member', email: 'alice@example.org' },
    { userId: 'u2', name: null, email: null },
  ];

  it('is the current members of the organization by name, and nothing else about them: no e-mail address, no role', async () => {
    txDouble.queue(rows);

    const candidates = await listRecognitionCandidates(ORG);

    expect(candidates).toEqual([
      { userId: 'u1', name: 'Alice Member' },
      { userId: 'u2', name: 'Unknown' },
    ]);
    expect(JSON.stringify(candidates)).not.toContain('@');
    expectOrganizationScoped(1);
    expect(txDouble.statements[0].where?.sql).toMatch(
      /"organization_members"\."organization_id" = \$1 and "organization_members"\."status" = \$2 and "organization_members"\."deleted_at" is null/,
    );
    expect(txDouble.statements[0].where?.params).toEqual([ORG, 'active']);
  });

  it('adds the e-mail address only when the caller asks for it, which only an administrator page does', async () => {
    txDouble.queue(rows);

    expect(await listRecognitionCandidates(ORG, { includeEmail: true })).toEqual([
      { userId: 'u1', name: 'Alice Member', email: 'alice@example.org' },
      { userId: 'u2', name: 'Unknown', email: '' },
    ]);
  });

  it('rejects when the database fails, rather than offering nobody to pick', async () => {
    txDouble.queue(new Error('connection lost'));

    await expect(listRecognitionCandidates(ORG)).rejects.toThrow('connection lost');
  });
});

describe('loadMemberNames', () => {
  it('names the members of the organization by user id, leaving out anybody without a name', async () => {
    txDouble.queue([
      { userId: 'u1', name: 'Alice Member' },
      { userId: 'u2', name: '' },
    ]);

    expect(await loadMemberNames(ORG, ['u1', 'u2', 'u3'])).toEqual({ u1: 'Alice Member' });

    expectOrganizationScoped(1);
    expect(txDouble.statements[0].where?.params).toEqual([ORG, 'u1', 'u2', 'u3']);
  });

  it('opens no transaction at all when there is nobody to name', async () => {
    expect(await loadMemberNames(ORG, [])).toEqual({});

    expect(txDouble.contexts).toEqual([]);
    expect(txDouble.statements).toEqual([]);
  });
});

describe('loadActiveProgram', () => {
  it('is the newest active program of the organization', async () => {
    txDouble.queue([{ id: 'program-1', name: 'Recognition' }]);

    expect(await loadActiveProgram(ORG)).toEqual({ id: 'program-1', name: 'Recognition' });

    expectOrganizationScoped(1);
    expect(txDouble.statements[0].where?.sql).toMatch(/"recognition_programs"\."org_id" = \$1 and "recognition_programs"\."status" = \$2/);
    expect(txDouble.statements[0].where?.params).toEqual([ORG, 'active']);
  });

  it('is null for an organization with no active program, and rejects when the database fails', async () => {
    txDouble.queue([]);
    expect(await loadActiveProgram(ORG)).toBeNull();

    txDouble.reset();
    txDouble.queue(new Error('connection lost'));
    await expect(loadActiveProgram(ORG)).rejects.toThrow('connection lost');
  });
});
