 
/**
 * NzilaOS-GATE: ADMIN-ONLY diagnostic script.
 * This script inspects information_schema metadata and does NOT access Org-scoped data.
 * Raw postgres is permitted here per PR-UE-01 allowlist.
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const sql = postgres(process.env.DATABASE_URL!, {ssl: 'require'});

(async () => { 
  const cols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'dues_transactions' 
    AND column_name LIKE '%amount%' 
    ORDER BY column_name
  `;
  void cols;
  await sql.end();
})();
