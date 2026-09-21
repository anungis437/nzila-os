/**
 * Contract tests for the canonical tenant-isolation RLS foundation migration
 * (db/migrations-cache/0010_tenant_isolation_rls_foundation.sql).
 *
 * Background (adjudicated RLS_FOUNDATION_STRATEGY =
 * SCOPED_0010_SOURCE_NATIVE): a source-native bootstrap replays the ACTIVE
 * scoped migration lineage (db/migrations-cache), never the frozen
 * db/migrations/0108 lineage. 0108 PART 4/5/6/7 is the ONLY place the
 * tenant-isolation RLS foundation (ENABLE/FORCE ROW LEVEL SECURITY +
 * ue_org_isolation_* / ue_parent_org_isolation / ue_system_full_access
 * policies + the two durable helper functions) was declared, so without
 * carrying it forward the 24 canonical tenant tables would hold the broad
 * baseline DML grant (from 0009) but NO row-level tenant isolation. 0010 is
 * the RLS analogue of 0009's PART 3 grant reconstruction.
 *
 * These tests pin 0010 to a FAITHFUL RECONSTRUCTION of the 0108 PART 4/5/6/7
 * foundation, and fail closed if 0010 ever drifts into role creation,
 * privilege escalation, baseline-grant duplication, or removal of the later
 * scoped additive policies. They assert the STATIC shape of the migration;
 * live semantic parity against a real 0108 apply is proven separately by the
 * evidence gauntlet.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_0108_PROTECTED_TABLES,
  PROTECTED_DIRECT_TABLES,
  PROTECTED_PARENT_OWNED_TABLES,
  PROTECTED_NO_TENANT_ACCESS_TABLES,
} from '../rls-0108-protected-tables';

const APP_ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_CACHE = path.join(APP_ROOT, 'db', 'migrations-cache');
const JOURNAL_PATH = path.join(MIGRATIONS_CACHE, 'meta', '_journal.json');
const RLS_TAG = '0010_tenant_isolation_rls_foundation';
const RLS_SQL_PATH = path.join(MIGRATIONS_CACHE, `${RLS_TAG}.sql`);
const RLS_ROLLBACK_PATH = path.join(MIGRATIONS_CACHE, `${RLS_TAG}.rollback.sql`);
const FROZEN_0108_PATH = path.join(APP_ROOT, 'db', 'migrations', '0108_rls_tenant_isolation_foundation.sql');

const CANONICAL_POLICY_NAMES = [
  'ue_org_isolation_select',
  'ue_org_isolation_insert',
  'ue_org_isolation_update',
  'ue_org_isolation_delete',
  'ue_parent_org_isolation',
  'ue_system_full_access',
];

function readRlsSql(): string {
  return fs.readFileSync(RLS_SQL_PATH, 'utf8');
}

function readRollbackSql(): string {
  return fs.readFileSync(RLS_ROLLBACK_PATH, 'utf8');
}

/**
 * Executable body only — comment lines (including the `--> statement-breakpoint`
 * markers) are stripped so prohibition tokens that legitimately appear in the
 * migration's own scope-discipline commentary cannot masquerade as real DDL and
 * produce false positives.
 */
function nonCommentSql(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

describe('0010 RLS foundation migration — journal registration', () => {
  it('is registered at idx 10 with breakpoints enabled, immediately after 0009', () => {
    const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
    const entries = journal.entries ?? [];
    const pos = entries.findIndex((e: { tag: string }) => e.tag === RLS_TAG);
    expect(pos).toBeGreaterThanOrEqual(0);
    const self = entries[pos];
    expect(self.tag).toBe(RLS_TAG);
    expect(self.idx).toBe(10);
    expect(self.breakpoints).toBe(true);
    // strictly-increasing idx and monotonic ordering
    const idxs = entries.map((e: { idx: number }) => e.idx);
    expect(idxs).toEqual([...idxs].sort((a, b) => a - b));
    expect(self.idx).toBe(pos);
    // immediately follows the 0009 baseline grant migration
    expect(entries[pos - 1]?.tag).toBe('0009_baseline_runtime_role_grants');
    // the later storage-authority RLS closures (0011, 0012) build on 0010.
    expect(entries[pos + 1]?.tag).toBe('0011_storage_authority_rls_completion');
  });

  it('has a migration file on disk that the shared executor can hash', () => {
    expect(fs.existsSync(RLS_SQL_PATH)).toBe(true);
    expect(readRlsSql().trim().length).toBeGreaterThan(0);
  });

  it('splits cleanly into non-empty statements on the Drizzle breakpoint', () => {
    const statements = readRlsSql()
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements.length).toBeGreaterThan(10);
    for (const stmt of statements) {
      expect(stmt.length).toBeGreaterThan(0);
    }
  });
});

