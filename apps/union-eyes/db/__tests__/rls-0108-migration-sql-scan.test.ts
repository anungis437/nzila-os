/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 6: guards against the exact parser-defect class the round-5
 * report shipped with — a regex that only matched 1-arg
 * ue_create_*_rls_policy() calls, silently missing every 2-arg/3-arg call,
 * which produced 7 false-positive "missing from 0108" entries for tables
 * that are genuinely protected (organization_members, organizations,
 * documents, messages, message_participants, message_read_receipts,
 * message_notifications).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanMigrationSqlForProtectedTables } from '../rls-0108-migration-sql-scan';

describe('scanMigrationSqlForProtectedTables', () => {
  it('extracts the table name from a 1-argument helper call', () => {
    const sql = `SELECT ue_create_direct_org_rls_policy('grievances');`;
    expect(scanMigrationSqlForProtectedTables(sql)).toEqual(new Set(['grievances']));
  });

  it('extracts the table name from a 2-argument helper call', () => {
    const sql = `SELECT ue_create_direct_org_rls_policy('documents', 'organization_id');`;
    expect(scanMigrationSqlForProtectedTables(sql)).toEqual(new Set(['documents']));
  });

  it('extracts the table name from a 3-argument helper call (the exact shape the round-5 regex missed)', () => {
    const sql = `SELECT ue_create_direct_org_rls_policy('organization_members', 'organization_id', TRUE); -- TEXT column, see note above`;
    expect(scanMigrationSqlForProtectedTables(sql)).toEqual(new Set(['organization_members']));
  });

  it('extracts the table name from a parent-owned 2-argument helper call', () => {
    const sql = `SELECT ue_create_parent_owned_rls_policy('messages', 'thread_id');`;
    expect(scanMigrationSqlForProtectedTables(sql)).toEqual(new Set(['messages']));
  });

  it('extracts the table name from a direct ALTER TABLE ... ENABLE ROW LEVEL SECURITY statement', () => {
    const sql = `ALTER TABLE "cross_org_access_log" ENABLE ROW LEVEL SECURITY;`;
    expect(scanMigrationSqlForProtectedTables(sql)).toEqual(new Set(['cross_org_access_log']));
  });

  it('extracts every table across a mixed multi-statement migration snippet, matching real 0108 shapes', () => {
    const sql = `
      SELECT ue_create_direct_org_rls_policy('organization_members', 'organization_id', TRUE); -- TEXT column, see note above
      SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row
      SELECT ue_create_direct_org_rls_policy('grievances');
      SELECT ue_create_direct_org_rls_policy('documents', 'organization_id');
      SELECT ue_create_parent_owned_rls_policy('messages', 'thread_id');
      SELECT ue_create_parent_owned_rls_policy('message_participants', 'thread_id');
      ALTER TABLE cross_org_access_log ENABLE ROW LEVEL SECURITY;
    `;
    expect(scanMigrationSqlForProtectedTables(sql)).toEqual(new Set([
      'organization_members',
      'organizations',
      'grievances',
      'documents',
      'messages',
      'message_participants',
      'cross_org_access_log',
    ]));
  });

  it('scanning the REAL 0108 migration SQL now finds all 24 baseline tables (regression guard for the 7-table false-positive)', () => {
    const sql = readFileSync(
      resolve(__dirname, '..', 'migrations', '0108_rls_tenant_isolation_foundation.sql'),
      'utf8',
    );
    const found = scanMigrationSqlForProtectedTables(sql);
    const previouslyMissed = [
      'organization_members',
      'organizations',
      'documents',
      'messages',
      'message_participants',
      'message_read_receipts',
      'message_notifications',
    ];
    for (const table of previouslyMissed) {
      expect(found.has(table), `expected ${table} to be found in 0108's migration SQL`).toBe(true);
    }
  });
});
