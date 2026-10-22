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
import { assertJournalPrefix } from './union-eyes-migration-ledger.mjs';

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

/** The scoped journal as the trusted history the ledger is checked against. */
export function scopedLedgerJournal({ journalPath, migrationsDir }) {
  return {
    name: 'scoped',
    entries: readJournalEntries(journalPath).map((entry) => ({
      tag: entry.tag,
      hash: computeMigrationHash(migrationsDir, entry.tag).hash,
    })),
  };
}

export async function getAppliedHashes(client, stagingLineageContext) {
  if (stagingLineageContext) {
    const { validateRecoveryContext } = await import('./ue-staging-historical-lineage.mjs');
    return (await validateRecoveryContext(client, stagingLineageContext)).appliedHashes;
  }
  await ensureLedgerTable(client);
  const applied = await client.query('SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id');
  return new Set(applied.rows.map((r) => r.hash));
}

/**
 * Read-only status report: for every journal entry, whether its hash is
 * already recorded as applied. Never mutates the database.
 */
export async function getScopedMigrationStatus(client, { journalPath, migrationsDir, stagingLineageContext }) {
  const entries = readJournalEntries(journalPath);
  const appliedHashes = await getAppliedHashes(client, stagingLineageContext);
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
 *
 * `throughTag` applies the journal from the start and stops at that tag,
 * inclusive. Later tags stay unapplied. `afterTag` refuses unless every
 * tag through that boundary is already recorded, then applies the rest.
 * Already-recorded hashes are skipped and are not executed again.
 * `onlyTags` cannot be combined with either boundary.
 */
export async function applyScopedMigrations(client, { journalPath, migrationsDir, onlyTags, throughTag, afterTag, stagingLineageContext, log = () => {} }) {
  if (onlyTags && (throughTag || afterTag)) {
    throw new Error('onlyTags cannot be combined with throughTag or afterTag.');
  }
  if (throughTag && afterTag) {
    throw new Error('throughTag and afterTag are separate passes.');
  }

  const entries = readJournalEntries(journalPath);
  const appliedHashes = await getAppliedHashes(client, stagingLineageContext);
  await assertJournalPrefix(client, scopedLedgerJournal({ journalPath, migrationsDir }), { stagingLineageContext });

  if (entries.length === 0) {
    log('Scoped Drizzle root has zero entries — nothing to migrate.');
    return { applied: 0, appliedTags: [] };
  }
  if (throughTag && !entries.some((entry) => entry.tag === throughTag)) {
    throw new Error(`throughTag ${throughTag} is not in the scoped migration journal.`);
  }
  if (afterTag && !entries.some((entry) => entry.tag === afterTag)) {
    throw new Error(`afterTag ${afterTag} is not in the scoped migration journal.`);
  }

  const appliedTags = [];
  let count = 0;
  let passedAfterBoundary = !afterTag;
  let reachedThroughTag = !throughTag;
  for (const entry of entries) {
    const { sql, hash } = computeMigrationHash(migrationsDir, entry.tag);
    const alreadyApplied = appliedHashes.has(hash);

    if (afterTag && !passedAfterBoundary) {
      if (!alreadyApplied) {
        throw new Error(
          `Refusing scoped apply after ${afterTag}: preceding migration ${entry.tag} is not yet recorded as applied.`,
        );
      }
      if (entry.tag === afterTag) passedAfterBoundary = true;
      continue;
    }

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
      if (throughTag && entry.tag === throughTag) {
        reachedThroughTag = true;
        break;
      }
      continue;
    }

    log(`applying scoped migration: ${entry.tag}`);
    await client.query('BEGIN');
    try {
      const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
      for (const [index, stmt] of statements.entries()) {
        if (stagingLineageContext && entry.tag === '0017_snapshot_authority_reconciliation' && index === 5) {
          const { executeOwnershipHandoff } = await import('./ue-staging-0017-ownership.mjs');
          await executeOwnershipHandoff(client, { context: stagingLineageContext, tag: entry.tag, sourceHash: hash, statement: stmt, index });
        } else {
          await client.query(stmt);
        }
      }
      if (entry.tag === '0009_baseline_runtime_role_grants') {
        // The file hash stays the historical bytes. The revoke runs in this
        // same transaction, so a concurrent session never observes the
        // broad 0009 envelope. Already-applied databases do not re-enter
        // this branch and are not revoked here.
        await client.query(
          'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system, PUBLIC',
        );
        await client.query(
          'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system, PUBLIC',
        );
      }
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when ?? Date.now()],
      );
      await client.query('COMMIT');
      count += 1;
      appliedTags.push(entry.tag);
      appliedHashes.add(hash);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Scoped migration ${entry.tag} failed: ${err.message}`);
    }

    if (throughTag && entry.tag === throughTag) {
      reachedThroughTag = true;
      break;
    }
  }
  if (!reachedThroughTag) {
    throw new Error(`Scoped apply stopped before throughTag ${throughTag}.`);
  }
  if (!passedAfterBoundary) {
    throw new Error(`Scoped apply did not reach afterTag ${afterTag}.`);
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

/**
 * Stamp journal hashes into drizzle.__drizzle_migrations WITHOUT executing DDL.
 * Used after a canonical snapshot restore whose schema already includes the
 * objects those migrations would create (ledger often absent from pg_dump).
 * Only stamps tags in `throughTags` when provided; otherwise stamps all entries.
 * Idempotent: existing hashes are left untouched.
 */
export async function baselineScopedMigrations(client, { journalPath, migrationsDir, throughTags, log = () => {} }) {
  const entries = readJournalEntries(journalPath);
  const appliedHashes = await getAppliedHashes(client);
  await assertJournalPrefix(client, scopedLedgerJournal({ journalPath, migrationsDir }));
  let stamped = 0;
  const stampedTags = [];
  await client.query('BEGIN');
  try {
    for (const entry of entries) {
      if (throughTags && !throughTags.includes(entry.tag)) {
        continue;
      }
      const { hash } = computeMigrationHash(migrationsDir, entry.tag);
      if (appliedHashes.has(hash)) {
        continue;
      }
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when ?? Date.now()],
      );
      appliedHashes.add(hash);
      stamped += 1;
      stampedTags.push(entry.tag);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Scoped migration baseline failed: ${err.message}`);
  }
  log(`scoped migration baseline: stamped ${stamped} hash(es)`);
  return { stamped, stampedTags };
}

/**
 * Canonical PostgreSQL extension set for a Union Eyes database. This is the
 * SINGLE source of truth reused by both the fresh-bootstrap orchestrator and
 * the schema-contract fresh-build harness, so extension provisioning cannot
 * diverge between the production bootstrap and the measuring instrument.
 */
export const REQUIRED_EXTENSIONS = ['uuid-ossp', 'pgcrypto', 'pg_trgm', 'btree_gin', 'vector'];
export const OPTIONAL_EXTENSIONS = new Set(['vector']);

/**
 * Installs the required extensions idempotently. Throws on hard failure of a
 * non-optional extension; skips optional extensions that are unavailable.
 * Callers that must exit the process (bootstrap) wrap this in their own
 * fail() handler; callers that must propagate (harness) let it throw.
 */
export async function ensureExtensions(client, { log = () => {} } = {}) {
  for (const ext of REQUIRED_EXTENSIONS) {
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
      log(`extension OK: ${ext}`);
    } catch (err) {
      if (OPTIONAL_EXTENSIONS.has(ext)) {
        log(`extension optional/unavailable: ${ext} (${err.message})`);
        continue;
      }
      throw new Error(`Failed to create extension ${ext}: ${err.message}`);
    }
  }
}
