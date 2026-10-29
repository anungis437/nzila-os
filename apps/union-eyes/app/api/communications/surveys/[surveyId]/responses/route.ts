/**
 * Survey response submission and stewardship-level aggregate review.
 * Never return individual identity, IP, user-agent, or response rows to a
 * steward: anonymous survey participants must remain anonymous.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { db } from '@/db/db';
import { surveys, surveyResponses } from '@/db/schema';
import { and, eq, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const { POST } = crudRoutes({
  table: surveyResponses,
  pk: 'id',
  tags: ['Surveys'],
  orgScoped: true,
  writeRole: 'member',
});
export { POST };

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    requireOrg: true,
    rlsOrgContext: true,
    openapi: {
      tags: ['Surveys'],
      summary: 'Read response counts without respondent information',
    },
  },
  async ({ params, organizationId }) => {
    if (!organizationId) throw ApiError.forbidden('Organization context required');
    const parsed = zUUID.safeParse(params.surveyId);
    if (!parsed.success) throw ApiError.badRequest('Invalid survey identifier');
    const surveyId = parsed.data;
    const [survey] = await db
      .select({ id: surveys.id })
      .from(surveys)
      .where(and(eq(surveys.id, surveyId), eq(surveys.organizationId, organizationId)))
      .limit(1);
    if (!survey) throw ApiError.notFound('Survey not found');
    const [all, completed] = await Promise.all([
      db.select({ value: count() }).from(surveyResponses).where(and(
        eq(surveyResponses.organizationId, organizationId),
        eq(surveyResponses.surveyId, surveyId),
      )),
      db.select({ value: count() }).from(surveyResponses).where(and(
        eq(surveyResponses.organizationId, organizationId),
        eq(surveyResponses.surveyId, surveyId),
        eq(surveyResponses.status, 'completed'),
      )),
    ]);
    return {
      surveyId,
      totalResponses: all[0]?.value ?? 0,
      completedResponses: completed[0]?.value ?? 0,
    };
  },
);
