/**
 * LRO Performance route
 * GET /api/satisfaction/lro/[lroId] — get performance metrics for an LRO
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { getLroPerformance } from '@/lib/services/satisfaction-service';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { MIN_RESPONSES_FOR_FIGURES, mayReadRepresentativeFigures } from '@/lib/satisfaction/figures-policy';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Satisfaction'],
      summary: 'Get LRO performance metrics',
      description: 'Returns aggregated satisfaction ratings for a specific LRO.',
    },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    // A steward reads their own figures; another representative's are an officer's to read.
    if (!mayReadRepresentativeFigures({ callerUserId: userId, representativeId: params.lroId, isOfficer: await hasMinRole('officer') })) {
      throw ApiError.forbidden('Another representative\'s satisfaction figures require an officer');
    }
    const performance = await getLroPerformance(params.lroId, organizationId);
    // An unknown representative and one nobody has rated are the same here: there are no figures, which is not an average of zero.
    if (performance.completedSurveys === 0) throw ApiError.notFound('Satisfaction ratings for this representative');
    await withRLSContext({ organizationId, userId }, (tx) => persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'satisfaction.representative.read',
      resourceType: 'satisfaction_surveys',
      resourceId: organizationId,
      details: { representativeId: params.lroId, completedSurveys: performance.completedSurveys },
    }));
    // Below the minimum, the count is shown and the averages are not: a mean of a few ratings names who gave them.
    if (performance.completedSurveys < MIN_RESPONSES_FOR_FIGURES) {
      return { lroId: performance.lroId, completedSurveys: performance.completedSurveys, minimumResponses: MIN_RESPONSES_FOR_FIGURES, figures: null };
    }
    return { ...performance, minimumResponses: MIN_RESPONSES_FOR_FIGURES };
  }
);
