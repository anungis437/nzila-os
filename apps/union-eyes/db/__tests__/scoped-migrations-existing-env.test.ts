/**
 * Tests for the governed existing-environment full-chain scoped
 * migration executor CLI
 * (tooling/scripts/apply-union-eyes-scoped-migrations-existing-env.mjs)
 * introduced to remediate the trigger for production cutover run
 * 34907368480: the targeted ICRA rollout (0005 only) correctly refuses
 * to run ahead of an unrecorded 0000-0004, but no existing-environment
 * CLI could apply the FULL pending chain without going through the
 * broader bootstrap orchestrator (extensions/snapshot/QA baseline/
 * attestation). This CLI exposes the already-reviewed shared executor
 * (lib/union-eyes-scoped-migrations.mjs) through a narrow, fail-closed
 * interface with none of those side effects.
 *
 * Uses a fake pg-like client (no real Postgres needed) so these run in
 * ordinary CI without a database, mirroring
 * icra-capability-rollout.test.ts's pattern. The real migration SQL
 * files (read from disk) are used, so the fake client's parsing proves
 * behavior against the actual frozen journal/migrations.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const APP_ROOT = path.resolve(__dirname, '../..');
const JOURNAL_PATH = path.join(APP_ROOT, 'db', 'migrations-cache', 'meta', '_journal.json');
const MIGRATIONS_DIR = path.join(APP_ROOT, 'db', 'migrations-cache');
const CLI_PATH = path.join(REPO_ROOT, 'tooling/scripts/apply-union-eyes-scoped-migrations-existing-env.mjs');
const TARGET_TAG = '0005_add_icra_assessment_capability_token';

class FakeClient {
  ledgerTableExists = false;
  ledger = new Map();
  executedStatements = [];
  addedColumns = new Set();
  queryLog = [];
  failOnSubstring = null;

  async query(text, params) {
    const trimmed = String(text).trim();
    this.queryLog.push(trimmed);

    if (this.failOnSubstring && trimmed.includes(this.failOnSubstring)) {
      throw new Error('SIMULATED_FAILURE');
    }
    if (trimmed.startsWith("SELECT to_regclass('drizzle.__drizzle_migrations')")) {
      return { rows: [{ regclass: this.ledgerTableExists ? 'drizzle.__drizzle_migrations' : null }] };
    }
    if (trimmed.startsWith('CREATE SCHEMA') || /CREATE TABLE IF NOT EXISTS drizzle\.__drizzle_migrations/.test(trimmed)) {
      this.ledgerTableExists = true;
      return { rows: [] };
    }
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
    this.ledgerTableExists = true;
    this.ledger.set(hash, Date.now());
  }
}

async function loadCliModule() {
  return import(CLI_PATH);
}

async function loadSharedModule() {
  return import(path.join(REPO_ROOT, 'tooling/scripts/lib/union-eyes-scoped-migrations.mjs'));
}

describe('existing-environment scoped migration executor CLI', () => {
  describe('--check (read-only)', () => {
    it('with ledger absent, reports all journal entries pending and performs zero mutation', async () => {
      const { runCheck } = await loadCliModule();
      const client = new FakeClient();
      const result = await runCheck(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });

      expect(result.ledgerExists).toBe(false);
      expect(result.pending).toBe(result.total);
      expect(result.applied).toBe(0);
      expect(client.ledgerTableExists).toBe(false); // never created
      expect(client.executedStatements).toEqual([]);
      expect(client.ledger.size).toBe(0);
    });

    it('with a partial ledger, reports correct applied/pending counts', async () => {
      const { runCheck } = await loadCliModule();
      const { readJournalEntries, computeMigrationHash } = await loadSharedModule();
      const client = new FakeClient();
      const entries = readJournalEntries(JOURNAL_PATH);
      const halfway = Math.floor(entries.length / 2);
      for (const entry of entries.slice(0, halfway)) {
        const { hash } = computeMigrationHash(MIGRATIONS_DIR, entry.tag);
        client.markApplied(hash);
      }

      const result = await runCheck(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
      expect(result.applied).toBe(halfway);
      expect(result.pending).toBe(entries.length - halfway);
      expect(client.executedStatements).toEqual([]);
    });

    it('with a full ledger, reports all entries applied and zero pending', async () => {
      const { runCheck } = await loadCliModule();
      const { readJournalEntries, computeMigrationHash } = await loadSharedModule();
      const client = new FakeClient();
      const entries = readJournalEntries(JOURNAL_PATH);
      for (const entry of entries) {
        const { hash } = computeMigrationHash(MIGRATIONS_DIR, entry.tag);
        client.markApplied(hash);
      }

      const result = await runCheck(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
      expect(result.pending).toBe(0);
      expect(result.applied).toBe(entries.length);
    });

    it('never executes CREATE/ALTER/INSERT statements against the database', async () => {
      const { runCheck } = await loadCliModule();
      const client = new FakeClient();
      await runCheck(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });

      const mutatingQueries = client.queryLog.filter((q) =>
        /^\s*(CREATE TABLE(?! IF NOT EXISTS drizzle)|CREATE SCHEMA|ALTER TABLE|INSERT INTO(?! drizzle)|DROP|TRUNCATE)/i.test(q),
      );
      expect(mutatingQueries).toEqual([]);
      expect(client.ledgerTableExists).toBe(false);
    });
  });

  describe('--apply (reuses the canonical shared executor)', () => {
    it('applies 0000 through 0005 in journal order from an empty scoped state', async () => {
      const { runApply } = await loadCliModule();
      const client = new FakeClient();
      const result = await runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });

      expect(result.appliedCount).toBe(6);
      expect(result.appliedTags).toEqual([
        '0000_outstanding_viper',
        '0001_lean_iron_man',
        '0002_certain_juggernaut',
        '0003_dizzy_alex_wilder',
        '0004_hesitant_chameleon',
        TARGET_TAG,
      ]);
      expect(result.finalPending).toBe(0);
      expect(client.ledger.size).toBe(6);
    });

    it('is idempotent: a second invocation applies nothing new and ledger stays at 6 rows', async () => {
      const { runApply } = await loadCliModule();
      const client = new FakeClient();
      const first = await runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
      expect(first.appliedCount).toBe(6);

      const second = await runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
      expect(second.appliedCount).toBe(0);
      expect(second.appliedTags).toEqual([]);
      expect(client.ledger.size).toBe(6);
    });

    it('does not restrict via onlyTags — the underlying shared executor call applies the full chain', async () => {
      const cliSrc = fs.readFileSync(CLI_PATH, 'utf8');
      expect(cliSrc).not.toMatch(/onlyTags\s*:/);
    });

    it('a simulated failure in a later migration rolls back only that migration, leaves earlier committed migrations intact, and returns non-zero', async () => {
      const { runApply } = await loadCliModule();
      const client = new FakeClient();
      client.failOnSubstring = 'ue_governance_job_cancellation_audit_event'; // first statement of 0004

      await expect(
        runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR }),
      ).rejects.toThrow(/0004_hesitant_chameleon failed/);

      // 0000-0003 committed before the failure; 0004/0005 never recorded.
      expect(client.ledger.size).toBe(4);
      const { computeMigrationHash } = await loadSharedModule();
      const hash0004 = computeMigrationHash(MIGRATIONS_DIR, '0004_hesitant_chameleon').hash;
      const hash0005 = computeMigrationHash(MIGRATIONS_DIR, TARGET_TAG).hash;
      expect(client.ledger.has(hash0004)).toBe(false);
      expect(client.ledger.has(hash0005)).toBe(false);
    });

    it('post-apply verification fails closed if a journal entry remains pending after applyScopedMigrations returns', async () => {
      const { runApply } = await loadCliModule();
      const { readJournalEntries, computeMigrationHash } = await loadSharedModule();
      const client = new FakeClient();
      // Pre-mark everything except the target tag applied, then intercept
      // the shared executor's own apply of the target tag so it silently
      // no-ops (simulating a hypothetical shared-executor regression) —
      // proves this CLI's own postcondition check is a real, independent
      // safety net rather than blind trust in the shared executor's return value.
      const entries = readJournalEntries(JOURNAL_PATH);
      for (const entry of entries) {
        if (entry.tag === TARGET_TAG) continue;
        const { hash } = computeMigrationHash(MIGRATIONS_DIR, entry.tag);
        client.markApplied(hash);
      }
      const originalQuery = client.query.bind(client);
      client.query = async (text, params) => {
        if (String(text).trim().startsWith('INSERT INTO drizzle.__drizzle_migrations')) {
          return { rows: [] }; // swallow the ledger insert without recording it
        }
        return originalQuery(text, params);
      };

      await expect(
        runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR }),
      ).rejects.toThrow(/still pending after apply/);
    });
  });

  describe('ICRA compatibility after full-chain apply', () => {
    it('establishes exactly the state the targeted ICRA check verifies as GO', async () => {
      const { runApply } = await loadCliModule();
      const { runCheck: icraRunCheck } = await import(
        path.join(REPO_ROOT, 'tooling/scripts/apply-icra-capability-rollout.mjs')
      );
      const client = new FakeClient();
      await runApply(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });

      const icraResult = await icraRunCheck(client, { journalPath: JOURNAL_PATH, migrationsDir: MIGRATIONS_DIR });
      expect(icraResult.targetEntry.applied).toBe(true);
      expect(client.addedColumns.has('capability_token_hash')).toBe(true);
      expect(client.addedColumns.has('capability_token_expires_at')).toBe(true);
      expect(icraResult.verdict).toBe('GO');
    });
  });

  describe('authority and scope boundaries', () => {
    it('imports only the shared scoped-migration executor and pg/dotenv/node builtins — no bootstrap, snapshot, RLS, or role-provisioning modules', () => {
      const cliSrc = fs.readFileSync(CLI_PATH, 'utf8');
      const importLines = cliSrc.match(/^import .+$/gm) ?? [];
      const forbiddenModules = [
        'run-union-eyes-drizzle-bootstrap',
        'restore-union-eyes-snapshot',
        'apply-rls-foundation-migration',
        'provision-runtime-db-roles',
      ];
      for (const line of importLines) {
        for (const forbidden of forbiddenModules) {
          expect(line).not.toContain(forbidden);
        }
      }
      expect(cliSrc).not.toMatch(/spawnSync|spawn\(|execFileSync|child_process/);
      expect(cliSrc).not.toMatch(/CREATE EXTENSION/);
      expect(cliSrc).not.toMatch(/bootstrap_attestations/);
      expect(cliSrc).not.toMatch(/UE_LINEAGE_REPLAY_OVERRIDE/);
      expect(cliSrc).toContain("from './lib/union-eyes-scoped-migrations.mjs'");
    });

    it('never logs the admin database connection string or credential value', () => {
      const cliSrc = fs.readFileSync(CLI_PATH, 'utf8');
      const consoleCalls = cliSrc.match(/console\.(log|error)\([^)]*\)/g) ?? [];
      for (const call of consoleCalls) {
        expect(call).not.toMatch(/adminUrl/);
      }
    });

    it('fails closed with a non-zero exit and no DB connection attempt when neither admin URL env var is set', () => {
      const env = { ...process.env };
      delete env.RLS_MIGRATION_ADMIN_DATABASE_URL;
      delete env.ADMIN_DATABASE_URL;
      delete env.DATABASE_URL;
      const result = spawnSync(process.execPath, [CLI_PATH, '--check'], { env, encoding: 'utf8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/Refusing \(fail closed\)/);
    });

    it('fails closed with a non-zero exit and prints usage when no mode flag is supplied', () => {
      const result = spawnSync(process.execPath, [CLI_PATH], { env: process.env, encoding: 'utf8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/Usage:/);
    });
  });
});
