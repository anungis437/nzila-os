/**
 * GET POST /api/v2/governance/board-packets
 * Board packet management backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async () => {
    const rows = await db.select().from(boardPackets).orderBy(desc(boardPackets.createdAt)).limit(50);
    return { data: rows, total: rows.length };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body }) => {
    const [row] = await db.insert(boardPackets).values(body).returning();
    return { data: row };
  },
);
