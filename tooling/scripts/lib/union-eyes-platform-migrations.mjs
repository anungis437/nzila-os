/**
 * Union Eyes - shared post-freeze PLATFORM_SQL migration executor.
 *
 * Reads apps/union-eyes/db/migrations-platform/meta/_journal.json, hashes each
 * migration file, and applies any whose hash is not yet recorded in
 * drizzle.__drizzle_migrations, idempotently. Used by fresh bootstrap after
 * scoped migrations. Does NOT touch the frozen legacy lineage under
 * apps/union-eyes/db/migrations/.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function readJournalEntries(journalPath) {
  if (!fs.existsSync(journalPath)) {
    throw new Error(`PLATFORM_SQL journal missing at ${journalPath}.`);
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  return journal.entries ?? [];
}

export function computeMigrationHash(migrationsDir, tag) {
  const sqlPath = path.join(migrationsDir, `${tag}.sql`);
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Platform migration file missing: ${sqlPath}`);
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
export async function getPlatformMigrationStatus(client, { journalPath, migrationsDir }) {
  const entries = readJournalEntries(journalPath);
  const appliedHashes = await getAppliedHashes(client);
  return entries.map((entry) => {
    const { hash } = computeMigrationHash(migrationsDir, entry.tag);
    return { tag: entry.tag, hash, applied: appliedHashes.has(hash) };
  });
}

/**
 * Applies pending platform migrations. Idempotent: entries whose hash is
 * already recorded are skipped.
 *
 * If `onlyTags` is provided, DDL is executed only for those tags — but
 * any journal entry preceding a requested tag that is NOT already
 * recorded as applied causes a refusal (never silently skips ahead of an
 * unrecorded prior migration). This is what makes a targeted apply (e.g.
 * "just apply 0005 to an existing environment") safe: it cannot replay
 * or silently bypass 0000-0004 depending on the ledger's actual state.
 */
export async function applyPlatformMigrations(client, { journalPath, migrationsDir, onlyTags, log = () => {} }) {
  const entries = readJournalEntries(journalPath);
  const appliedHashes = await getAppliedHashes(client);

  if (entries.length === 0) {
    log('PLATFORM_SQL root has zero entries — nothing to migrate.');
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
      log(`platform migration already applied: ${entry.tag}`);
      continue;
    }

    log(`applying platform migration: ${entry.tag}`);
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
      throw new Error(`Platform migration ${entry.tag} failed: ${err.message}`);
    }
  }
  return { applied: count, appliedTags };
}

export async function verifyTagApplied(client, { journalPath, migrationsDir, tag }) {
  const status = await getPlatformMigrationStatus(client, { journalPath, migrationsDir });
  const entry = status.find((s) => s.tag === tag);
  if (!entry) {
    throw new Error(`Tag ${tag} not found in platform migration journal at ${journalPath}.`);
  }
  return entry;
}

/**
 * Stamp PLATFORM_SQL journal hashes without executing DDL (post-snapshot).
 * Shares drizzle.__drizzle_migrations with scoped migrations.
 */
export async function baselinePlatformMigrations(client, { journalPath, migrationsDir, throughTags, log = () => {} }) {
  const entries = readJournalEntries(journalPath);
  const appliedHashes = await getAppliedHashes(client);
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
    throw new Error(`Platform migration baseline failed: ${err.message}`);
  }
  log(`platform migration baseline: stamped ${stamped} hash(es)`);
  return { stamped, stampedTags };
}
