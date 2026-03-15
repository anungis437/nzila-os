/**
 * GET POST /api/v2/governance/elections/sessions
 * Voting session management backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votingSessions } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async () => {
    const rows = await db.select().from(votingSessions).orderBy(desc(votingSessions.createdAt)).limit(50);
    return { data: rows, total: rows.length };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body }) => {
    const [row] = await db.insert(votingSessions).values(body).returning();
    return { data: row };
  },
);
