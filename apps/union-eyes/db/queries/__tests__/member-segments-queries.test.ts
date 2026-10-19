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
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  queue: [] as unknown[],
  rls: [] as unknown[],
  wheres: [] as unknown[],
  values: [] as unknown[],
  outcomes: [] as Array<'commit' | 'rollback'>,
}));

function shift() {
  return mocks.queue.length ? mocks.queue.shift() : [];
}
function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'values', 'set', 'returning']) {
    chain[m] = (...args: unknown[]) => {
      if (m === 'where') mocks.wheres.push(args[0]);
      if (m === 'values') mocks.values.push(args[0]);
      return chain;
    };
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
  withRLSContext: async (ctxOrOp: unknown, maybeOp?: unknown) => {
    const operation = typeof ctxOrOp === 'function' ? ctxOrOp : maybeOp;
    mocks.rls.push(typeof ctxOrOp === 'function' ? { organizationId: null } : ctxOrOp);
    try {
      const result = await (operation as (tx: unknown) => Promise<unknown>)(makeTx());
      mocks.outcomes.push('commit');
      return result;
    } catch (error) {
      mocks.outcomes.push('rollback');
      throw error;
    }
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../member-segments-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const STEWARD_A = 'user-steward-a';
const STEWARD_B = 'user-steward-b';

const ownAndPublic = { actorUserId: STEWARD_A, includeOthersPrivate: false };
const managePrivate = { actorUserId: STEWARD_A, includeOthersPrivate: true };

function sqlLeaves(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (typeof value !== 'object') return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const record = value as { name?: unknown; value?: unknown; queryChunks?: unknown };
  const leaves: string[] = [];
  if (typeof record.name === 'string') leaves.push(record.name);
  if (typeof record.value === 'string' || typeof record.value === 'number' || typeof record.value === 'boolean') {
    leaves.push(String(record.value));
  }
  if (Array.isArray(record.value)) {
    for (const item of record.value) leaves.push(...sqlLeaves(item, seen));
  }
  if (Array.isArray(record.queryChunks)) {
    for (const chunk of record.queryChunks) leaves.push(...sqlLeaves(chunk, seen));
  }
  return leaves;
}

beforeEach(() => {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0');
  mocks.queue = [];
  mocks.rls = [];
  mocks.wheres = [];
  mocks.values = [];
  mocks.outcomes = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('member-segments-queries — CRUD', () => {
  it('createSegment returns the created segment', async () => {
    push([{ id: 's1', name: 'Seg' }]);
    expect(await q.createSegment({ name: 'Seg', organizationId: 'org1' } as never)).toEqual({ id: 's1', name: 'Seg' });
    expect(mocks.rls.at(-1)).toEqual({ organizationId: 'org1' });
  });
  it('createSegment throws on error', async () => {
    push(new Error('db'));
    await expect(q.createSegment({ name: 'X', organizationId: 'org1' } as never)).rejects.toThrow('Failed to create segment');
  });
  it('createSegment refuses to open an unscoped RLS context', async () => {
    await expect(q.createSegment({ name: 'X' } as never)).rejects.toThrow('Organization context required');
    expect(mocks.rls).toEqual([]);
  });

  it('getSegments always limits an ordinary steward to public and own segments', async () => {
    push([{ id: 's1' }]);
    expect(await q.getSegments(ORG_A, ownAndPublic)).toHaveLength(1);
    expect(mocks.rls.at(-1)).toEqual({ organizationId: ORG_A });
    const leaves = sqlLeaves(mocks.wheres.at(-1));
    expect(leaves).toEqual(expect.arrayContaining(['is_public', 'created_by', STEWARD_A, ORG_A]));
    expect(leaves).not.toContain(STEWARD_B);
  });
  it('getSegments omits the owner filter only when other private segments were authorized', async () => {
    push([{ id: 's1' }, { id: 's2' }]);
    expect(await q.getSegments(ORG_A, managePrivate)).toHaveLength(2);
    const leaves = sqlLeaves(mocks.wheres.at(-1));
    expect(leaves).toContain(ORG_A);
    expect(leaves).not.toContain('created_by');
    expect(leaves).not.toContain(STEWARD_B);
  });
  it('getSegments binds the other organization and the other actor separately', async () => {
    push([]);
    await q.getSegments(ORG_B, { actorUserId: STEWARD_B, includeOthersPrivate: false });
    expect(mocks.rls.at(-1)).toEqual({ organizationId: ORG_B });
    const leaves = sqlLeaves(mocks.wheres.at(-1));
    expect(leaves).toEqual(expect.arrayContaining([ORG_B, STEWARD_B, 'created_by', 'is_public']));
    expect(leaves).not.toContain(ORG_A);
    expect(leaves).not.toContain(STEWARD_A);
  });
  it('getSegments refuses a missing actor before opening a database context', async () => {
    await expect(
      q.getSegments(ORG_A, { actorUserId: '  ', includeOthersPrivate: false }),
    ).rejects.toThrow('Actor required');
    expect(mocks.rls).toEqual([]);
  });
  it('getSegments throws on error', async () => {
    push(new Error('db'));
    await expect(q.getSegments('org1', ownAndPublic)).rejects.toThrow('Failed to get segments');
  });

  it('getSegmentById returns segment or null', async () => {
    push([{ id: 's1' }]);
    expect(await q.getSegmentById('s1', 'org1', ownAndPublic)).toEqual({ id: 's1' });
    const leaves = sqlLeaves(mocks.wheres.at(-1));
    expect(leaves).toEqual(expect.arrayContaining(['created_by', STEWARD_A, 'is_public']));
    push([]);
    expect(await q.getSegmentById('missing', 'org1', ownAndPublic)).toBeNull();
  });
  it('getSegmentById throws on error', async () => {
    push(new Error('db'));
    await expect(q.getSegmentById('s1', 'org1', ownAndPublic)).rejects.toThrow('Failed to get segment');
  });

  it('updateSegment returns the updated segment inside the authorized organization', async () => {
    push([{ id: 's1', name: 'New', createdBy: STEWARD_A, isPublic: true }]);
    expect(await q.updateSegment('s1', { name: 'New', organizationId: 'org-b' } as never, 'org1', ownAndPublic)).toEqual({
      id: 's1',
      name: 'New',
      createdBy: STEWARD_A,
      isPublic: true,
    });
    expect(mocks.rls.at(-1)).toEqual({ organizationId: 'org1' });
    expect(mocks.outcomes).toEqual(['commit']);
    expect(mocks.values).toEqual([]);
    const leaves = sqlLeaves(mocks.wheres.at(-1));
    expect(leaves).toEqual(expect.arrayContaining(['created_by', STEWARD_A]));
    expect(leaves).not.toContain('is_public');
  });
  it('updateSegment throws when not found in the authorized organization', async () => {
    push([]);
    await expect(q.updateSegment('missing', { name: 'X' } as never, 'org1', ownAndPublic)).rejects.toThrow(
      'Segment not found',
    );
    expect(mocks.values).toEqual([]);
    expect(mocks.outcomes).toEqual(['rollback']);
  });
  it('updateSegment lets an authorized manager match another member private segment', async () => {
    push([{ id: 's-private', createdBy: STEWARD_B, isPublic: false }], []);
    await q.updateSegment('s-private', { name: 'Managed' } as never, ORG_A, managePrivate);
    const leaves = sqlLeaves(mocks.wheres.at(-1));
    expect(leaves).toContain(ORG_A);
    expect(leaves).not.toContain('created_by');
    expect(mocks.outcomes).toEqual(['commit']);
  });

  it('deleteSegment soft-deletes inside the authorized organization', async () => {
    push([{ id: 's1', createdBy: STEWARD_A, isPublic: false }]);
    await expect(q.deleteSegment('s1', 'org1', ownAndPublic)).resolves.toBeUndefined();
    expect(mocks.values).toEqual([]);
    expect(mocks.rls.at(-1)).toEqual({ organizationId: 'org1' });
    const leaves = sqlLeaves(mocks.wheres.at(-1));
    expect(leaves).toEqual(expect.arrayContaining(['created_by', STEWARD_A]));
    expect(leaves).not.toContain('is_public');
  });
  it('deleteSegment does not report success when the segment is outside the organization', async () => {
    push([]);
    await expect(q.deleteSegment('foreign-segment', 'org1', ownAndPublic)).rejects.toThrow('Segment not found');
    expect(mocks.values).toEqual([]);
    expect(mocks.outcomes).toEqual(['rollback']);
  });
  it('deleteSegment throws on error', async () => {
    push(new Error('db'));
    await expect(q.deleteSegment('s1', 'org1', ownAndPublic)).rejects.toThrow('Failed to delete segment');
    expect(mocks.values).toEqual([]);
    expect(mocks.outcomes).toEqual(['rollback']);
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
    expect(mocks.rls.at(-1)).toEqual({ organizationId: 'org1' });
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
  it('executeSegment omits another member private filters from the execution audit', async () => {
    push(
      [{ id: 's-private', filters: { status: ['active'] }, isPublic: false, createdBy: STEWARD_B }],
      [],
      [{ id: 'm1' }],
      [{ count: 1 }],
      [{ id: 'exec1' }],
      [],
      [],
    );
    await q.executeSegment('s-private', ORG_A, STEWARD_A, { includeOthersPrivate: true });
    const logged = mocks.values.find(
      (row) => row !== null && typeof row === 'object' && 'resultCount' in (row as object),
    ) as { filtersSnapshot?: unknown; resultCount?: number };
    expect(logged.filtersSnapshot).toBeUndefined();
    expect(logged.resultCount).toBe(1);
    const executeAudit = mocks.values.find(
      (row) => row !== null && typeof row === 'object' && (row as { action?: string }).action === 'member_segment_execute',
    ) as { outcome?: string; metadata?: { segments?: unknown } };
    expect(executeAudit.outcome).toBe('success');
    expect(executeAudit.metadata?.segments).toEqual([
      { segmentId: 's-private', ownerUserId: STEWARD_B, isPublic: false },
    ]);
    expect(JSON.stringify(executeAudit)).not.toContain('active');
    expect(mocks.outcomes).toEqual(['commit', 'commit', 'commit', 'commit']);
  });
  it('executeSegment throws when segment not found', async () => {
    push([]);
    await expect(q.executeSegment('missing', 'org1', 'u1')).rejects.toThrow(
      'Segment not found',
    );
  });
  it('executeSegment keeps another steward private segment out of the lookup', async () => {
    push([]);
    await expect(
      q.executeSegment('s-private', ORG_B, STEWARD_A, { includeOthersPrivate: false }),
    ).rejects.toThrow('Segment not found');
    expect(mocks.rls.at(-1)).toEqual({ organizationId: ORG_B });
    expect(sqlLeaves(mocks.wheres.at(-1))).toEqual(
      expect.arrayContaining([ORG_B, STEWARD_A, 'created_by', 'is_public']),
    );
  });
});

describe('member-segments-queries — executions & exports', () => {
  it('logSegmentExecution returns the row', async () => {
    push([{ id: 'exec1' }]);
    expect(await q.logSegmentExecution({ segmentId: 's1' } as never, 'org1')).toEqual({ id: 'exec1' });
    expect(mocks.rls.at(-1)).toEqual({ organizationId: 'org1' });
  });
  it('logSegmentExecution throws on error', async () => {
    push(new Error('db'));
    await expect(q.logSegmentExecution({ segmentId: 's1' } as never, 'org1')).rejects.toThrow(
      'Failed to log segment execution',
    );
  });

  it('getSegmentExecutions returns history for the authorized organization', async () => {
    push([{ id: 'exec1' }]);
    expect(await q.getSegmentExecutions('s1', 'org1')).toHaveLength(1);
    expect(mocks.rls.at(-1)).toEqual({ organizationId: 'org1' });
  });
  it('getSegmentExecutions throws on error', async () => {
    push(new Error('db'));
    await expect(q.getSegmentExecutions('s1', 'org1')).rejects.toThrow('Failed to get segment executions');
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
    expect(mocks.rls.at(-1)).toEqual({ organizationId: 'org1' });
  });
  it('getExportHistory throws on error', async () => {
    push(new Error('db'));
    await expect(q.getExportHistory('org1')).rejects.toThrow('Failed to get export history');
  });
});

describe('member-segments-queries — durable sensitive audit', () => {
  const privateOther = {
    id: 's-private',
    createdBy: STEWARD_B,
    isPublic: false,
    name: 'Managed',
    filters: {},
  };

  it('commits an administrator update only with a success audit written after the row returns', async () => {
    push([privateOther], []);
    const updated = await q.updateSegment('s-private', { name: 'Managed', filters: { status: ['active'] } } as never, ORG_A, managePrivate);
    expect(updated).toMatchObject({ id: 's-private', createdBy: STEWARD_B });
    expect(mocks.outcomes).toEqual(['commit']);
    expect(mocks.values).toHaveLength(1);
    const audit = mocks.values[0] as {
      action: string;
      outcome: string;
      resourceId: string | null;
      metadata: { segments: unknown; outcome: string };
    };
    expect(audit.action).toBe('member_segment_update');
    expect(audit.outcome).toBe('success');
    expect(audit.metadata.outcome).toBe('success');
    expect(audit.resourceId).toBeNull();
    expect(audit.metadata.segments).toEqual([
      { segmentId: 's-private', ownerUserId: STEWARD_B, isPublic: false },
    ]);
    expect(JSON.stringify(audit)).not.toContain('active');
    expect(JSON.stringify(audit)).not.toContain('filters');
  });

  it('rolls back an administrator update when the legacy audit insert fails', async () => {
    push([privateOther], new Error('legacy_audit_down'));
    await expect(
      q.updateSegment('s-private', { name: 'Managed' } as never, ORG_A, managePrivate),
    ).rejects.toThrow('Failed to update segment');
    expect(mocks.outcomes).toEqual(['rollback']);
    expect(mocks.values).toHaveLength(1);
    expect((mocks.values[0] as { outcome?: string }).outcome).toBe('success');
  });

  it('rolls back an administrator delete when the legacy audit insert fails', async () => {
    push([privateOther], new Error('legacy_audit_down'));
    await expect(q.deleteSegment('s-private', ORG_A, managePrivate)).rejects.toThrow('Failed to delete segment');
    expect(mocks.outcomes).toEqual(['rollback']);
    expect((mocks.values[0] as { action?: string }).action).toBe('member_segment_delete');
  });

  it('writes no success audit when the segment is missing or the update SQL fails', async () => {
    push([]);
    await expect(q.updateSegment('missing', { name: 'X' } as never, ORG_A, managePrivate)).rejects.toThrow(
      'Segment not found',
    );
    push(new Error('db'));
    await expect(q.updateSegment('s-private', { name: 'X' } as never, ORG_A, managePrivate)).rejects.toThrow(
      'Failed to update segment',
    );
    expect(mocks.values).toEqual([]);
    expect(mocks.outcomes).toEqual(['rollback', 'rollback']);
  });

  it('does not return a private segment when its read audit fails', async () => {
    push([privateOther], new Error('legacy_audit_down'));
    await expect(q.getSegmentById('s-private', ORG_A, managePrivate)).rejects.toThrow('Failed to get segment');
    expect(mocks.outcomes).toEqual(['rollback']);
    expect((mocks.values[0] as { action?: string }).action).toBe('member_segment_read');
  });

  it('rolls the execution log back when the execute audit insert fails', async () => {
    push(
      [privateOther],
      [],
      [{ id: 'm1' }],
      [{ count: 1 }],
      [{ id: 'exec1' }],
      new Error('legacy_audit_down'),
    );
    await expect(
      q.executeSegment('s-private', ORG_A, STEWARD_A, { includeOthersPrivate: true }),
    ).rejects.toThrow('Failed to execute segment');
    expect(mocks.outcomes).toEqual(['commit', 'commit', 'rollback', 'rollback']);
    expect(mocks.values.some((row) => (row as { action?: string }).action === 'member_segment_execute')).toBe(true);
  });

  it('rolls the export row back when the export audit insert fails', async () => {
    push([{ id: 'exp1' }], new Error('legacy_audit_down'));
    await expect(
      q.logSegmentExport({ organizationId: ORG_A, filtersUsed: { status: ['active'] } } as never, {
        actorUserId: STEWARD_A,
        segments: [{ segmentId: 's-private', ownerUserId: STEWARD_B, isPublic: false }],
      }),
    ).rejects.toThrow('Failed to log segment export');
    expect(mocks.outcomes).toEqual(['rollback']);
    const audit = mocks.values.find((row) => (row as { action?: string }).action === 'member_segment_export') as {
      outcome: string;
    };
    expect(audit.outcome).toBe('success');
    expect(JSON.stringify(audit)).not.toContain('active');
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
