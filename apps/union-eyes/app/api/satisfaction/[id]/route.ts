/**
 * Single satisfaction survey route
 * GET  /api/satisfaction/[id] — get survey details
 * POST /api/satisfaction/[id] — submit ratings
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import {
  getOwnSatisfactionSurvey,
  submitSatisfactionRatings,
  declineSurvey,
} from '@/lib/services/satisfaction-service';

export const dynamic = 'force-dynamic';

// The service reports its refusals as plain errors; they are answered as the right client errors, not as a failure.
function surveyRefusal(error: unknown): never {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Survey not found') throw ApiError.notFound('Satisfaction survey');
  if (message.startsWith('Not authorized')) throw ApiError.notFound('Satisfaction survey');
  if (message === 'Survey already completed' || message === 'Survey can no longer be declined') {
    throw ApiError.conflict(message);
  }
  throw error;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Satisfaction'],
      summary: 'Get satisfaction survey',
      description: 'Returns one of the caller\u2019s own satisfaction surveys.',
    },
  },
  async ({ params, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.badRequest('Organization context required');
    const survey = await getOwnSatisfactionSurvey(params.id, userId, organizationId);
    if (!survey) {
      throw ApiError.notFound('Satisfaction survey');
    }
    return survey;
  }
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    body: z.object({
      action: z.enum(['submit', 'decline']).default('submit'),
      communicationRating: z.number().min(1).max(5).optional(),
      responsivenessRating: z.number().min(1).max(5).optional(),
      knowledgeRating: z.number().min(1).max(5).optional(),
      advocacyRating: z.number().min(1).max(5).optional(),
      professionalismRating: z.number().min(1).max(5).optional(),
      outcomeRating: z.number().min(1).max(5).optional(),
      feedback: z.string().max(2000).optional(),
      wouldRecommend: z.boolean().optional(),
      isAnonymous: z.boolean().optional(),
    }),
    openapi: {
      tags: ['Satisfaction'],
      summary: 'Submit or decline satisfaction survey',
      description: 'Submit ratings for a satisfaction survey or decline to participate.',
    },
  },
  async ({ params, body, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.badRequest('Organization context required');
    if (body.action === 'decline') {
      return await declineSurvey(params.id, userId, organizationId).catch(surveyRefusal);
    }

    // Validate all ratings are present for submission
    const required = [
      body.communicationRating,
      body.responsivenessRating,
      body.knowledgeRating,
      body.advocacyRating,
      body.professionalismRating,
      body.outcomeRating,
    ];
    if (required.some((r) => r === undefined || r === null)) {
      throw ApiError.badRequest('All six ratings are required when submitting');
    }

    return await submitSatisfactionRatings(params.id, userId, {
      communicationRating: body.communicationRating!,
      responsivenessRating: body.responsivenessRating!,
      knowledgeRating: body.knowledgeRating!,
      advocacyRating: body.advocacyRating!,
      professionalismRating: body.professionalismRating!,
      outcomeRating: body.outcomeRating!,
      feedback: body.feedback,
      wouldRecommend: body.wouldRecommend,
      isAnonymous: body.isAnonymous,
    }, organizationId).catch(surveyRefusal);
  }
);
