/**
 * HRIS Sync Utilities — Unit Tests
 *
 * hris/sync-utils combines pure validation helpers with DB-backed mapping,
 * conflict-detection, and statistics functions. It uses the drizzle builder
 * API (db.select().from().where()), raw db.execute(sql`...`) for the
 * organization_members table, and db.query.externalEmployees.findFirst.
 * A single ordered queue feeds every DB access in call order.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const q: unknown[] = [];
  const shift = () => (q.length ? q.shift() : []);
  const makeChain = () => {
    const c: Record<string, unknown> = {};
    for (const m of [
      'select', 'from', 'where', 'orderBy', 'limit', 'set', 'values', 'returning',
      'onConflictDoUpdate', 'update', 'insert', 'delete', 'innerJoin', 'leftJoin', 'offset', 'groupBy',
    ]) {
      c[m] = () => c;
    }
    (c as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = shift();
      if (v instanceof Error) return Promise.reject(v).then(res, rej);
      return Promise.resolve(v).then(res, rej);
    };
    return c;
  };
  const asyncShift = async () => {
    const v = shift();
    if (v instanceof Error) throw v;
    return v;
  };
  const tableProxy = new Proxy(
    {},
    { get: () => ({ findMany: asyncShift, findFirst: asyncShift }) },
  );
  const db = {
    select: makeChain,
    insert: makeChain,
    update: makeChain,
    delete: makeChain,
    execute: asyncShift,
    query: tableProxy,
  };
  return { q, db };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as u from '../adapters/hris/sync-utils';

const push = (...rows: unknown[]) => h.q.push(...rows);
beforeEach(() => {
  h.q.length = 0;
  vi.clearAllMocks();
});

describe('hris sync-utils — findEmployeeMappings', () => {
  it('matches by email (high confidence)', async () => {
    push([{ externalId: 'e1', email: 'a@x.com', firstName: 'A', lastName: 'B', isActive: true }]);
    push([{ id: 'm1', email: 'A@X.COM', first_name: 'a', last_name: 'b' }]);
    const m = await u.findEmployeeMappings('org1', 'WORKDAY');
    expect(m[0].internalMemberId).toBe('m1');
    expect(m[0].matchConfidence).toBe('high');
  });
  it('matches by full name (medium confidence) when email differs', async () => {
    push([{ externalId: 'e2', email: 'no@x.com', firstName: 'John', lastName: 'Doe' }]);
    push([{ id: 'm2', email: 'other@x.com', first_name: 'john', last_name: 'doe' }]);
    const m = await u.findEmployeeMappings('org1', 'BAMBOOHR');
    expect(m[0].internalMemberId).toBe('m2');
    expect(m[0].matchConfidence).toBe('medium');
  });
  it('returns low confidence when no match', async () => {
    push([{ externalId: 'e3', firstName: 'X', lastName: 'Y' }]);
    push([]);
    const m = await u.findEmployeeMappings('org1', 'ADP');
    expect(m[0].internalMemberId).toBeUndefined();
    expect(m[0].matchConfidence).toBe('low');
  });
  it('rethrows on db error', async () => {
    push(new Error('db down'));
    await expect(u.findEmployeeMappings('org1', 'WORKDAY')).rejects.toThrow('db down');
  });
});

describe('hris sync-utils — detectSyncConflicts', () => {
  it('flags differing fields for mapped employees', async () => {
    // findEmployeeMappings (email match -> mapped)
    push([{ externalId: 'e1', email: 'a@x.com', firstName: 'A', lastName: 'B' }]);
    push([{ id: 'm1', email: 'a@x.com', first_name: 'a', last_name: 'b' }]);
    // findFirst external + db.execute internal
    push({ externalId: 'e1', email: 'ext@x.com', phone: '111', position: 'Dev', department: 'Eng' });
    push([{ email: 'int@x.com', phone: '111', position: 'Mgr', department: 'Eng' }]);
    const conflicts = await u.detectSyncConflicts('org1', 'WORKDAY');
    expect(conflicts.map((c) => c.field).sort()).toEqual(['email', 'position']);
    expect(conflicts[0].suggestedResolution).toBe('keep_external');
  });
  it('skips unmapped and missing-external/internal records', async () => {
    // unmapped mapping
    push([{ externalId: 'e9', firstName: 'No', lastName: 'Match' }]);
    push([]);
    const conflicts = await u.detectSyncConflicts('org1', 'ADP');
    expect(conflicts).toEqual([]);
  });
});

describe('hris sync-utils — getSyncStats', () => {
  it('computes mapped/unmapped with provider', async () => {
    push([{}, {}]); // employees (getSyncStats)
    push([{ externalId: 'e1', email: 'a@x.com' }]); // findEmployeeMappings employees
    push([{ id: 'm1', email: 'a@x.com' }]); // findEmployeeMappings members
    push([{ lastSyncedAt: new Date('2024-06-01') }]); // lastSync
    const s = await u.getSyncStats('org1', 'WORKDAY');
    expect(s.totalEmployees).toBe(2);
    expect(s.mapped).toBe(1);
    expect(s.unmapped).toBe(1);
    expect(s.lastSyncDate).toBeInstanceOf(Date);
  });
  it('skips mapping work without provider', async () => {
    push([{}, {}, {}]); // employees
    push([]); // lastSync empty
    const s = await u.getSyncStats('org1');
    expect(s.totalEmployees).toBe(3);
    expect(s.mapped).toBe(0);
    expect(s.lastSyncDate).toBeUndefined();
  });
});

describe('hris sync-utils — validation', () => {
  it('reports errors + warnings for incomplete data', () => {
    const r = u.validateEmployeeData({});
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Missing first name');
    expect(r.errors).toContain('Missing last name');
    expect(r.warnings).toContain('Missing email address');
    expect(r.warnings).toContain('Missing employee ID');
  });
  it('flags invalid email format', () => {
    const r = u.validateEmployeeData({ firstName: 'A', lastName: 'B', email: 'nope', employeeId: '1' });
    expect(r.errors).toContain('Invalid email format');
  });
  it('passes for valid data', () => {
    const r = u.validateEmployeeData({ firstName: 'A', lastName: 'B', email: 'a@x.com', employeeId: '1' });
    expect(r.isValid).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });
});

describe('hris sync-utils — bulk operations', () => {
  it('bulkMapEmployees reports all as failed (no junction table)', async () => {
    expect(
      await u.bulkMapEmployees([
        { externalEmployeeId: 'e1', internalMemberId: 'm1' },
        { externalEmployeeId: 'e2', internalMemberId: 'm2' },
      ]),
    ).toEqual({ success: 0, failed: 2 });
    expect(await u.bulkMapEmployees([])).toEqual({ success: 0, failed: 0 });
  });
  it('deactivateRemovedEmployees returns affected count and rethrows on error', async () => {
    push([1, 2, 3, 4]);
    expect(await u.deactivateRemovedEmployees('org1', 'WORKDAY', ['k1'])).toBe(4);
    push(new Error('boom'));
    await expect(u.deactivateRemovedEmployees('org1', 'WORKDAY', ['k1'])).rejects.toThrow('boom');
  });
});
