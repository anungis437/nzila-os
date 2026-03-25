/**
 * GET PATCH DELETE /api/v2/governance/elections/sessions/[id]
 * Single voting session operations backed by PostgreSQL.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votingSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSessionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  type: z.string().min(1).max(50).optional(),
  meetingType: z.string().min(1).max(50).optional(),
  status: z.enum(['draft', 'open', 'closed', 'cancelled']).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  scheduledEndTime: z.coerce.date().optional(),
  allowAnonymous: z.boolean().optional(),
  requiresQuorum: z.boolean().optional(),
  quorumThreshold: z.number().int().min(0).max(100).optional(),
  totalEligibleVoters: z.number().int().min(0).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ params }) => {
    const [row] = await db.select().from(votingSessions).where(eq(votingSessions.id, params.id));
    if (!row) throw ApiError.notFound('Voting session not found');
    return row;
  },
);

export const PATCH = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ params, body }) => {
    const parsed = updateSessionSchema.parse(body);
    const [row] = await db.update(votingSessions).set({ ...parsed, updatedAt: new Date() }).where(eq(votingSessions.id, params.id)).returning();
    if (!row) throw ApiError.notFound('Voting session not found');
    return row;
  },
);

export const DELETE = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ params }) => {
    const [row] = await db.update(votingSessions).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(votingSessions.id, params.id)).returning();
    if (!row) throw ApiError.notFound('Voting session not found');
    return row;
  },
);
