/**
 * GET POST /api/governance/elections/sessions
 * Voting sessions management — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votingSessions } from '@/db/schema';
import { desc, count } from 'drizzle-orm';
import { z } from 'zod';

const createSessionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  type: z.string().min(1).max(50),
  meetingType: z.string().min(1).max(50),
  organizationId: z.string().uuid(),
  status: z.enum(['draft', 'open', 'closed', 'cancelled']).default('draft'),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  scheduledEndTime: z.coerce.date().optional(),
  allowAnonymous: z.boolean().default(true),
  requiresQuorum: z.boolean().default(true),
  quorumThreshold: z.number().int().min(0).max(100).default(50),
  totalEligibleVoters: z.number().int().min(0).default(0),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'List voting sessions' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const [totalResult, sessions] = await Promise.all([
      db.select({ total: count() }).from(votingSessions),
      db.select().from(votingSessions).orderBy(desc(votingSessions.createdAt)).limit(limit).offset(offset),
    ]);

    return sessions;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Create voting session' },
  },
  async ({ body, userId }) => {
    const parsed = createSessionSchema.parse(body);
    const [session] = await db.insert(votingSessions).values({ ...parsed, createdBy: userId! }).returning();
    return session;
  },
);

