/**
 * Add Missing Tables Migration
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
process.exit(1);
}
const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

async function main() {
  try {
const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'add-missing-tables.sql'),
      'utf-8'
    );
    
    await sql.unsafe(migrationSQL);
// Verify tables
    const tables = ['donations', 'picket_tracking', 'arrears'];
    for (const table of tables) {
      const _result = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        ) as exists
      `;
}
    
  } catch (_error) {
process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
