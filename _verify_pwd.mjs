import argon2 from 'argon2';
import postgres from 'postgres';

const sql = postgres('postgres://nzila:nzila_dev@localhost:5433/nzila_automation');
const rows = await sql`SELECT email, password_hash FROM user_management.users WHERE password_hash IS NOT NULL ORDER BY email`;
for (const r of rows) {
  const ok = await argon2.verify(r.password_hash, 'Test1234!');
  console.log(ok ? 'OK  ' : 'FAIL', r.email);
}
await sql.end();
