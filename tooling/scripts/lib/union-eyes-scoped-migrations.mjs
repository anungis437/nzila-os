/**
 * Union Eyes — shared scoped Drizzle migration executor.
 *
 * This is the SINGLE canonical implementation of "read the scoped
 * migration journal (db/migrations-cache/meta/_journal.json), hash each
 * migration file, apply any whose hash is not yet recorded in
 * drizzle.__drizzle_migrations, idempotently." Both the fresh-bootstrap
 * orchestrator (run-union-eyes-drizzle-bootstrap.mjs) and the
 * existing-environment rollout (apply-icra-capability-rollout.mjs, and
 * any future existing-environment rollout) MUST use this module rather
 * than re-implementing the DDL-application logic, per
 * docs/categories/platform-and-operations/architecture/orm-governance/
 * migration-execution-governance.md §1/§10 ("dual migration ownership",
 * "ambiguous migration execution" are explicit prohibitions).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function readJournalEntries(journalPath) {
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Scoped Drizzle journal missing at ${journalPath}.`);
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  return journal.entries ?? [];
}

export function computeMigrationHash(migrationsDir, tag) {
  const sqlPath = path.join(migrationsDir, `${tag}.sql`);
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Scoped migration file missing: ${sqlPath}`);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const hash = crypto.createHash('sha256').update(sql).digest('hex');
  return { sqlPath, sql, hash };
}

export async function ensureLedgerTable(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
}

export async function getAppliedHashes(client) {
  await ensureLedgerTable(client);
  const applied = await client.query('SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id');
  return new Set(applied.rows.map((r) => r.hash));
}

/**
 * Read-only status report: for every journal entry, whether its hash is
 * already recorded as applied. Never mutates the database.
 */
export async function getScopedMigrationStatus(client, { journalPath, migrationsDir }) {
  const entries = readJournalEntries(journalPath);
  const appliedHashes = await getAppliedHashes(client);
  return entries.map((entry) => {
    const { hash } = computeMigrationHash(migrationsDir, entry.tag);
    return { tag: entry.tag, hash, applied: appliedHashes.has(hash) };
  });
}

/**
 * Applies pending scoped migrations. Idempotent: entries whose hash is
 * already recorded are skipped.
 *
 * If `onlyTags` is provided, DDL is executed only for those tags — but
 * any journal entry preceding a requested tag that is NOT already
 * recorded as applied causes a refusal (never silently skips ahead of an
 * unrecorded prior migration). This is what makes a targeted apply (e.g.
 * "just apply 0005 to an existing environment") safe: it cannot replay
 * or silently bypass 0000-0004 depending on the ledger's actual state.
 */
export async function applyScopedMigrations(client, { journalPath, migrationsDir, onlyTags, log = () => {} }) {
  const entries = readJournalEntries(journalPath);
  const appliedHashes = await getAppliedHashes(client);

  if (entries.length === 0) {
    log('Scoped Drizzle root has zero entries — nothing to migrate.');
    return { applied: 0, appliedTags: [] };
  }

  const appliedTags = [];
  let count = 0;
  for (const entry of entries) {
    const { sql, hash } = computeMigrationHash(migrationsDir, entry.tag);
    const alreadyApplied = appliedHashes.has(hash);

    if (onlyTags && !onlyTags.includes(entry.tag)) {
      if (!alreadyApplied) {
        throw new Error(
          `Refusing targeted apply of [${onlyTags.join(', ')}]: preceding migration ` +
            `${entry.tag} is not yet recorded as applied in drizzle.__drizzle_migrations. ` +
            `Run the full scoped-migration executor (db:bootstrap) first, or apply in order.`,
        );
      }
      continue;
    }

    if (alreadyApplied) {
      log(`scoped migration already applied: ${entry.tag}`);
      continue;
    }

    log(`applying scoped migration: ${entry.tag}`);
    await client.query('BEGIN');
    try {
      const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await client.query(stmt);
      }
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when ?? Date.now()],
      );
      await client.query('COMMIT');
      count += 1;
      appliedTags.push(entry.tag);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Scoped migration ${entry.tag} failed: ${err.message}`);
    }
  }
  return { applied: count, appliedTags };
}

export async function verifyTagApplied(client, { journalPath, migrationsDir, tag }) {
  const status = await getScopedMigrationStatus(client, { journalPath, migrationsDir });
  const entry = status.find((s) => s.tag === tag);
  if (!entry) {
    throw new Error(`Tag ${tag} not found in scoped migration journal at ${journalPath}.`);
  }
  return entry;
}
