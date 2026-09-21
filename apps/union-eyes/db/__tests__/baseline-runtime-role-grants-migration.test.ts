/**
 * Contract tests for the canonical baseline runtime-role grant migration
 * (db/migrations-cache/0009_baseline_runtime_role_grants.sql).
 *
 * Background (adjudicated BOOTSTRAP_GRANT_STRATEGY =
 * CANONICAL_0108_BASELINE_COMPATIBILITY): a source-native bootstrap replays the
 * ACTIVE scoped migration lineage (db/migrations-cache), never the frozen
 * db/migrations/0108 lineage. 0108 PART 3 is the ONLY place the broad-baseline
 * DML privilege envelope for the two application principals was declared, so
 * without carrying it forward the runtime principal would hold table grants on
 * only the handful of tables the 0006-0008 specialized closures touch — the
 * application (and Django, which runs as union_eyes_runtime) would be unusable.
 *
 * These tests pin 0009 to a FAITHFUL RECONSTRUCTION of the 0108 PART 3
 * baseline, and fail closed if 0009 ever drifts into role creation, privilege
 * escalation, RLS bypass, or duplication of the specialized scoped closures.
 * They do NOT assert per-table least privilege — that is an explicitly
 * DEFERRED hardening track.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_CACHE = path.join(APP_ROOT, 'db', 'migrations-cache');
const JOURNAL_PATH = path.join(MIGRATIONS_CACHE, 'meta', '_journal.json');
const BASELINE_TAG = '0009_baseline_runtime_role_grants';
const BASELINE_SQL_PATH = path.join(MIGRATIONS_CACHE, `${BASELINE_TAG}.sql`);
const FROZEN_0108_PATH = path.join(APP_ROOT, 'db', 'migrations', '0108_rls_tenant_isolation_foundation.sql');

const ROLES = ['union_eyes_runtime', 'union_eyes_system'];

function readBaselineSql(): string {
  return fs.readFileSync(BASELINE_SQL_PATH, 'utf8');
}

/**
 * The executable body only — comment lines are stripped so prohibition tokens
 * that legitimately appear in the migration's own scope-discipline commentary
 * (e.g. "NO SUPERUSER, NO BYPASSRLS, NO CREATE ROLE") cannot masquerade as real
 * DDL and produce false positives.
 */
function nonCommentSql(): string {
  return readBaselineSql()
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

/** Collapse whitespace so multi-line statements compare canonically. */
function canonicalizeStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

describe('0009 baseline runtime-role grant migration — journal registration', () => {
  it('is registered with breakpoints enabled, immediately before the 0010 RLS foundation entry', () => {
    const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
    const entries = journal.entries ?? [];
    // 0009 is no longer the final entry — 0010_tenant_isolation_rls_foundation
    // was appended after it. Locate 0009 by tag and assert its position.
    const baselineIdx = entries.findIndex((e: { tag: string }) => e.tag === BASELINE_TAG);
    expect(baselineIdx).toBeGreaterThanOrEqual(0);
    const baseline = entries[baselineIdx];
    expect(baseline.breakpoints).toBe(true);
    // strictly-increasing idx and monotonic ordering
    const idxs = entries.map((e: { idx: number }) => e.idx);
    expect(idxs).toEqual([...idxs].sort((a, b) => a - b));
    expect(baseline.idx).toBe(baselineIdx);
    // the entry that follows 0009 is the 0010 RLS foundation migration
    expect(entries[baselineIdx + 1]?.tag).toBe('0010_tenant_isolation_rls_foundation');
  });

  it('has a migration file on disk that the shared executor can hash', () => {
    expect(fs.existsSync(BASELINE_SQL_PATH)).toBe(true);
    expect(readBaselineSql().trim().length).toBeGreaterThan(0);
  });

  it('splits cleanly into non-empty statements on the Drizzle breakpoint', () => {
    const statements = readBaselineSql()
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    // 5 grant/alter statements + 1 DO CONNECT block = 6
    expect(statements.length).toBe(6);
    for (const stmt of statements) {
      expect(stmt.length).toBeGreaterThan(0);
    }
  });
});

describe('0009 baseline runtime-role grant migration — scope discipline (fail-closed)', () => {
  it('REFERENCES roles but never creates, alters, or authenticates them', () => {
    const sql = nonCommentSql().toUpperCase();
    expect(sql).not.toMatch(/\bCREATE\s+ROLE\b/);
    expect(sql).not.toMatch(/\bCREATE\s+USER\b/);
    expect(sql).not.toMatch(/\bALTER\s+ROLE\b/);
    expect(sql).not.toMatch(/\bDROP\s+ROLE\b/);
    expect(sql).not.toMatch(/\bWITH\s+LOGIN\b/);
    expect(sql).not.toMatch(/\bPASSWORD\b/);
  });

  it('never escalates privilege (no SUPERUSER / BYPASSRLS / CREATEROLE / CREATEDB / REPLICATION)', () => {
    const sql = nonCommentSql().toUpperCase();
    expect(sql).not.toMatch(/\bSUPERUSER\b/);
    expect(sql).not.toMatch(/\bBYPASSRLS\b/);
    expect(sql).not.toMatch(/\bCREATEROLE\b/);
    expect(sql).not.toMatch(/\bCREATEDB\b/);
    expect(sql).not.toMatch(/\bREPLICATION\b/);
  });

  it('never widens the grant to PUBLIC (role target, not the public schema)', () => {
    // Only a role-level `TO PUBLIC` is a widening risk; `SCHEMA public` is the
    // legitimate object the baseline grants against.
    const sql = nonCommentSql();
    expect(sql).not.toMatch(/\bTO\s+PUBLIC\b/i);
    expect(sql).not.toMatch(/\bFROM\s+PUBLIC\b/i);
  });

  it('is a pure grant layer — declares no RLS enablement or policies', () => {
    const sql = nonCommentSql().toUpperCase();
    expect(sql).not.toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/);
    expect(sql).not.toMatch(/FORCE\s+ROW\s+LEVEL\s+SECURITY/);
    expect(sql).not.toMatch(/CREATE\s+POLICY/);
    // and creates no tables/schemas — it only grants against what already exists
    expect(sql).not.toMatch(/CREATE\s+TABLE/);
    expect(sql).not.toMatch(/CREATE\s+SCHEMA/);
  });
});

