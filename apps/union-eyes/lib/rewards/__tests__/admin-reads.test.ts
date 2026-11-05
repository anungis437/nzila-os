import { beforeEach, describe, expect, it, vi } from 'vitest';
import { txDouble } from '@/lib/page-data/__tests__/tx-double';

vi.mock('@/lib/db/with-rls-context', async () => (await import('@/lib/page-data/__tests__/tx-double')).txDoubleModule());

import { MEMBER_WALLETS_PER_PAGE, loadMemberWallets, loadRewardsReport, parsePageNumber } from '../admin-reads';

const ORG = '4f0d6b5e-8a52-4c5e-9d0e-2f3b8d9a1c11';

beforeEach(() => txDouble.reset());

describe('parsePageNumber', () => {
  it.each([
    ['3', 3],
    ['1', 1],
    ['0', 1],
    ['-4', 1],
    ['abc', 1],
    ['', 1],
    [undefined, 1],
  ])('reads %j as page %i', (value, expected) => expect(parsePageNumber(value)).toBe(expected));
});

describe('loadRewardsReport', () => {
  it('reads the totals, the recent awards and the top recipients of the organization, in its context and as no other role', async () => {
    txDouble.queue([{ total_awards: 4 }], [{ id: 'a1' }], [{ name: 'Alice', total_points: 90 }]);

    const report = await loadRewardsReport(ORG);

    expect(report).toEqual({ stats: { total_awards: 4 }, recent: [{ id: 'a1' }], top: [{ name: 'Alice', total_points: 90 }] });
    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(txDouble.systemContexts).toBe(0);
    expect(txDouble.statements).toHaveLength(3);
    for (const statement of txDouble.statements) {
      expect(statement.context).toBe(ORG);
      expect(statement.where?.params).toContain(ORG);
    }
    // The recognition tables key an organization as org_id: every table the report reads is filtered by it.
    expect(txDouble.statements[0].where?.sql).toMatch(/FROM recognition_programs WHERE org_id = \$1::uuid/);
    expect(txDouble.statements[1].where?.sql).toMatch(/WHERE ra\.org_id = \$1::uuid/);
    expect(txDouble.statements[2].where?.sql).toMatch(/WHERE ra\.org_id = \$1::uuid\s+AND ra\.status = 'issued'/);
  });

  it('has empty totals for an organization with nothing recorded', async () => {
    txDouble.queue([], [], []);

    expect(await loadRewardsReport(ORG)).toEqual({ stats: {}, recent: [], top: [] });
  });

  it('rejects, rather than reporting zeros, when a table cannot be read', async () => {
    txDouble.queue([{ total_awards: 1 }], new Error('permission denied for table reward_wallet_ledger'));

    await expect(loadRewardsReport(ORG)).rejects.toThrow(/permission denied/);
  });
});

describe('loadMemberWallets', () => {
  it('counts and reads the first page of the current members of the organization with their wallet, and sums up the whole organization', async () => {
    txDouble.queue([{ total: '30' }], [{ id: 'm1', name: 'Alice', balance: 70 }], [{ members: '40', with_balance: '12', outstanding: '3500' }]);

    const page = await loadMemberWallets(ORG);

    expect(page).toEqual({
      total: 30,
      rows: [{ id: 'm1', name: 'Alice', balance: 70 }],
      summary: { members: 40, withBalance: 12, outstanding: 3500 },
    });
    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(txDouble.statements).toHaveLength(3);
    expect(txDouble.statements[0].where?.sql).toMatch(/WHERE om\.organization_id = \$1::uuid\s+AND om\.deleted_at IS NULL/);
    expect(txDouble.statements[1].where?.params).toEqual([ORG, MEMBER_WALLETS_PER_PAGE, 0]);
    expect(txDouble.statements[1].where?.sql).toMatch(/LIMIT \$2 OFFSET \$3/);
    expect(txDouble.statements[2].where?.params).toEqual([ORG]);
  });

  it('offsets by the page, and filters the count and the rows by the search over name and e-mail, but not the organization summary', async () => {
    txDouble.queue([{ total: 3 }], [], [{ members: 40, with_balance: 12, outstanding: 3500 }]);

    await loadMemberWallets(ORG, { search: '  ali  ', page: 3, perPage: 10 });

    for (const statement of txDouble.statements.slice(0, 2)) {
      expect(statement.where?.sql).toMatch(/om\.name ILIKE \$\d+ OR om\.email ILIKE \$\d+/);
      expect(statement.where?.params).toContain('%ali%');
    }
    expect(txDouble.statements[1].where?.params.slice(-2)).toEqual([10, 20]);
    expect(txDouble.statements[2].where?.sql).not.toMatch(/ILIKE/);
    expect(txDouble.statements[2].where?.params).toEqual([ORG]);
  });

  it('adds no search condition when the search is blank', async () => {
    txDouble.queue([{ total: 0 }], [], []);

    await loadMemberWallets(ORG, { search: '   ' });

    expect(txDouble.statements[0].where?.sql).not.toMatch(/ILIKE/);
  });

  it('is an empty page when the organization has no member, and rejects when the database fails', async () => {
    txDouble.queue([], [], []);
    expect(await loadMemberWallets(ORG)).toEqual({ total: 0, rows: [], summary: { members: 0, withBalance: 0, outstanding: 0 } });

    txDouble.reset();
    txDouble.queue(new Error('connection lost'));
    await expect(loadMemberWallets(ORG)).rejects.toThrow('connection lost');
  });

  it('rejects, rather than summing up an organization it could not read, when the summary fails', async () => {
    txDouble.queue([{ total: 1 }], [], new Error('permission denied for table reward_wallet_ledger'));

    await expect(loadMemberWallets(ORG)).rejects.toThrow(/permission denied/);
  });
});
