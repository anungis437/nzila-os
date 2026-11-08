/**
 * Survey response submission and stewardship-level aggregate review.
 * Never return individual identity, IP, user-agent, or response rows to a
 * steward: anonymous survey participants must remain anonymous.
 */
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { issueResponseCapability } from '@/lib/communications/survey-response-capability';
import { db } from '@/db/db';
import { surveys, surveyResponses } from '@/db/schema';
import { and, eq, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    requireOrg: true,
    openapi: {
      tags: ['Surveys'],
      summary: 'Open a new in-progress response to a survey',
      description:
        'A member cannot create a response for another tenant\'s survey, impersonate another respondent, or bypass ' +
        'a survey\'s anonymous-identity setting. An anonymous response (the survey\'s own allowAnonymous setting) ' +
        'is issued a one-time response capability token in this call\'s response body — present it as the ' +
        'x-survey-response-token header on every later call against this response id; it is never shown again.',
    },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    const parsed = zUUID.safeParse(params.surveyId);
    if (!parsed.success) throw ApiError.badRequest('Invalid survey identifier');

    return withRLSContext({ organizationId }, async (tx) => {
      const [survey] = await tx
        .select({
          id: surveys.id,
          allowAnonymous: surveys.allowAnonymous,
          status: surveys.status,
          publishedAt: surveys.publishedAt,
          closesAt: surveys.closesAt,
        })
        .from(surveys)
        .where(and(eq(surveys.id, parsed.data), eq(surveys.organizationId, organizationId)))
        .limit(1);
      if (!survey) throw ApiError.notFound('Survey not found');
      if (survey.status !== 'active' && survey.status !== 'published') {
        throw ApiError.forbidden('Survey is not accepting responses');
      }
      const now = Date.now();
      if (!survey.publishedAt || survey.publishedAt.getTime() > now || (survey.closesAt && survey.closesAt.getTime() <= now)) {
        throw ApiError.forbidden('Survey is not open');
      }

      const capability = survey.allowAnonymous ? issueResponseCapability() : null;

      const [created] = await tx
        .insert(surveyResponses)
        .values({
          organizationId,
          surveyId: survey.id,
          userId: survey.allowAnonymous ? null : userId,
          responseTokenHash: capability?.tokenHash ?? null,
          respondentName: null,
          respondentEmail: null,
          ipAddress: null,
          userAgent: null,
          status: 'in_progress',
          completedAt: null,
          startedAt: new Date(),
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'survey.response.created',
        resourceType: 'survey_responses',
        resourceId: created.id,
        details: { surveyId: survey.id, anonymous: survey.allowAnonymous },
      });

      return {
        id: created.id,
        surveyId: created.surveyId,
        status: created.status,
        startedAt: created.startedAt,
        ...(capability ? { responseToken: capability.token } : {}),
      };
    });
  },
);

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