describe('0009 baseline runtime-role grant migration — 0108 PART 3 fidelity', () => {
  it('reproduces the exact 0108 PART 3 baseline privilege envelope for both principals', () => {
    const statements = canonicalizeStatements(readBaselineSql());
    const rolesList = ROLES.join(', ');
    const expected = [
      `GRANT USAGE ON SCHEMA public TO ${rolesList};`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${rolesList};`,
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${rolesList};`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM ${rolesList};`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM ${rolesList};`,
    ];
    for (const stmt of expected) {
      expect(statements).toContain(stmt);
    }
    // CONNECT is issued via a current_database() DO-block (portable across DB names)
    const connectBlock = statements.find((s) => s.includes('GRANT CONNECT ON DATABASE'));
    expect(connectBlock).toBeTruthy();
    for (const role of ROLES) {
      expect(connectBlock).toContain(role);
    }
  });

  it('grants the broad-table baseline to BOTH runtime and system principals', () => {
    const statements = canonicalizeStatements(readBaselineSql());
    const dml = statements.find((s) =>
      /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public/.test(s),
    );
    expect(dml).toBeTruthy();
    for (const role of ROLES) {
      expect(dml).toContain(role);
    }
  });

  it('preserves the 0108 invariant that FUTURE tables are not auto-granted (ALTER DEFAULT PRIVILEGES REVOKE)', () => {
    const sql = readBaselineSql();
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES IN SCHEMA public\s+REVOKE/i);
  });

  it('the frozen 0108 source still declares the same PART 3 baseline (drift detector across both files)', () => {
    const frozen = fs.readFileSync(FROZEN_0108_PATH, 'utf8');
    expect(frozen).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO union_eyes_runtime, union_eyes_system;/,
    );
    expect(frozen).toMatch(
      /GRANT USAGE ON SCHEMA public TO union_eyes_runtime, union_eyes_system;/,
    );
    expect(frozen).toMatch(/ALTER DEFAULT PRIVILEGES IN SCHEMA public/);
  });
});

describe('0009 baseline runtime-role grant migration — no duplication of specialized closures', () => {
  it('does not re-grant the schema-specific privileges owned by 0006-0008', () => {
    const sql = readBaselineSql();
    // Specialized closures own user_management and audit_security explicitly.
    expect(sql).not.toMatch(/user_management/i);
    expect(sql).not.toMatch(/audit_security/i);
  });

  it('remains the SOLE owner of the public broad-table baseline (0006-0008 never grant it)', () => {
    for (const tag of [
      '0006_external_specialist_runtime_privilege_closure',
      '0007_auth_bootstrap_runtime_remediation',
      '0008_runtime_acceptance_closure',
    ]) {
      const other = fs.readFileSync(path.join(MIGRATIONS_CACHE, `${tag}.sql`), 'utf8');
      expect(other).not.toMatch(/ON ALL TABLES IN SCHEMA public/i);
    }
  });
});
