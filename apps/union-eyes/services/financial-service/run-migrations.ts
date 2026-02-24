/**
 * Migration Runner - Execute all missing database migrations
 * Connects to Azure PostgreSQL and creates all required tables
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
const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 1,
});

async function runMigration(filePath: string, _fileName: string) {
  try {
const migrationSQL = fs.readFileSync(filePath, 'utf-8');
    
    await sql.unsafe(migrationSQL);
return true;
  } catch (_error) {
return false;
  }
}

async function main() {
const migrationsDir = path.join(__dirname, '../../database/migrations');
  
  const migrations = [
    '013_dues_management_adapted.sql',
    '014_strike_fund_adapted.sql',
    '015_notification_system.sql',
  ];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration);
    
    if (!fs.existsSync(filePath)) {
continue;
    }

    const success = await runMigration(filePath, migration);
    if (success) {
      _successCount++;
    } else {
      failCount++;
    }
  }
await sql.end();
  
  if (failCount > 0) {
process.exit(1);
  } else {
process.exit(0);
  }
}

main().catch((_error) => {
process.exit(1);
});
