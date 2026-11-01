/**
 * LRO Rankings route
 * GET /api/satisfaction/rankings — rank the representatives of the organization who have enough completed surveys.
 *
 * These are the performance figures of named people: the read is an officer's, a representative with fewer than the minimum number of
 * responses is left out (and counted), and each read is recorded in the same transaction.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { getOrganizationLroRankings } from '@/lib/services/satisfaction-service';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { MIN_RESPONSES_FOR_FIGURES, withEnoughResponses } from '@/lib/satisfaction/figures-policy';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: {
      tags: ['Satisfaction'],
      summary: 'Get LRO rankings',
      description: 'Returns ranked LRO performance metrics for the organization.',
    },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const all = await getOrganizationLroRankings(organizationId);
    const { shown, suppressed } = withEnoughResponses(all);
    await withRLSContext({ organizationId, userId }, (tx) => persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'satisfaction.rankings.read',
      resourceType: 'satisfaction_surveys',
      resourceId: organizationId,
      details: { returned: shown.length, suppressed },
    }));
    return { rankings: shown, minimumResponses: MIN_RESPONSES_FOR_FIGURES, suppressed };
  }
);
