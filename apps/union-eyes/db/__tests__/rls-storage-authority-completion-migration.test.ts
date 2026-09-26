/**
 * Contract tests for the storage-authority RLS COMPLETION migration
 * (db/migrations-cache/0011_storage_authority_rls_completion.sql).
 *
 * 0011 closes the 144-table org-column delta and defines the durable helpers,
 * including the multi-party policy helper. On a database that previously ran
 * the frozen Round58 legacy lineage
 * (db/migrations/20260910_rls_enforcement_expansion_round58.sql), that helper
 * already exists with the SAME signature (text, text, text) but DIFFERENT input
 * parameter names (p_org_column_a / p_org_column_b). PostgreSQL
 * `CREATE OR REPLACE FUNCTION` cannot rename the input parameters of an existing
 * function, so the scoped definition MUST drop the legacy function first.
 *
 * These tests pin the compatibility guard so it cannot silently regress:
 *  - a DROP FUNCTION IF EXISTS of the exact 3-text signature exists,
 *  - it appears BEFORE the canonical CREATE OR REPLACE,
 *  - it never uses CASCADE (dropping cascaded objects would be a real defect),
 *  - the canonical helper body keeps its scoped parameter names.
 * Live behaviour (helper recreation + geometry) is proven separately by the
 * deterministic bootstrap + `pnpm rls:verify` + the runtime RLS probe.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_CACHE = path.join(APP_ROOT, 'db', 'migrations-cache');
const JOURNAL_PATH = path.join(MIGRATIONS_CACHE, 'meta', '_journal.json');
const TAG = '0011_storage_authority_rls_completion';
const SQL_PATH = path.join(MIGRATIONS_CACHE, `${TAG}.sql`);
const SQL = fs.readFileSync(SQL_PATH, 'utf8');

function nonComment(src: string): string {
  return src.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
}
const BODY = nonComment(SQL);

const HELPER = 'ue_create_multi_party_rls_policy';
const DROP_RE = new RegExp(
  `DROP\\s+FUNCTION\\s+IF\\s+EXISTS\\s+${HELPER}\\s*\\(\\s*text\\s*,\\s*text\\s*,\\s*text\\s*\\)`,
  'i',
);
const CREATE_RE = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${HELPER}\\s*\\(`, 'i');

describe('0011 storage-authority RLS completion — journal', () => {
  it('is registered as idx 11 in the scoped journal', () => {
    const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
    const entry = journal.entries.find((e: { tag: string }) => e.tag === TAG);
    expect(entry).toBeDefined();
    expect(entry.idx).toBe(11);
  });
});

describe('0011 multi-party helper — legacy-lineage compatibility guard', () => {
  it('drops the existing same-signature helper before recreating it', () => {
    expect(DROP_RE.test(SQL)).toBe(true);
  });

  it('places the DROP FUNCTION strictly before the canonical CREATE OR REPLACE', () => {
    const dropIdx = SQL.search(DROP_RE);
    const createIdx = SQL.search(CREATE_RE);
    expect(dropIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThanOrEqual(0);
    expect(dropIdx).toBeLessThan(createIdx);
  });

  it('never uses CASCADE on the compatibility DROP', () => {
    // No DROP of this helper anywhere may cascade — cascading would tear down
    // dependent objects, which is exactly the failure mode this guard avoids.
    const cascadeRe = new RegExp(
      `DROP\\s+FUNCTION[^;]*${HELPER}[^;]*CASCADE`,
      'i',
    );
    expect(cascadeRe.test(SQL)).toBe(false);
  });

  it('defines the helper exactly once with its scoped parameter names', () => {
    const createMatches = SQL.match(new RegExp(CREATE_RE.source, 'gi')) ?? [];
    expect(createMatches).toHaveLength(1);
    // The scoped canonical body keeps p_party_column_1 / p_party_column_2 — it is
    // NOT renamed to the legacy p_org_column_a / p_org_column_b names. Check the
    // executable body (comments explain the legacy names and are excluded).
    expect(BODY).toMatch(/p_party_column_1\s+TEXT/i);
    expect(BODY).toMatch(/p_party_column_2\s+TEXT/i);
    expect(BODY).not.toMatch(/p_org_column_a/i);
    expect(BODY).not.toMatch(/p_org_column_b/i);
  });
});
