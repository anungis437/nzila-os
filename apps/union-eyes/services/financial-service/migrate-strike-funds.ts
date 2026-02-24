/**
 * Migration script to add missing columns to strike_funds table
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL || '');

async function migrate() {
  try {
// Add is_active column
    await sql`
      ALTER TABLE strike_funds 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
    `;
// Add target_amount column
    await sql`
      ALTER TABLE strike_funds 
      ADD COLUMN IF NOT EXISTS target_amount NUMERIC(12, 2)
    `;
// Add created_by column
    await sql`
      ALTER TABLE strike_funds 
      ADD COLUMN IF NOT EXISTS created_by TEXT
    `;
// Create index for is_active
    await sql`
      CREATE INDEX IF NOT EXISTS strike_funds_active_idx ON strike_funds(is_active)
    `;
} catch (_error) {
process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
