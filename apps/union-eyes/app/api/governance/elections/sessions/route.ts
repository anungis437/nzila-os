/**
 * GET POST /api/governance/elections/sessions
 * Voting sessions management — replaces Django proxy.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { votingSessions } from '@/db/schema';
import { desc, count, eq } from 'drizzle-orm';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { z } from 'zod';

// The organization and the opening status are never caller input: a session is created in the caller's own
// organization as a draft and moves through the lifecycle (PATCH) under the session-lifecycle rules.
const createSessionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  type: z.string().min(1).max(50),
  meetingType: z.string().min(1).max(50),
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
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const [_totalResult, sessions] = await Promise.all([
      db.select({ total: count() }).from(votingSessions).where(eq(votingSessions.organizationId, organizationId)),
      db.select().from(votingSessions).where(eq(votingSessions.organizationId, organizationId)).orderBy(desc(votingSessions.createdAt)).limit(limit).offset(offset),
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
  async ({ body, userId, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const parsed = createSessionSchema.parse(body);
    return withRLSContext(async (tx) => {
      const [session] = await tx
        .insert(votingSessions)
        .values({ ...parsed, organizationId, status: 'draft', createdBy: userId! })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId,
        userId: userId!,
        action: 'voting_session.create',
        resourceType: 'voting_sessions',
        resourceId: session.id,
        details: { type: parsed.type, meetingType: parsed.meetingType },
      });
      return session;
    });
  },
);

