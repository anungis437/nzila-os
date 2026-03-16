/**
 * GET PATCH DELETE /api/v2/governance/elections/sessions/[id]
 * Single voting session operations backed by PostgreSQL.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votingSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ params }) => {
    const [row] = await db.select().from(votingSessions).where(eq(votingSessions.id, params.id));
    if (!row) throw ApiError.notFound('Voting session not found');
    return { data: row };
  },
);

export const PATCH = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ params, body }) => {
    const [row] = await db.update(votingSessions).set({ ...(body as Record<string, unknown>), updatedAt: new Date() }).where(eq(votingSessions.id, params.id)).returning();
    if (!row) throw ApiError.notFound('Voting session not found');
    return { data: row };
  },
);

export const DELETE = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ params }) => {
    const [row] = await db.update(votingSessions).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(votingSessions.id, params.id)).returning();
    if (!row) throw ApiError.notFound('Voting session not found');
    return { data: row };
  },
);
