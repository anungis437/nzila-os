import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const appRoot = path.join(repoRoot, 'apps', 'union-eyes');

loadEnv({ path: path.join(appRoot, '.env.local') });

if (!process.env.DATABASE_URL) {
  loadEnv({ path: path.join(appRoot, '.env') });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const migrationsFolder = path.join(appRoot, 'db', 'migrations');
const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');

function readJournalEntries() {
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  return journal.entries.map((entry) => {
    const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    return {
      when: entry.when,
      hash: crypto.createHash('sha256').update(sql).digest('hex'),
    };
  });
}

async function ensureBaseline() {
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const existingJournal = await client.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations');
    if (existingJournal.rows[0]?.count > 0) {
      return;
    }

    const existingTables = await client.query(`
      SELECT count(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> '__drizzle_migrations'
    `);

    if (existingTables.rows[0]?.count === 0) {
      return;
    }

    const entries = readJournalEntries();
    await client.query('BEGIN');
    for (const entry of entries) {
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [entry.hash, entry.when],
      );
    }
    await client.query('COMMIT');
    console.log(`Baselined Drizzle migrations journal with ${entries.length} entries for existing database schema.`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // no-op
    }
    console.error('Failed to prepare Drizzle migration baseline.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await client.end();
  }
}

/**
 * Transform DO $$ blocks so FK additions are fault-tolerant.
 *
 * Migration 0001 adds FK constraints referencing the `organizations` table,
 * which is only created in migration 0002. On a fresh database this causes
 * an `undefined_table` error that Drizzle's default `EXCEPTION WHEN
 * duplicate_object` handler does not catch, aborting the entire migration
 * sequence. We widen the catch to `WHEN OTHERS` at execution time while
 * preserving the original SQL content for hash comparison so that existing
 * databases whose `__drizzle_migrations` table already records the original
 * hash are not affected.
 *
 * A separate fixup migration (20260507_fixup_phase5b_org_fks.sql) re-adds
 * these constraints after `organizations` is created by migration 0002.
 */
function faultTolerantSql(sql) {
  // Fix malformed "DO DROP TYPE" statements — artifact of repeated migration block generation
  // in 0008_lean_mother_askani.sql where sections start with "DO DROP TYPE" instead of "DROP TYPE"
  sql = sql.replace(/\bDO DROP TYPE\b/g, 'DROP TYPE');
  // Replace EXCEPTION WHEN duplicate_object in ADD CONSTRAINT DO blocks only
  return sql.replace(
    /(DO \$\$ BEGIN[\s\S]*?ADD CONSTRAINT[\s\S]*?EXCEPTION\s*\n\s*)WHEN duplicate_object THEN null;(\s*\nEND \$\$;)/g,
    '$1WHEN OTHERS THEN null;$2',
  )
}

async function runMigrations() {
  // Use a custom statement-level runner so we can apply faultTolerantSql()
  // at execution time while hashing the *original* SQL for migration tracking.
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const { rows: appliedRows } = await client.query(
      'SELECT hash FROM drizzle.__drizzle_migrations',
    );
    const appliedHashes = new Set(appliedRows.map((r) => r.hash));

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

    let applied = 0;
    for (const entry of entries) {
      const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`);
      const originalSql = fs.readFileSync(migrationPath, 'utf8');
      const hash = crypto.createHash('sha256').update(originalSql).digest('hex');

      if (appliedHashes.has(hash)) continue;

      const execSql = faultTolerantSql(originalSql);
      const statements = execSql.split('--> statement-breakpoint');

      await client.query('BEGIN');
      let stmtIndex = 0;
      try {
        for (const stmt of statements) {
          const trimmed = stmt.trim();
          if (trimmed) {
            stmtIndex++;
            await client.query(trimmed);
          }
        }
        await client.query(
          'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
          [hash, entry.when],
        );
        await client.query('COMMIT');
        applied++;
      } catch (stmtError) {
        await client.query('ROLLBACK');
        console.error(`Migration failed: ${entry.tag} (statement #${stmtIndex})`);
        throw stmtError;
      }
    }

    console.log(
      applied > 0
        ? `Applied ${applied} migration(s). Drizzle migrations are up to date.`
        : 'Drizzle migrations are up to date.',
    );
  } catch (error) {
    console.error('Failed to run Drizzle migrations.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await client.end();
  }
}

await ensureBaseline();
await runMigrations();