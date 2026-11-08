/**
 * Survey response completion.
 *
 * Companion to the answers route: a response is created `in_progress` (POST .../responses) and answered one question
 * at a time (POST .../responses/[responseId]/answers), but nothing moved it to `completed` - the status the survey's
 * own results route (results/route.ts) and response-count GET already read and expect. This route is that missing
 * step, and refuses to complete a response that is still missing a required answer.
 */
import { z } from 'zod';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { surveyResponses, surveyQuestions, surveyAnswers } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const completeBodySchema = z.object({
  timeSpentSeconds: z.number().int().nonnegative().max(86_400).optional(),
});

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'member' },
    requireOrg: true,
    body: completeBodySchema,
    openapi: {
      tags: ['Surveys'],
      summary: 'Mark an in-progress survey response as completed, once every required question is answered',
    },
  },
  async ({ params, organizationId, userId, body }) => {
    if (!organizationId) throw ApiError.forbidden('Organization context required');
    const surveyId = zUUID.safeParse(params.surveyId);
    const responseId = zUUID.safeParse(params.responseId);
    if (!surveyId.success || !responseId.success) throw ApiError.badRequest('Invalid identifier');

    return withRLSContext({ organizationId }, async (tx) => {
      const [response] = await tx
        .select()
        .from(surveyResponses)
        .where(
          and(
            eq(surveyResponses.id, responseId.data),
            eq(surveyResponses.surveyId, surveyId.data),
            eq(surveyResponses.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!response) throw ApiError.notFound('Response');
      if (response.status === 'completed') throw ApiError.conflict('This response has already been submitted');
      if (response.userId && response.userId !== userId) {
        throw ApiError.forbidden('This response belongs to a different respondent');
      }

      const requiredQuestions = await tx
        .select({ id: surveyQuestions.id })
        .from(surveyQuestions)
        .where(
          and(
            eq(surveyQuestions.surveyId, surveyId.data),
            eq(surveyQuestions.organizationId, organizationId),
            eq(surveyQuestions.required, true),
          ),
        );

      if (requiredQuestions.length > 0) {
        const answered = await tx
          .select({ questionId: surveyAnswers.questionId })
          .from(surveyAnswers)
          .where(and(eq(surveyAnswers.responseId, response.id), eq(surveyAnswers.organizationId, organizationId)));
        const answeredIds = new Set(answered.map((a) => a.questionId));
        const missing = requiredQuestions.filter((q) => !answeredIds.has(q.id)).map((q) => q.id);
        if (missing.length > 0) {
          throw ApiError.badRequest('Required questions are unanswered', { missingQuestionIds: missing });
        }
      }

      // The status predicate guards against two concurrent completions of the same response.
      const [updated] = await tx
        .update(surveyResponses)
        .set({
          status: 'completed',
          completedAt: new Date(),
          timeSpentSeconds: body.timeSpentSeconds ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(surveyResponses.id, response.id),
            eq(surveyResponses.organizationId, organizationId),
            ne(surveyResponses.status, 'completed'),
          ),
        )
        .returning();
      if (!updated) throw ApiError.conflict('This response was already completed');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'survey.response.completed',
        resourceType: 'survey_responses',
        resourceId: updated.id,
        details: { surveyId: surveyId.data, timeSpentSeconds: body.timeSpentSeconds ?? null },
      });

      return { id: updated.id, status: updated.status, completedAt: updated.completedAt };
    });
  },
);
