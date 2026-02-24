 
/**
 * NzilaOS-GATE: ADMIN-ONLY diagnostic script.
 * This script inspects information_schema metadata and does NOT access Org-scoped data.
 * Raw postgres is permitted here per PR-UE-01 allowlist.
 */
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function check() {
  const _cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'stipend_disbursements' ORDER BY ordinal_position`;
await sql.end();
}

check();
