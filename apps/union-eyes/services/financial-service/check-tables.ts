 
/**
 * Check Database Tables - Verify what tables exist
 *
 * NzilaOS-GATE: ADMIN-ONLY diagnostic script.
 * This script inspects information_schema metadata and does NOT access Org-scoped data.
 * Raw postgres is permitted here per PR-UE-01 allowlist.
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

async function checkTables() {
const tablesToCheck = [
    'dues_rules',
    'member_dues_assignments',
    'dues_transactions',
    'employer_remittances',
    'arrears',
    'strike_funds',
    'donations',
    'picket_tracking',
    'stipend_disbursements',
    'notification_queue',
    'notification_templates',
  ];

  for (const table of tablesToCheck) {
    try {
      const result = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        ) as exists
      `;
      
      const exists = result[0].exists;
if (exists) {
        // Check column count
        const _columns = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
          ORDER BY ordinal_position
        `;
}
    } catch (_error) {
}
  }

  await sql.end();
}

checkTables().catch(() => undefined);
