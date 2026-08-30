/**
 * Gate 13 Job Cancellation Governance — Migration Runner
 *
 * Regression correction for issue #713: creates the persistence tables
 * JobCancellationService has always assumed exist.
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
      path.join(__dirname, 'add-gate13-job-cancellation-tables.sql'),
      'utf-8'
    );

    await sql.unsafe(migrationSQL);

    // Verify tables
    const tables = [
      'ue_governance_job_execution_state',
      'ue_governance_job_cancellation_request',
      'ue_governance_job_cancellation_audit_event',
    ];
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
