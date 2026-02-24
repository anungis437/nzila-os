 
/**
 * Check Donations Table Structure
 *
 * NzilaOS-GATE: ADMIN-ONLY diagnostic script.
 * This script inspects information_schema metadata and does NOT access Org-scoped data.
 * Raw postgres is permitted here per PR-UE-01 allowlist.
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

async function main() {
const columns = await sql`
    SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'donations'
    ORDER BY ordinal_position
  `;
columns.forEach(_col => {
});
  
  await sql.end();
}

main();
