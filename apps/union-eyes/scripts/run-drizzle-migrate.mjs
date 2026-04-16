import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const appRoot = process.cwd();
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
      tag: entry.tag,
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

async function runMigrations() {
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: './db/migrations' });
    console.log('Drizzle migrations are up to date.');
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