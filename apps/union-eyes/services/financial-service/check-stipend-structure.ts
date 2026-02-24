 
/**
 * NzilaOS-GATE: ADMIN-ONLY diagnostic script.
 * This script inspects information_schema metadata and does NOT access Org-scoped data.
 * Raw postgres is permitted here per PR-UE-01 allowlist.
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 1,
});

async function checkStipendTable() {
  try {
    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'stipend_disbursements'
      );
    `;
    
    if (!tableCheck[0].exists) {
return;
    }
// Get all columns with their data types
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'stipend_disbursements'
      ORDER BY ordinal_position;
    `;
columns.forEach(_col => {
});
    
    // Check specifically for amount-related columns
    const amountColumns = columns.filter(col => 
      col.column_name.includes('amount')
    );
amountColumns.forEach(_col => {
});
    
  } catch (_error) {
} finally {
    await sql.end();
  }
}

checkStipendTable();
