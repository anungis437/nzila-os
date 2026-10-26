/**
 * Voting results route
 * GET /api/voting/sessions/[id]/results — calculate and return results
 */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';
import {
  calculateResults,
  calculateRankedChoiceResults,
  getSessionStatistics,
  getVotingSessionById,
} from '@/lib/services/voting-service';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    // Tallies are an officer-level, post-close view. Members receive the
    // participation endpoint only; no live count is observable.
    auth: { required: true, minRole: 'officer' },
    openapi: {
      tags: ['Governance'],
      summary: 'Get voting results',
      description: 'Return aggregate results for a closed voting session in the caller\'s organization. Results are not certified.',
    },
  },
  async ({ params, organizationId }) => {
    const sessionId = params.id;

    const session = await getVotingSessionById(sessionId);
    if (!session || !organizationId || session.organizationId !== organizationId) {
      throw ApiError.notFound('Voting session');
    }

    const header = {
      id: session.id,
      title: session.title,
      status: session.status,
      type: session.type,
    };
    if (session.status !== 'closed') {
      return { session: header, results: null, statistics: null, rankedChoiceResults: null, resultsWithheld: true, certification: 'NOT_CERTIFIED' };
    }

    // Calculate results based on session type
    const results = await calculateResults(sessionId);
    const statistics = await getSessionStatistics(sessionId);

    // Include ranked-choice results if applicable
    let rankedChoiceResults: Record<string, unknown> | null = null;
    if (session.type === 'convention') {
      try {
        rankedChoiceResults = { ...(await calculateRankedChoiceResults(sessionId)) };
      } catch { /* Not enough data for IRV */ }
    }

    return {
      session: header,
      results,
      statistics,
      rankedChoiceResults,
      resultsWithheld: false,
      certification: 'NOT_CERTIFIED',
    };
  }
);
