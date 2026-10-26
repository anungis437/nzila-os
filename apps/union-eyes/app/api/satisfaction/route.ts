/**
 * Satisfaction surveys collection route
 * GET  /api/satisfaction — list pending surveys for the current member
 * POST /api/satisfaction — (admin) create a satisfaction survey manually
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { and, eq } from 'drizzle-orm';
import { claims } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
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
      claimId: z.guid(),
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
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    // The claim must be this organization's, and the survey must go to the claim's own member.
    const [claim] = await withRLSContext({ organizationId }, (tx) =>
      tx
        .select({ memberId: claims.memberId, assignedTo: claims.assignedTo })
        .from(claims)
        .where(and(eq(claims.id, body.claimId), eq(claims.organizationId, organizationId)))
        .limit(1),
    );
    if (!claim) throw ApiError.notFound('Claim');
    if (claim.memberId !== body.memberId) {
      throw ApiError.badRequest('The survey can only be sent to the member who filed the claim');
    }
    if (claim.assignedTo && claim.assignedTo !== body.lroId) {
      throw ApiError.badRequest('The survey must rate the representative assigned to the claim');
    }

    const survey = await createSatisfactionSurvey(
      {
        organizationId,
        claimId: body.claimId,
        memberId: body.memberId,
        lroId: body.lroId,
      },
      userId,
    );
    return survey;
  }
);
