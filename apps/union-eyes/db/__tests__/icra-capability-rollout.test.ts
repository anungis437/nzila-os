/**
 * Tests for the deterministic existing-environment ICRA capability
 * migration rollout gate (tooling/scripts/apply-icra-capability-rollout.mjs)
 * and the shared scoped-migration executor it (and fresh bootstrap) both
 * use (tooling/scripts/lib/union-eyes-scoped-migrations.mjs).
 *
 * Uses a fake pg-like client (no real Postgres needed) so these run in
 * ordinary CI without a database. The migration SQL files themselves are
 * real (read from disk), so the fake client's ALTER TABLE parsing proves
 * the actual 0005 migration adds the expected columns.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_ROOT = path.resolve(__dirname, '../..');
const JOURNAL_PATH = path.join(APP_ROOT, 'db', 'migrations-cache', 'meta', '_journal.json');
const MIGRATIONS_DIR = path.join(APP_ROOT, 'db', 'migrations-cache');
const TARGET_TAG = '0005_add_icra_assessment_capability_token';

class FakeClient {
  ledger = new Map();
  executedStatements = [];
  addedColumns = new Set();

  async query(text, params) {
    const trimmed = String(text).trim();
    if (trimmed.startsWith('CREATE SCHEMA') || trimmed.startsWith('CREATE TABLE')) return { rows: [] };
    if (trimmed.startsWith('SELECT hash FROM drizzle.__drizzle_migrations')) {
      return { rows: Array.from(this.ledger.keys()).map((hash) => ({ hash })) };
    }
    if (trimmed.startsWith('SELECT column_name FROM information_schema.columns')) {
      const requested = params?.[0] ?? [];
      return { rows: requested.filter((c) => this.addedColumns.has(c)).map((column_name) => ({ column_name })) };
    }
    if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') return { rows: [] };
    if (trimmed.startsWith('INSERT INTO drizzle.__drizzle_migrations')) {
      const [hash, createdAt] = params;
      this.ledger.set(hash, createdAt);
      return { rows: [] };
    }
    if (/^ALTER TABLE/i.test(trimmed)) {
      const m = trimmed.match(/ADD COLUMN\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i);
      if (m) this.addedColumns.add(m[1]);
    }
    this.executedStatements.push(trimmed);
    return { rows: [] };
  }

  markApplied(hash) {
    this.ledger.set(hash, Date.now());
  }
}

async function loadSharedModule() {
  return import(path.join(REPO_ROOT, 'tooling/scripts/lib/union-eyes-scoped-migrations.mjs'));
}

async function loadRolloutModule() {
  return import(path.join(REPO_ROOT, 'tooling/scripts/apply-icra-capability-rollout.mjs'));
}

describe('ICRA capability migration rollout gate', () => {
  it('fresh bootstrap (empty ledger, no onlyTags) applies all entries in order, including the target tag, and adds both real columns', async () => {
    const { applyScopedMigrations, computeMigrationHash } = await loadSharedModule();
    const client = new FakeClient();
    const result = await applyScopedMigrations(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });

    expect(result.appliedTags).toContain(TARGET_TAG);
    expect(client.addedColumns.has('capability_token_hash')).toBe(true);
    expect(client.addedColumns.has('capability_token_expires_at')).toBe(true);

    const { hash } = computeMigrationHash(MIGRATIONS_DIR, TARGET_TAG);
    expect(client.ledger.has(hash)).toBe(true);
  });

  it('runCheck reports NO_GO when the target tag is not yet applied', async () => {
    const { runCheck } = await loadRolloutModule();
    const client = new FakeClient();
    const result = await runCheck(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
    expect(result.targetEntry.applied).toBe(false);
    expect(result.verdict).toBe('NO_GO');
  });

  it('runCheck reports NO_GO if the tag is recorded applied but a required column is somehow still absent', async () => {
    const { computeMigrationHash } = await loadSharedModule();
    const { runCheck } = await loadRolloutModule();
    const client = new FakeClient();
    const { hash } = computeMigrationHash(MIGRATIONS_DIR, TARGET_TAG);
    client.markApplied(hash); // ledger says applied, but addedColumns is still empty
    const result = await runCheck(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
    expect(result.targetEntry.applied).toBe(true);
    expect(result.columns.capability_token_hash).toBe(false);
    expect(result.verdict).toBe('NO_GO');
  });

  it('runApply refuses a targeted apply of 0005 if an earlier journal entry is not yet recorded as applied', async () => {
    const { runApply } = await loadRolloutModule();
    const client = new FakeClient(); // empty ledger — 0000-0004 not recorded
    await expect(
      runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR }),
    ).rejects.toThrow(/preceding migration/);
  });

  it('runApply applies only the target tag when all preceding entries are already recorded, and verifies GO afterward', async () => {
    const { readJournalEntries, computeMigrationHash } = await loadSharedModule();
    const { runApply, TARGET_TAG: exportedTag } = await loadRolloutModule();
    expect(exportedTag).toBe(TARGET_TAG);

    const client = new FakeClient();
    const entries = readJournalEntries(JOURNAL_PATH);
    for (const entry of entries) {
      if (entry.tag === TARGET_TAG) continue;
      const { hash } = computeMigrationHash(MIGRATIONS_DIR, entry.tag);
      client.markApplied(hash);
    }

    const result = await runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
    expect(result.appliedTags).toEqual([TARGET_TAG]);
    expect(result.verification.verdict).toBe('GO');
  });

  it('re-running the apply is idempotent: the second run applies nothing new and executes no additional ALTER/CREATE INDEX statements', async () => {
    const { readJournalEntries, computeMigrationHash } = await loadSharedModule();
    const { runApply } = await loadRolloutModule();
    const client = new FakeClient();
    const entries = readJournalEntries(JOURNAL_PATH);
    for (const entry of entries) {
      if (entry.tag === TARGET_TAG) continue;
      const { hash } = computeMigrationHash(MIGRATIONS_DIR, entry.tag);
      client.markApplied(hash);
    }

    const first = await runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
    expect(first.appliedTags).toEqual([TARGET_TAG]);
    const statementCountAfterFirst = client.executedStatements.length;

    const second = await runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
    expect(second.appliedTags).toEqual([]); // nothing new applied
    expect(client.executedStatements.length).toBe(statementCountAfterFirst); // no new DDL executed
    expect(second.verification.verdict).toBe('GO');
  });

  it('applied evidence includes the migration tag and its SHA-256 hash (not just a boolean)', async () => {
    const { computeMigrationHash } = await loadSharedModule();
    const { runCheck } = await loadRolloutModule();
    const { hash: expectedHash } = computeMigrationHash(MIGRATIONS_DIR, TARGET_TAG);

    const client = new FakeClient();
    client.markApplied(expectedHash);
    client.addedColumns.add('capability_token_hash');
    client.addedColumns.add('capability_token_expires_at');
    const result = await runCheck(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
    expect(result.targetEntry.tag).toBe(TARGET_TAG);
    expect(result.targetEntry.hash).toBe(expectedHash);
    expect(result.verdict).toBe('GO');
  });

  it('the fresh-bootstrap orchestrator and the existing-environment rollout both delegate to the SAME shared executor (no hand-written duplicate DDL-application logic)', () => {
    const bootstrapSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs'),
      'utf8',
    );
    const rolloutSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'tooling/scripts/apply-icra-capability-rollout.mjs'),
      'utf8',
    );
    expect(bootstrapSrc).toContain("from './lib/union-eyes-scoped-migrations.mjs'");
    expect(rolloutSrc).toContain("from './lib/union-eyes-scoped-migrations.mjs'");
    // Neither file should contain its own INSERT into the scoped-migration
    // ledger table — that DDL-application/ledger-write logic lives only in
    // lib/union-eyes-scoped-migrations.mjs, never duplicated locally.
    expect(bootstrapSrc).not.toMatch(/INSERT INTO drizzle\.__drizzle_migrations/);
    expect(rolloutSrc).not.toMatch(/INSERT INTO drizzle\.__drizzle_migrations/);
  });
});
