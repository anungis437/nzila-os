import { db } from './db/db';
import { reports } from './db/schema';
import { desc, count } from 'drizzle-orm';

async function main() {
  try {
    console.log('Testing reports query...');
    const rows = await db.select().from(reports).orderBy(desc(reports.createdAt)).limit(50).offset(0);
    console.log('ROWS:', JSON.stringify(rows));
    const [total] = await db.select({ total: count() }).from(reports);
    console.log('TOTAL:', total);
    console.log('SUCCESS');
  } catch (err) {
    console.error('ERROR:', err);
  }
  process.exit(0);
}
main();
