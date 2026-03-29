const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  user: 'nzila',
  password: 'nzila_dev',
  database: 'nzila_automation'
});

async function test() {
  const userId = 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV';
  const claimId = 'd1c8c342-cb07-40d1-afd5-ef4477e4b976';
  const orgId = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
  
  // Test 1: With org filter
  const r1 = await pool.query(
    'SELECT c.claim_id AS "claimId", c.claim_number AS "claimNumber" FROM claims c WHERE (c.claim_number = $1 OR c.claim_id::text = $1) AND c.organization_id = $2::uuid LIMIT 1',
    [claimId, orgId]
  );
  console.log('Test 1 (org filter):', r1.rows.length, 'rows', JSON.stringify(r1.rows[0] || 'NONE'));

  // Test 2: With owner fallback
  const r2 = await pool.query(
    'SELECT c.claim_id AS "claimId", c.claim_number AS "claimNumber" FROM claims c WHERE (c.claim_number = $1 OR c.claim_id::text = $1) AND c.member_id = $2 LIMIT 1',
    [claimId, userId]
  );
  console.log('Test 2 (owner fallback):', r2.rows.length, 'rows', JSON.stringify(r2.rows[0] || 'NONE'));

  // Test 3: Membership lookup
  const r3 = await pool.query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  console.log('Test 3 (membership):', JSON.stringify(r3.rows[0] || 'NONE'));

  await pool.end();
}
test().catch(e => { console.error(e); process.exit(1); });
