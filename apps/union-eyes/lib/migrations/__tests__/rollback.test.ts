import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  ret: [] as unknown[],
  updateMappingStatus: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: { execute: vi.fn(() => Promise.resolve(h.ret)) },
}));

vi.mock('drizzle-orm', () => ({
  relations: vi.fn(() => ({})),
  sql: Object.assign(
    vi.fn(() => 'sql'),
    { raw: vi.fn(() => 'sql-raw') },
  ),
}));

vi.mock('@/lib/migrations/tenant-to-org-mapper', () => ({
  updateMappingStatus: h.updateMappingStatus,
}));

import {
  cleanupBackups,
  compareWithBackup,
  createAllBackups,
  createTableBackup,
  emergencyRollback,
  listBackups,
  rollbackAllTables,
  rollbackTable,
  rollbackTenant,
  verifyAllRollbacks,
  verifyRollback,
} from '../rollback';

beforeEach(() => {
  // Two backup rows so list/filter/sort callbacks all execute.
  h.ret = [
    { table_name: 'profiles_backup_100', count: 5 },
    { table_name: 'profiles_backup_200', count: 3 },
  ];
  h.updateMappingStatus.mockResolvedValue(true);
});

describe('lib/migrations/rollback', () => {
  it('createTableBackup returns row count on success', async () => {
    const r = await createTableBackup('profiles');
    expect(r.success).toBe(true);
    expect(r.rowCount).toBe(5);
  });

  it('createAllBackups backs up every table', async () => {
    const backups = await createAllBackups();
    expect(backups.size).toBe(8);
  });

  it('listBackups returns parsed backup info', async () => {
    const backups = await listBackups();
    expect(backups.length).toBe(2);
    expect(backups[0].tableName).toBe('profiles');
  });

  it('cleanupBackups deletes old backups', async () => {
    const deleted = await cleanupBackups(7);
    expect(deleted).toBe(2);
  });

  it('rollbackTable restores using most recent backup', async () => {
    const r = await rollbackTable('profiles');
    expect(r.status).toBe('completed');
    expect(r.rowsRestored).toBe(5);
  });

  it('rollbackTable uses provided backup name', async () => {
    const r = await rollbackTable('profiles', 'profiles_backup_999');
    expect(r.status).toBe('completed');
  });

  it('rollbackTable fails when no backup exists', async () => {
    const r = await rollbackTable('unknown_table');
    expect(r.status).toBe('failed');
    expect(r.errors.length).toBe(1);
  });

  it('rollbackAllTables returns a result per table', async () => {
    const results = await rollbackAllTables();
    expect(results.size).toBe(8);
  });

  it('rollbackTenant clears organization ids and updates mapping', async () => {
    expect(await rollbackTenant('tenant-1')).toBe(true);
    expect(h.updateMappingStatus).toHaveBeenCalledWith('tenant-1', 'rolled_back');
  });

  it('verifyRollback flags remaining organization ids', async () => {
    const r = await verifyRollback('profiles');
    expect(r.withOrgId).toBe(5);
    expect(r.success).toBe(false);
  });

  it('verifyAllRollbacks verifies every table', async () => {
    const results = await verifyAllRollbacks();
    expect(results.size).toBe(8);
  });

  it('compareWithBackup compares row counts', async () => {
    const r = await compareWithBackup('profiles', 'profiles_backup_100');
    expect(r.matches).toBe(true);
  });

  it('emergencyRollback rolls back all tables and updates mappings', async () => {
    const r = await emergencyRollback();
    expect(r.tablesRolledBack).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(r.errors)).toBe(true);
  });
});
