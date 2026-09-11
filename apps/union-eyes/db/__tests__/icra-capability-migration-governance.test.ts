/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * Migration governance for the ICRA assessment-capability columns
 * (capability_token_hash, capability_token_expires_at on icra_assessments).
 *
 * Context (PR #752 review, Blocker #4): an earlier revision added a new
 * SQL file directly under the FROZEN legacy lineage (db/migrations/), which
 * has no guaranteed apply path (see db/migrations/LINEAGE-FROZEN.md and
 * docs/categories/platform-and-operations/architecture/orm-governance/
 * historical-migration-lineage-governance.md — that directory is read-only
 * archaeology, never replayed against fresh or existing databases).
 *
 * Per docs/.../orm-governance/migration-execution-governance.md and
 * db/schema-cache/cache.ts (which does `export * from "../schema/icra-schema"`),
 * ICRA tables ARE in-scope for the canonical scoped Drizzle authority — so
 * the correct, doctrine-consistent mechanism is a properly generated
 * scoped migration under db/migrations-cache/, tracked in
 * meta/_journal.json, applied by the ONE authorized entrypoint
 * (`pnpm --filter @nzila/union-eyes db:bootstrap`) for every environment
 * (local/dev/staging/demo/pilot, and post-Django-migrate in production).
 * That entrypoint is idempotent (tracks applied hashes in
 * drizzle.__drizzle_migrations), so re-running it against an
 * already-bootstrapped environment applies only the new, unapplied entry —
 * satisfying the requirement that capability-dependent app code cannot
 * reach an environment whose DB lacks these columns, as long as
 * `db:bootstrap` runs before that code is deployed.
 *
 * This test asserts the governance invariants that make that true, and
 * that no migration for this feature exists in the frozen lineage.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const DB_ROOT = path.resolve(__dirname, '..');
const SCOPED_MIGRATIONS_DIR = path.join(DB_ROOT, 'migrations-cache');
const SCOPED_JOURNAL = path.join(SCOPED_MIGRATIONS_DIR, 'meta', '_journal.json');
const FROZEN_LEGACY_DIR = path.join(DB_ROOT, 'migrations');
const SCHEMA_CACHE_BARREL = path.join(DB_ROOT, 'schema-cache', 'cache.ts');
const ICRA_SCHEMA_FILE = path.join(DB_ROOT, 'schema', 'icra-schema.ts');

const CAPABILITY_MIGRATION_TAG = '0005_add_icra_assessment_capability_token';
const REQUIRED_COLUMNS = ['capability_token_hash', 'capability_token_expires_at'];

describe('ICRA capability-token migration governance', () => {
  it('the capability migration is tracked in the scoped Drizzle journal (meta/_journal.json)', () => {
    const journal = JSON.parse(fs.readFileSync(SCOPED_JOURNAL, 'utf8'));
    const entries: Array<{ tag: string }> = journal.entries ?? [];
    const found = entries.find((e) => e.tag === CAPABILITY_MIGRATION_TAG);
    expect(
      found,
      `expected ${CAPABILITY_MIGRATION_TAG} to be a tracked entry in ${SCOPED_JOURNAL}`,
    ).toBeTruthy();
  });

  it('the migration SQL file referenced by the journal entry exists and adds the expected columns', () => {
    const sqlPath = path.join(SCOPED_MIGRATIONS_DIR, `${CAPABILITY_MIGRATION_TAG}.sql`);
    expect(fs.existsSync(sqlPath), `expected migration file to exist at ${sqlPath}`).toBe(true);

    const sql = fs.readFileSync(sqlPath, 'utf8');
    for (const column of REQUIRED_COLUMNS) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain('icra_assessments');
  });

  it('no new migration for this feature exists under the FROZEN legacy lineage (db/migrations/)', () => {
    // The frozen lineage is read-only archaeology per LINEAGE-FROZEN.md —
    // it must never gain new entries for active schema changes, since
    // nothing replays it against fresh or existing databases.
    const legacyFiles = fs.existsSync(FROZEN_LEGACY_DIR)
      ? fs.readdirSync(FROZEN_LEGACY_DIR)
      : [];
    const matchingLegacyFiles = legacyFiles.filter((f) =>
      /capability_token/i.test(f),
    );
    expect(
      matchingLegacyFiles,
      `found capability-token migration file(s) in the FROZEN legacy lineage, which has no ` +
        `guaranteed apply path: ${matchingLegacyFiles.join(', ')}. Use db/migrations-cache/ instead.`,
    ).toEqual([]);
  });

  it('the frozen-lineage freeze sentinel still exists (replay-refusal contract intact)', () => {
    const sentinel = path.join(FROZEN_LEGACY_DIR, '.lineage-frozen');
    expect(fs.existsSync(sentinel), `expected freeze sentinel at ${sentinel}`).toBe(true);
  });

  it('icra-schema.ts is part of the scoped Drizzle cache barrel (schema-cache/cache.ts), confirming ICRA is in-scope for db:bootstrap', () => {
    const barrel = fs.readFileSync(SCHEMA_CACHE_BARREL, 'utf8');
    expect(barrel).toMatch(/from ['"]\.\.\/schema\/icra-schema['"]/);
  });

  it('the Drizzle schema declares the same two capability columns the migration adds', () => {
    const schema = fs.readFileSync(ICRA_SCHEMA_FILE, 'utf8');
    expect(schema).toContain('capabilityTokenHash');
    expect(schema).toContain('capabilityTokenExpiresAt');
    expect(schema).toContain("varchar('capability_token_hash'");
  });

  it('the scoped migration is additive-only (ADD COLUMN / CREATE INDEX), never DROP or destructive DDL', () => {
    const sqlPath = path.join(SCOPED_MIGRATIONS_DIR, `${CAPABILITY_MIGRATION_TAG}.sql`);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements.length).toBeGreaterThan(0);
    for (const stmt of statements) {
      const normalized = stmt.toUpperCase();
      expect(normalized.startsWith('ALTER TABLE') || normalized.startsWith('CREATE INDEX')).toBe(
        true,
      );
      expect(normalized).not.toContain('DROP ');
      expect(normalized).not.toContain('TRUNCATE');
    }
  });
});
