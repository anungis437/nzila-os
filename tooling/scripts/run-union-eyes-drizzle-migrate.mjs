import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

    const drizzleMigrator = await import('drizzle-orm/migrator');
    const entries = drizzleMigrator.readMigrationFiles({ migrationsFolder });

    await client.query('BEGIN');
    for (const entry of entries) {
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [entry.hash, entry.folderMillis],
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
    if (error instanceof Error) {
      console.error(error.message);
      const cause = (error).cause;
      if (cause) {
        console.error('Cause:', cause);
      }
    } else {
      console.error(String(error));
    }
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
    await migrate(db, { migrationsFolder });
    console.log('Drizzle migrations are up to date.');
  } catch (error) {
    console.error('Failed to run Drizzle migrations.');
    if (error instanceof Error) {
      console.error(error.message);
      const cause = (error).cause;
      if (cause) {
        console.error('Cause:', cause);
      }
    } else {
      console.error(String(error));
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

await ensureBaseline();
await runMigrations();
