/**
 * Voting sessions collection route
 * GET  /api/voting/sessions — list sessions with filtering
 * POST /api/voting/sessions — create a new session
 */
import { withApi, z } from '@/lib/api/framework';
import {
  listVotingSessions,
  createVotingSession,
} from '@/lib/services/voting-service';
import { db } from '@/db/db';
import { votingOptions, votes as votesTable } from '@/db/schema';
import { inArray, count } from 'drizzle-orm';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Governance'],
      summary: 'List voting sessions',
      description: 'Returns paginated voting sessions with optional status/type filters.',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status')?.split(',') ?? undefined;
    const type = url.searchParams.get('type') ?? undefined;
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    const result = await listVotingSessions(
      {
        organizationId: organizationId ?? undefined,
        status,
        type,
      },
      { page, limit }
    );

    // Enrich sessions with options and vote counts
    const sessionIds = result.sessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      const [options, voteCounts] = await Promise.all([
        db.select().from(votingOptions)
          .where(inArray(votingOptions.sessionId, sessionIds))
          .orderBy(votingOptions.orderIndex),
        db.select({
          optionId: votesTable.optionId,
          count: count(),
        }).from(votesTable)
          .where(inArray(votesTable.sessionId, sessionIds))
          .groupBy(votesTable.optionId),
      ]);

      const voteCountMap = Object.fromEntries(
        voteCounts.map((vc) => [vc.optionId, Number(vc.count)])
      );

      const optionsBySession: Record<string, typeof options> = {};
      for (const opt of options) {
        if (!optionsBySession[opt.sessionId]) optionsBySession[opt.sessionId] = [];
        optionsBySession[opt.sessionId].push(opt);
      }

      const enriched = result.sessions.map((s) => {
        const opts = optionsBySession[s.id] || [];
        const totalVotes = opts.reduce((sum, o) => sum + (voteCountMap[o.id] || 0), 0);
        return {
          ...s,
          options: opts.map((o) => ({
            id: o.id,
            text: o.text,
            description: o.description,
            orderIndex: o.orderIndex,
            votes: voteCountMap[o.id] || 0,
            percentage: totalVotes > 0 ? Math.round(((voteCountMap[o.id] || 0) / totalVotes) * 100) : 0,
          })),
          totalVotes,
        };
      });

      return { ...result, sessions: enriched };
    }

    return result;
  }
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(['convention', 'ratification', 'special_vote', 'election', 'strike_authorization', 'bylaw_amendment', 'policy', 'pulse_check']),
      meetingType: z.enum(['convention', 'ratification', 'emergency', 'special', 'general_membership', 'annual_general_meeting', 'special_meeting', 'executive_board']),
      startTime: z.string().datetime().optional(),
      endTime: z.string().datetime().optional(),
      allowAnonymous: z.boolean().optional().default(true),
      requiresQuorum: z.boolean().optional().default(true),
      quorumThreshold: z.number().min(0).max(100).optional().default(50),
    }),
    openapi: {
      tags: ['Governance'],
      summary: 'Create voting session',
      description: 'Create a new voting session. Requires steward role.',
    },
    successStatus: 201,
  },
  async ({ body, userId, organizationId }) => {
    const session = await createVotingSession({
      ...body,
      organizationId: organizationId!,
      createdBy: userId!,
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      endTime: body.endTime ? new Date(body.endTime) : undefined,
    });

    // Evidence: democratic governance audit trail
    buildUnionEvidencePack({
      actionType: 'VOTING_SESSION_CREATED',
      orgId: organizationId!,
      actorId: userId!,
      artifacts: [{ type: 'voting_session', data: { sessionId: session.id, type: body.type, meetingType: body.meetingType } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'VOTING_SESSION_CREATED' }))

    return session;
  }
);
