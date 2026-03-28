/**
 * Satisfaction surveys collection route
 * GET  /api/satisfaction — list pending surveys for the current member
 * POST /api/satisfaction — (admin) create a satisfaction survey manually
 */
import { withApi, z } from '@/lib/api/framework';
import {
  getPendingSurveys,
  createSatisfactionSurvey,
} from '@/lib/services/satisfaction-service';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Satisfaction'],
      summary: 'List pending satisfaction surveys',
      description: 'Returns satisfaction surveys pending completion for the current user.',
    },
  },
  async ({ userId }) => {
    const surveys = await getPendingSurveys(userId!);
    return { surveys, count: surveys.length };
  }
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: z.object({
      claimId: z.string().uuid(),
      memberId: z.string().min(1),
      lroId: z.string().min(1),
    }),
    openapi: {
      tags: ['Satisfaction'],
      summary: 'Create satisfaction survey',
      description: 'Manually create a satisfaction survey for a closed claim.',
    },
    successStatus: 201,
  },
  async ({ body, organizationId }) => {
    const survey = await createSatisfactionSurvey({
      organizationId: organizationId!,
      claimId: body.claimId,
      memberId: body.memberId,
      lroId: body.lroId,
    });
    return survey;
  }
);