describe('0010 RLS foundation migration — scope discipline (fail-closed)', () => {
  it('never creates, alters, drops, or authenticates roles (provisioning owns that)', () => {
    const sql = nonCommentSql(readRlsSql()).toUpperCase();
    expect(sql).not.toMatch(/\bCREATE\s+ROLE\b/);
    expect(sql).not.toMatch(/\bCREATE\s+USER\b/);
    expect(sql).not.toMatch(/\bALTER\s+ROLE\b/);
    expect(sql).not.toMatch(/\bDROP\s+ROLE\b/);
    expect(sql).not.toMatch(/\bWITH\s+LOGIN\b/);
    expect(sql).not.toMatch(/\bPASSWORD\b/);
  });

  it('never escalates privilege (no SUPERUSER / BYPASSRLS / CREATEROLE / CREATEDB / REPLICATION)', () => {
    const sql = nonCommentSql(readRlsSql()).toUpperCase();
    expect(sql).not.toMatch(/\bSUPERUSER\b/);
    expect(sql).not.toMatch(/\bBYPASSRLS\b/);
    expect(sql).not.toMatch(/\bCREATEROLE\b/);
    expect(sql).not.toMatch(/\bCREATEDB\b/);
    expect(sql).not.toMatch(/\bREPLICATION\b/);
  });

  it('is a pure RLS layer — declares no baseline grants (0009 owns those)', () => {
    const sql = nonCommentSql(readRlsSql());
    // No GRANT/REVOKE of any kind, and no ALTER DEFAULT PRIVILEGES — the entire
    // grant envelope is 0009's responsibility.
    expect(sql).not.toMatch(/\bGRANT\b/i);
    expect(sql).not.toMatch(/\bREVOKE\b/i);
    expect(sql).not.toMatch(/\bALTER\s+DEFAULT\s+PRIVILEGES\b/i);
  });

  it('does not touch the specialized scoped schemas owned by 0006-0008', () => {
    // Executable body only — the scope-discipline commentary legitimately names
    // user_management / audit_security when explaining what 0010 must NOT touch.
    const sql = nonCommentSql(readRlsSql());
    expect(sql).not.toMatch(/user_management/i);
    expect(sql).not.toMatch(/audit_security/i);
  });

  it('never drops the later scoped additive policies (0006/0007/0008)', () => {
    // Executable body only — the commentary legitimately names ue_external_* etc.
    // when describing what 0010 must NOT remove.
    const sql = nonCommentSql(readRlsSql());
    expect(sql).not.toMatch(/DROP\s+POLICY[^;]*ue_external_/i);
    expect(sql).not.toMatch(/DROP\s+POLICY[^;]*ue_auth_bootstrap_/i);
    expect(sql).not.toMatch(/DROP\s+POLICY[^;]*ue_runtime_audit_/i);
  });
});

