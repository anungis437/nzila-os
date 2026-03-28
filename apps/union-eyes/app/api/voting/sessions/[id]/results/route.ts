/**
 * Voting results route
 * GET /api/voting/sessions/[id]/results — calculate and return results
 */
import { withApi } from '@/lib/api/framework';
import {
  calculateResults,
  calculateRankedChoiceResults,
  getSessionStatistics,
  getVotingSessionById,
} from '@/lib/services/voting-service';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Governance'],
      summary: 'Get voting results',
      description: 'Calculate and return results for a voting session, including ranked-choice if applicable.',
    },
  },
  async ({ params }) => {
    const sessionId = params.id;

    const session = await getVotingSessionById(sessionId);
    if (!session) {
      const { ApiError } = await import('@/lib/api/errors');
      throw ApiError.notFound('Voting session');
    }

    // Calculate results based on session type
    const results = await calculateResults(sessionId);
    const statistics = await getSessionStatistics(sessionId);

    // Include ranked-choice results if applicable
    let rankedChoiceResults = null;
    if (session.type === 'convention') {
      try {
        rankedChoiceResults = await calculateRankedChoiceResults(sessionId);
      } catch { /* Not enough data for IRV */ }
    }

    return {
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        type: session.type,
      },
      results,
      statistics,
      rankedChoiceResults,
    };
  }
);
