import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  execQueue: [] as unknown[],
  selectQueue: [] as unknown[],
}));

vi.mock('@/db/db', () => ({
  db: {
    execute: vi.fn(() => {
      const v = h.execQueue.shift();
      if (v instanceof Error) return Promise.reject(v);
      return Promise.resolve(v ?? []);
    }),
    select: vi.fn(() => {
      const c: Record<string, unknown> = {};
      for (const m of ['from', 'where', 'limit']) c[m] = vi.fn(() => c);
      (c as { then: (r: (v: unknown) => void) => void }).then = (resolve) => {
        const v = h.selectQueue.shift();
        if (v instanceof Error) throw v;
        resolve(v ?? []);
      };
      return c;
    }),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  inArray: vi.fn(() => 'inArray'),
  sql: Object.assign(
    vi.fn(() => 'sql'),
    {},
  ),
}));

vi.mock('@/db/schema-organizations', () => ({
  organizations: { id: 'id', slug: 'slug' },
}));

import {
  batchGetOrganizationIds,
  clearCache,
  createMapping,
  getAllMappings,
  getMigrationStats,
  getOrganizationIdFromTenant,
  getTenantIdFromOrganization,
  refreshCache,
  updateMappingStatus,
  validateMapping,
} from '../tenant-to-org-mapper';

beforeEach(() => {
  h.execQueue = [];
  h.selectQueue = [];
  clearCache();
});

describe('lib/migrations/tenant-to-org-mapper', () => {
  it('refreshCache populates the cache, enabling cache hits', async () => {
    h.execQueue.push([{ tenant_id: 't-cache', organization_id: 'o-cache' }]);
    await refreshCache();
    // cache fresh now → cache hit path
    const orgId = await getOrganizationIdFromTenant('t-cache');
    expect(orgId).toBe('o-cache');
    const tenantId = await getTenantIdFromOrganization('o-cache');
    expect(tenantId).toBe('t-cache');
  });

  it('refreshCache swallows errors', async () => {
    h.execQueue.push(new Error('boom'));
    await expect(refreshCache()).resolves.toBeUndefined();
  });

  it('getOrganizationIdFromTenant resolves via mapping table', async () => {
    h.execQueue.push([{ organization_id: 'o1' }]);
    expect(await getOrganizationIdFromTenant('t1')).toBe('o1');
  });

  it('getOrganizationIdFromTenant falls back to slug match', async () => {
    h.execQueue.push([]); // no mapping
    h.selectQueue.push([{ id: 'o2' }]); // slug match
    expect(await getOrganizationIdFromTenant('t2')).toBe('o2');
  });

  it('getOrganizationIdFromTenant returns null when unmatched', async () => {
    h.execQueue.push([]);
    h.selectQueue.push([]);
    expect(await getOrganizationIdFromTenant('t3')).toBeNull();
  });

  it('getOrganizationIdFromTenant returns null on error', async () => {
    h.execQueue.push(new Error('db down'));
    expect(await getOrganizationIdFromTenant('t4')).toBeNull();
  });

  it('getTenantIdFromOrganization resolves via mapping table', async () => {
    h.execQueue.push([{ tenant_id: 't5' }]);
    expect(await getTenantIdFromOrganization('o5')).toBe('t5');
  });

  it('getTenantIdFromOrganization falls back to slug', async () => {
    h.execQueue.push([]);
    h.selectQueue.push([{ slug: 't6' }]);
    expect(await getTenantIdFromOrganization('o6')).toBe('t6');
  });

  it('getTenantIdFromOrganization returns null when unmatched and on error', async () => {
    h.execQueue.push([]);
    h.selectQueue.push([{}]); // no slug
    expect(await getTenantIdFromOrganization('o7')).toBeNull();
    h.execQueue.push(new Error('x'));
    expect(await getTenantIdFromOrganization('o8')).toBeNull();
  });

  it('batchGetOrganizationIds returns empty map for empty input', async () => {
    const m = await batchGetOrganizationIds([]);
    expect(m.size).toBe(0);
  });

  it('batchGetOrganizationIds resolves via table and slug fallback', async () => {
    h.execQueue.push([{ tenant_id: 'a', organization_id: 'oa' }]);
    h.selectQueue.push([{ id: 'ob', slug: 'b' }]); // slug fallback for 'b'
    const m = await batchGetOrganizationIds(['a', 'b']);
    expect(m.get('a')).toBe('oa');
    expect(m.get('b')).toBe('ob');
  });

  it('batchGetOrganizationIds uses cache when fresh', async () => {
    h.execQueue.push([{ tenant_id: 'c', organization_id: 'oc' }]);
    await refreshCache(); // populate + fresh
    const m = await batchGetOrganizationIds(['c']);
    expect(m.get('c')).toBe('oc');
  });

  it('batchGetOrganizationIds returns map on error', async () => {
    h.execQueue.push(new Error('fail'));
    const m = await batchGetOrganizationIds(['z']);
    expect(m.size).toBe(0);
  });

  it('validateMapping reports existing and missing mappings', async () => {
    h.execQueue.push([
      { organization_id: 'o', migration_status: 'completed', record_count: 5, error_log: null },
    ]);
    const found = await validateMapping('t');
    expect(found.exists).toBe(true);
    expect(found.recordCount).toBe(5);

    h.execQueue.push([]);
    const missing = await validateMapping('t-missing');
    expect(missing.exists).toBe(false);

    h.execQueue.push(new Error('err'));
    const errored = await validateMapping('t-err');
    expect(errored.exists).toBe(false);
  });

  it('createMapping returns true on success and false on error', async () => {
    h.execQueue.push([]);
    expect(await createMapping('t', 'o', 'admin')).toBe(true);
    h.execQueue.push(new Error('err'));
    expect(await createMapping('t', 'o', 'admin')).toBe(false);
  });

  it('updateMappingStatus handles completed and non-completed branches', async () => {
    h.execQueue.push([]);
    expect(await updateMappingStatus('t', 'completed', 10, 'log')).toBe(true);
    h.execQueue.push([]);
    expect(await updateMappingStatus('t', 'in_progress')).toBe(true);
    h.execQueue.push(new Error('err'));
    expect(await updateMappingStatus('t', 'failed')).toBe(false);
  });

  it('getAllMappings maps rows with and without filter', async () => {
    h.execQueue.push([
      {
        tenant_id: 't',
        organization_id: 'o',
        migration_status: 'completed',
        migrated_at: null,
        migrated_by: null,
        record_count: 3,
        error_log: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    const all = await getAllMappings('completed');
    expect(all[0].recordCount).toBe(3);

    h.execQueue.push(new Error('err'));
    expect(await getAllMappings()).toEqual([]);
  });

  it('getMigrationStats aggregates counts and handles errors', async () => {
    h.execQueue.push([
      {
        total: 10, pending: 1, in_progress: 2, completed: 5,
        failed: 1, rolled_back: 1, total_records: 100,
      },
    ]);
    const stats = await getMigrationStats();
    expect(stats.total).toBe(10);
    expect(stats.totalRecords).toBe(100);

    h.execQueue.push(new Error('err'));
    expect((await getMigrationStats()).total).toBe(0);
  });

  it('clearCache resets cache state', () => {
    expect(() => clearCache()).not.toThrow();
  });
});