describe('0010 RLS foundation migration — tenant-isolation content (0108 PART 4/5/6/7 fidelity)', () => {
  it('enables and FORCEs row level security', () => {
    const sql = readRlsSql();
    expect(sql).toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/);
    expect(sql).toMatch(/FORCE\s+ROW\s+LEVEL\s+SECURITY/);
  });

  it('declares the two durable helper functions with CREATE OR REPLACE', () => {
    const sql = readRlsSql();
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+ue_create_direct_org_rls_policy/i);
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+ue_create_parent_owned_rls_policy/i);
  });

  it('creates every canonical 0108 policy name', () => {
    const sql = readRlsSql();
    for (const name of CANONICAL_POLICY_NAMES) {
      expect(sql).toContain(name);
    }
  });

  it('scopes tenant isolation to union_eyes_runtime and full access to union_eyes_system', () => {
    const sql = readRlsSql();
    expect(sql).toMatch(/ue_org_isolation_select ON %I FOR SELECT TO union_eyes_runtime/);
    expect(sql).toMatch(/ue_system_full_access[^;]*TO union_eyes_system USING \(true\) WITH CHECK \(true\)/);
    // fail-closed by omission for cross_org_access_log: system-only, no runtime policy
    expect(sql).toMatch(/CREATE POLICY ue_system_full_access ON cross_org_access_log FOR ALL TO union_eyes_system/);
  });

  it('references all 24 canonical protected tables from the shared source of truth', () => {
    expect(ALL_0108_PROTECTED_TABLES.length).toBe(24);
    expect(PROTECTED_DIRECT_TABLES.length).toBe(18);
    expect(PROTECTED_PARENT_OWNED_TABLES.length).toBe(5);
    expect(PROTECTED_NO_TENANT_ACCESS_TABLES.length).toBe(1);
    const sql = readRlsSql();
    for (const table of ALL_0108_PROTECTED_TABLES) {
      expect(sql).toContain(table);
    }
  });

  it('carries the 0108 empty-context-bypass prohibition check forward', () => {
    const sql = readRlsSql();
    expect(sql).toMatch(/Prohibited empty-context-bypass pattern/);
  });
});

describe('0010 RLS foundation migration — fail-closed conflict guard (PART -1)', () => {
  it('hard-fails on a canonical policy name with non-canonical semantics', () => {
    const sql = readRlsSql();
    expect(sql).toMatch(/RAISE\s+EXCEPTION[\s\S]*fail-closed/i);
  });

  it('guards every canonical policy name on the 24 protected tables', () => {
    const sql = readRlsSql();
    // The guard's policyname IN (...) list contains all six canonical names.
    const guardSection = sql.split('--> statement-breakpoint')[0];
    for (const name of CANONICAL_POLICY_NAMES) {
      expect(guardSection).toContain(name);
    }
  });
});

describe('0010 RLS foundation migration — idempotency', () => {
  it('uses idempotent DDL primitives (safe on fresh AND historical-0108 databases)', () => {
    const sql = readRlsSql();
    expect(sql).toMatch(/DROP\s+POLICY\s+IF\s+EXISTS/);
    expect(sql).toMatch(/CREATE\s+POLICY/);
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION/);
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/);
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/);
  });
});

describe('0010 RLS foundation migration — rollback safety (test/dev only)', () => {
  it('is explicitly classified as a test/development rollback that weakens production security', () => {
    const rollback = readRollbackSql();
    expect(rollback).toMatch(/TEST\s*\/\s*DEVELOPMENT\s+ROLLBACK\s+ONLY/i);
  });

  it('drops only the objects 0010 owns — the two helpers and the ue_ policies + RLS on the 24 tables', () => {
    const rollback = readRollbackSql();
    expect(rollback).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+ue_create_direct_org_rls_policy/i);
    expect(rollback).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+ue_create_parent_owned_rls_policy/i);
    expect(rollback).toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/);
  });

  it('does NOT drop roles, later scoped additive policies, 0009 grants, or the member_documents tenant column', () => {
    const rollback = nonCommentSql(readRollbackSql());
    expect(rollback).not.toMatch(/\bDROP\s+ROLE\b/i);
    expect(rollback).not.toMatch(/ue_external_/i);
    expect(rollback).not.toMatch(/ue_auth_bootstrap_/i);
    expect(rollback).not.toMatch(/ue_runtime_audit_/i);
    expect(rollback).not.toMatch(/\bREVOKE\b/i);
    expect(rollback).not.toMatch(/DROP\s+COLUMN/i);
  });
});

describe('0010 RLS foundation migration — 0108 parity drift detector', () => {
  it('the frozen 0108 source still declares the same foundation objects (cross-file guard)', () => {
    const frozen = fs.readFileSync(FROZEN_0108_PATH, 'utf8');
    expect(frozen).toMatch(/FUNCTION\s+ue_create_direct_org_rls_policy/i);
    expect(frozen).toMatch(/FUNCTION\s+ue_create_parent_owned_rls_policy/i);
    expect(frozen).toMatch(/ue_system_full_access/);
    expect(frozen).toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/);
    for (const name of CANONICAL_POLICY_NAMES) {
      expect(frozen).toContain(name);
    }
  });
});
