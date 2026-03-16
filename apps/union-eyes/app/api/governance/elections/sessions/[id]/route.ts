/**
 * GET PATCH DELETE /api/governance/elections/sessions/[id]
 * Single voting session operations — replaces Django proxy.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votingSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: { tags: ['Governance'], summary: 'Get voting session by ID' },
  },
  async ({ request }) => {
    const id = request.url.split('/sessions/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');
    const [session] = await db.select().from(votingSessions).where(eq(votingSessions.id, id));
    if (!session) throw ApiError.notFound('Voting session not found');
    return { data: session };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Governance'], summary: 'Update voting session' },
  },
  async ({ request, body }) => {
    const id = request.url.split('/sessions/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');
    const [session] = await db.update(votingSessions).set({ ...(body as Record<string, unknown>), updatedAt: new Date() }).where(eq(votingSessions.id, id)).returning();
    if (!session) throw ApiError.notFound('Voting session not found');
    return { data: session };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Governance'], summary: 'Cancel voting session' },
  },
  async ({ request }) => {
    const id = request.url.split('/sessions/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');
    const [session] = await db.update(votingSessions).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(votingSessions.id, id)).returning();
    if (!session) throw ApiError.notFound('Voting session not found');
    return { data: session };
  },
);

