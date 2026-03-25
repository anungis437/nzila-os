/**
 * GET POST /api/governance/elections/sessions/[id]/vote
 * Cast and view votes for a voting session — replaces Django proxy.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votes, votingOptions, votingSessions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const castVoteSchema = z.object({
  optionId: z.string().uuid(),
  voterId: z.string().min(1).max(100),
  voterHash: z.string().max(100).optional(),
  signature: z.string().max(5000).optional(),
  receiptId: z.string().max(255).optional(),
  verificationCode: z.string().max(100).optional(),
  auditHash: z.string().max(255).optional(),
  isAnonymous: z.boolean().default(true),
  voterType: z.enum(['member', 'delegate', 'proxy', 'observer']).default('member'),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Governance'], summary: 'Get votes for session' },
  },
  async ({ request }) => {
    const id = request.url.split('/sessions/')[1]?.split('/vote')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');

    const [session] = await db.select().from(votingSessions).where(eq(votingSessions.id, id));
    if (!session) throw ApiError.notFound('Voting session not found');

    const options = await db.select().from(votingOptions).where(eq(votingOptions.sessionId, id));
    const castVotes = await db.select().from(votes).where(eq(votes.sessionId, id)).orderBy(desc(votes.castAt));

    return { session, options, votes: castVotes };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Governance'], summary: 'Cast vote' },
  },
  async ({ request, body }) => {
    const id = request.url.split('/sessions/')[1]?.split('/vote')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');

    const parsed = castVoteSchema.parse(body);
    const [vote] = await db.insert(votes).values({ ...parsed, sessionId: id }).returning();
    return vote;
  },
);

