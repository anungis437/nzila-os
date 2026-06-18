import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  exec: (() => Promise.resolve([] as unknown[])) as (q: unknown) => Promise<unknown>,
  batchGetOrganizationIds: vi.fn(),
  updateMappingStatus: vi.fn(),
  validateMapping: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: { execute: vi.fn((q: unknown) => h.exec(q)) },
}));

vi.mock('drizzle-orm', () => ({
  relations: vi.fn(() => ({})),
  sql: Object.assign(
    vi.fn(() => 'sql'),
    { raw: vi.fn((s: string) => s) }, // pass-through so execute can inspect
  ),
}));

vi.mock('@/lib/migrations/tenant-to-org-mapper', () => ({
  batchGetOrganizationIds: h.batchGetOrganizationIds,
  updateMappingStatus: h.updateMappingStatus,
  validateMapping: h.validateMapping,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  getMigrationProgress,
  migrateAllTables,
  migrateTable,
  migrateTenant,
} from '../batch-migration';

// Default content-based execute: columns exist, every count = 1, batch = 1 row.
function defaultExec(q: unknown): Promise<unknown> {
  const s = String(q);
  if (s.includes('information_schema.columns')) {
    return Promise.resolve([{ column_name: 'organization_id' }]);
  }
  if (s.includes('SUM(CASE')) {
    return Promise.resolve([{ total: 2, migrated: 1 }]);
  }
  if (s.includes('COUNT(*)')) {
    return Promise.resolve([{ count: 1 }]);
  }
  if (s.includes('SELECT *') && s.includes('LIMIT')) {
    return Promise.resolve([{ id: '1', tenant_id: 't1' }]);
  }
  return Promise.resolve([]);
}

function queued(items: unknown[]): (q: unknown) => Promise<unknown> {
  let i = 0;
  return () => {
    const v = items[i++];
    if (v instanceof Error) return Promise.reject(v);
    return Promise.resolve(v ?? []);
  };
}

const profilesConfig = {
  tableName: 'profiles',
  tenantIdColumn: 'tenant_id',
  organizationIdColumn: 'organization_id',
  batchSize: 1000,
  dependencies: [] as string[],
};

beforeEach(() => {
  h.exec = defaultExec;
  h.batchGetOrganizationIds.mockResolvedValue(new Map([['t1', 'o1']]));
  h.updateMappingStatus.mockResolvedValue(true);
  h.validateMapping.mockResolvedValue({ exists: true, organizationId: 'o1' });
});

describe('migrateTable', () => {
  it('migrates rows in a batch', async () => {
    const progress = vi.fn();
    const result = await migrateTable(profilesConfig, false, progress);
    expect(result.status).toBe('completed');
    expect(result.migratedRows).toBe(1);
    expect(progress).toHaveBeenCalled();
  });

  it('records failures when no mapping exists', async () => {
    h.exec = queued([
      [{ column_name: 'organization_id' }], // columns exist
      [{ count: 1 }], // count
      [{ id: '1', tenant_id: 'tX' }], // batch
    ]);
    h.batchGetOrganizationIds.mockResolvedValue(new Map());
    const result = await migrateTable(profilesConfig, false);
    expect(result.failedRows).toBe(1);
    expect(result.status).toBe('failed');
  });

  it('skips rows failing custom validation and supports dry run', async () => {
    h.exec = queued([
      [{ column_name: 'organization_id' }],
      [{ count: 2 }],
      [{ id: '1', tenant_id: 't1' }, { id: '2', tenant_id: 't2' }],
    ]);
    h.batchGetOrganizationIds.mockResolvedValue(new Map([['t1', 'o1'], ['t2', 'o2']]));
    const validate = vi.fn(async (row: { id: string }) => row.id === '1');
    const result = await migrateTable({ ...profilesConfig, validate }, true);
    expect(result.migratedRows).toBe(1);
    expect(result.skippedRows).toBe(1);
  });

  it('adds the organization_id column when missing', async () => {
    h.exec = queued([
      [], // columns missing
      [], // ALTER
      [], // CREATE INDEX
      [{ count: 0 }], // count -> no rows
    ]);
    const result = await migrateTable(profilesConfig, false);
    expect(result.status).toBe('completed');
    expect(result.totalRows).toBe(0);
  });

  it('captures per-row update errors', async () => {
    h.exec = queued([
      [{ column_name: 'organization_id' }],
      [{ count: 1 }],
      [{ id: '1', tenant_id: 't1' }],
      new Error('update failed'),
    ]);
    const result = await migrateTable(profilesConfig, false);
    expect(result.failedRows).toBe(1);
  });

  it('handles fatal errors', async () => {
    h.exec = queued([
      [{ column_name: 'organization_id' }],
      new Error('count failed'),
    ]);
    const result = await migrateTable(profilesConfig, false);
    expect(result.status).toBe('failed');
    expect(result.errors.length).toBe(1);
  });
});

describe('migrateAllTables', () => {
  it('migrates every table in dependency order', async () => {
    const progress = vi.fn();
    const results = await migrateAllTables(false, progress);
    expect(results.size).toBe(8);
    expect(progress).toHaveBeenCalled();
  });
});

describe('migrateTenant', () => {
  it('migrates a tenant across all tables', async () => {
    const results = await migrateTenant('tenant-1', false);
    expect(results.size).toBeGreaterThan(0);
    expect(h.updateMappingStatus).toHaveBeenCalledWith('tenant-1', 'in_progress');
    expect(h.updateMappingStatus).toHaveBeenCalledWith('tenant-1', 'completed', expect.any(Number));
  });

  it('returns empty when mapping is missing', async () => {
    h.validateMapping.mockResolvedValue({ exists: false });
    const results = await migrateTenant('missing', false);
    expect(results.size).toBe(0);
  });

  it('handles per-table errors during tenant migration', async () => {
    let calls = 0;
    h.exec = (q: unknown) => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error('count failed'));
      return defaultExec(q);
    };
    const results = await migrateTenant('tenant-2', false);
    expect(results.get('profiles')?.status).toBe('failed');
  });
});

describe('getMigrationProgress', () => {
  it('reports per-table and overall progress', async () => {
    const progress = await getMigrationProgress();
    expect(progress.tables.length).toBe(8);
    expect(progress.overall.percentage).toBeGreaterThan(0);
  });

  it('handles query errors gracefully', async () => {
    h.exec = () => Promise.reject(new Error('progress failed'));
    const progress = await getMigrationProgress();
    expect(progress.overall.total).toBe(0);
  });
});
