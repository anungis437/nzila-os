/**
 * GET PATCH DELETE /api/v2/governance/board-packets/[id]
 * Single board packet operations backed by PostgreSQL.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ params }) => {
    const [row] = await db.select().from(boardPackets).where(eq(boardPackets.id, params.id));
    if (!row) throw ApiError.notFound('Board packet not found');
    return { data: row };
  },
);

export const PATCH = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ params, body }) => {
    const [row] = await db.update(boardPackets).set({ ...(body as Record<string, unknown>), updatedAt: new Date() }).where(eq(boardPackets.id, params.id)).returning();
    if (!row) throw ApiError.notFound('Board packet not found');
    return { data: row };
  },
);

export const DELETE = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ params }) => {
    const [row] = await db.update(boardPackets).set({ status: 'archived', updatedAt: new Date() }).where(eq(boardPackets.id, params.id)).returning();
    if (!row) throw ApiError.notFound('Board packet not found');
    return { data: row };
  },
);
