/**
 * Member Segments Queries — Unit Tests
 *
 * withRLSContext + drizzle-builder queue mock. Chain supports the builder
 * methods used here (select/from/where/orderBy/limit/offset/leftJoin/values/
 * set/returning). Several functions call sibling query functions (executeSegment
 * -> getSegmentById + searchMembersAdvanced + logSegmentExecution + update) so
 * pushes are ordered to match the sequential await order. Pure helpers
 * (generateExportWatermark/generateExportHash) need no DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function shift() {
  return mocks.queue.length ? mocks.queue.shift() : [];
}
function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'values', 'set', 'returning']) {
    chain[m] = () => chain;
  }
  (chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => {
    const v = shift();
    if (v instanceof Error) return Promise.reject(v).then(resolve, reject);
    return Promise.resolve(v).then(resolve, reject);
  };
  return chain;
}
function makeTx() {
  return {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../member-segments-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

beforeEach(() => {
  mocks.queue = [];
  vi.clearAllMocks();
});

describe('member-segments-queries — CRUD', () => {
  it('createSegment returns the created segment', async () => {
    push([{ id: 's1', name: 'Seg' }]);
    expect(await q.createSegment({ name: 'Seg' } as never)).toEqual({ id: 's1', name: 'Seg' });
  });
  it('createSegment throws on error', async () => {
    push(new Error('db'));
    await expect(q.createSegment({ name: 'X' } as never)).rejects.toThrow('Failed to create segment');
  });

  it('getSegments without userId', async () => {
    push([{ id: 's1' }]);
    expect(await q.getSegments('org1')).toHaveLength(1);
  });
  it('getSegments with userId (adds public/owner filter)', async () => {
    push([{ id: 's1' }, { id: 's2' }]);
    expect(await q.getSegments('org1', 'u1')).toHaveLength(2);
  });
  it('getSegments throws on error', async () => {
    push(new Error('db'));
    await expect(q.getSegments('org1')).rejects.toThrow('Failed to get segments');
  });

  it('getSegmentById returns segment or null', async () => {
    push([{ id: 's1' }]);
    expect(await q.getSegmentById('s1', 'org1')).toEqual({ id: 's1' });
    push([]);
    expect(await q.getSegmentById('missing', 'org1')).toBeNull();
  });
  it('getSegmentById throws on error', async () => {
    push(new Error('db'));
    await expect(q.getSegmentById('s1', 'org1')).rejects.toThrow('Failed to get segment');
  });

  it('updateSegment returns the updated segment', async () => {
    push([{ id: 's1', name: 'New' }]);
    expect(await q.updateSegment('s1', { name: 'New' } as never)).toEqual({ id: 's1', name: 'New' });
  });
  it('updateSegment throws when not found', async () => {
    push([]);
    await expect(q.updateSegment('missing', { name: 'X' } as never)).rejects.toThrow(
      'Failed to update segment',
    );
  });

  it('deleteSegment soft-deletes without throwing', async () => {
    push([]);
    await expect(q.deleteSegment('s1')).resolves.toBeUndefined();
  });
  it('deleteSegment throws on error', async () => {
    push(new Error('db'));
    await expect(q.deleteSegment('s1')).rejects.toThrow('Failed to delete segment');
  });
});

describe('member-segments-queries — advanced search', () => {
  const fullFilters = {
    status: ['active'],
    role: ['member'],
    membershipType: ['full'],
    joinDateFrom: '2020-01-01',
    joinDateTo: '2024-01-01',
    employerId: ['e1'],
    worksiteId: ['w1'],
    bargainingUnitId: ['b1'],
    employmentStatus: ['active'],
    checkoffAuthorized: true,
    seniorityYearsMin: 1,
    seniorityYearsMax: 30,
    seniorityDateFrom: '2010-01-01',
    seniorityDateTo: '2020-01-01',
  };

  it('searchMembersAdvanced with full filters and pagination', async () => {
    push([{ id: 'm1' }], [{ count: 1 }]);
    const r = await q.searchMembersAdvanced('org1', fullFilters as never, {
      page: 2,
      limit: 10,
      sortBy: 'joinDate',
      sortOrder: 'desc',
    });
    expect(r.members).toHaveLength(1);
    expect(r.total).toBe(1);
  });
  it('searchMembersAdvanced with seniority sort', async () => {
    push([{ id: 'm1' }], [{ count: 5 }]);
    const r = await q.searchMembersAdvanced('org1', {} as never, { sortBy: 'seniority' });
    expect(r.total).toBe(5);
  });
  it('searchMembersAdvanced with defaults (no filters/options)', async () => {
    push([], [{ count: 0 }]);
    const r = await q.searchMembersAdvanced('org1', {} as never);
    expect(r.total).toBe(0);
  });
  it('searchMembersAdvanced throws on error', async () => {
    push(new Error('db'));
    await expect(q.searchMembersAdvanced('org1', {} as never)).rejects.toThrow(
      'Failed to search members',
    );
  });

  it('executeSegment runs the saved segment and logs', async () => {
    // getSegmentById, then searchMembersAdvanced (members + count),
    // then logSegmentExecution, then update memberSegments.
    push(
      [{ id: 's1', filters: {} }],
      [{ id: 'm1' }],
      [{ count: 1 }],
      [{ id: 'exec1' }],
      [],
    );
    const r = await q.executeSegment('s1', 'org1', 'u1', { page: 1, limit: 10 });
    expect(r.total).toBe(1);
  });
  it('executeSegment throws when segment not found', async () => {
    push([]);
    await expect(q.executeSegment('missing', 'org1', 'u1')).rejects.toThrow(
      'Failed to execute segment',
    );
  });
});

describe('member-segments-queries — executions & exports', () => {
  it('logSegmentExecution returns the row', async () => {
    push([{ id: 'exec1' }]);
    expect(await q.logSegmentExecution({ segmentId: 's1' } as never)).toEqual({ id: 'exec1' });
  });
  it('logSegmentExecution throws on error', async () => {
    push(new Error('db'));
    await expect(q.logSegmentExecution({ segmentId: 's1' } as never)).rejects.toThrow(
      'Failed to log segment execution',
    );
  });

  it('getSegmentExecutions returns history', async () => {
    push([{ id: 'exec1' }]);
    expect(await q.getSegmentExecutions('s1')).toHaveLength(1);
  });
  it('getSegmentExecutions throws on error', async () => {
    push(new Error('db'));
    await expect(q.getSegmentExecutions('s1')).rejects.toThrow('Failed to get segment executions');
  });

  it('logSegmentExport returns the row', async () => {
    push([{ id: 'exp1' }]);
    expect(await q.logSegmentExport({ organizationId: 'org1' } as never)).toEqual({ id: 'exp1' });
  });
  it('logSegmentExport throws on error', async () => {
    push(new Error('db'));
    await expect(q.logSegmentExport({ organizationId: 'org1' } as never)).rejects.toThrow(
      'Failed to log segment export',
    );
  });

  it('getExportHistory returns history', async () => {
    push([{ id: 'exp1' }]);
    expect(await q.getExportHistory('org1')).toHaveLength(1);
  });
  it('getExportHistory throws on error', async () => {
    push(new Error('db'));
    await expect(q.getExportHistory('org1')).rejects.toThrow('Failed to get export history');
  });
});

describe('member-segments-queries — pure helpers', () => {
  it('generateExportWatermark embeds identifiers', () => {
    const wm = q.generateExportWatermark('u1', 'Alice', 'CUPE');
    expect(wm).toContain('Alice');
    expect(wm).toContain('u1');
    expect(wm).toContain('CUPE');
    expect(wm).toContain('Confidential');
  });
  it('generateExportHash returns a sha256 hex digest', () => {
    const h = q.generateExportHash('payload');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
