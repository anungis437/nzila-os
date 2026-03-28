/**
 * Single satisfaction survey route
 * GET  /api/satisfaction/[id] — get survey details
 * POST /api/satisfaction/[id] — submit ratings
 */
import { withApi, z } from '@/lib/api/framework';
import {
  getSatisfactionSurvey,
  submitSatisfactionRatings,
  declineSurvey,
} from '@/lib/services/satisfaction-service';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Satisfaction'],
      summary: 'Get satisfaction survey',
      description: 'Returns a single satisfaction survey with its details.',
    },
  },
  async ({ params }) => {
    const survey = await getSatisfactionSurvey(params.id);
    if (!survey) {
      const { ApiError } = await import('@/lib/api/errors');
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
  async ({ params, body, userId }) => {
    if (body.action === 'decline') {
      return await declineSurvey(params.id, userId!);
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
      const { ApiError } = await import('@/lib/api/errors');
      throw ApiError.badRequest('All six ratings are required when submitting');
    }

    return await submitSatisfactionRatings(params.id, userId!, {
      communicationRating: body.communicationRating!,
      responsivenessRating: body.responsivenessRating!,
      knowledgeRating: body.knowledgeRating!,
      advocacyRating: body.advocacyRating!,
      professionalismRating: body.professionalismRating!,
      outcomeRating: body.outcomeRating!,
      feedback: body.feedback,
      wouldRecommend: body.wouldRecommend,
      isAnonymous: body.isAnonymous,
    });
  }
);
