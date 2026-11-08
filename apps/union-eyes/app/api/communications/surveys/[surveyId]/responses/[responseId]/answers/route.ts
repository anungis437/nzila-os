/**
 * Survey answer submission.
 *
 * DEF-0B5-SURVEY-ANSWERS-HAVE-NO-ROUTE: no route under app/api wrote survey_answers, so a response could be created
 * (POST .../responses) and no answer could ever be recorded against it. This route fills that gap: one answer per
 * call, upserted by (responseId, questionId) so a respondent can change an answer before submitting the response.
 */
import { z } from 'zod';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { surveyResponses, surveyQuestions, surveyAnswers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const answerBodySchema = z
  .object({
    questionId: zUUID,
    answerText: z.string().max(10_000).optional(),
    answerNumber: z.number().finite().optional(),
    answerChoices: z.array(z.string().max(255)).max(50).optional(),
    answerOther: z.string().max(2_000).optional(),
  })
  .refine(
    (v) => [v.answerText, v.answerNumber, v.answerChoices].filter((x) => x !== undefined).length === 1,
    { message: 'Exactly one of answerText, answerNumber or answerChoices must be provided' },
  );

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    requireOrg: true,
    body: answerBodySchema,
    openapi: {
      tags: ['Surveys'],
      summary: 'Submit or update an answer to one question of an in-progress survey response',
    },
  },
  async ({ params, organizationId, userId, body }) => {
    if (!organizationId) throw ApiError.forbidden('Organization context required');
    const surveyId = zUUID.safeParse(params.surveyId);
    const responseId = zUUID.safeParse(params.responseId);
    if (!surveyId.success || !responseId.success) throw ApiError.badRequest('Invalid identifier');

    // Defense in depth: the schema's own .refine() already enforces this at the framework's body-parsing step: kept
    // here too so the invariant holds even if a caller of this handler ever bypasses that step.
    const shapeCount = [body.answerText, body.answerNumber, body.answerChoices].filter((x) => x !== undefined).length;
    if (shapeCount !== 1) {
      throw ApiError.badRequest('Exactly one of answerText, answerNumber or answerChoices must be provided');
    }

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
      if (response.status === 'completed') {
        throw ApiError.conflict('This response has already been submitted and cannot be changed');
      }
      // An anonymous survey's response has no owning user (set at creation, see responses/route.ts); an identified
      // response may only be answered by its own respondent.
      if (response.userId && response.userId !== userId) {
        throw ApiError.forbidden('This response belongs to a different respondent');
      }

      const [question] = await tx
        .select({ id: surveyQuestions.id })
        .from(surveyQuestions)
        .where(
          and(
            eq(surveyQuestions.id, body.questionId),
            eq(surveyQuestions.surveyId, surveyId.data),
            eq(surveyQuestions.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!question) throw ApiError.notFound('Question');

      const values = {
        organizationId,
        responseId: response.id,
        questionId: question.id,
        answerText: body.answerText ?? null,
        answerNumber: body.answerNumber !== undefined ? body.answerNumber.toString() : null,
        answerChoices: body.answerChoices ?? null,
        answerOther: body.answerOther ?? null,
        answeredAt: new Date(),
      };

      const [answer] = await tx
        .insert(surveyAnswers)
        .values(values)
        .onConflictDoUpdate({
          target: [surveyAnswers.responseId, surveyAnswers.questionId],
          set: {
            answerText: values.answerText,
            answerNumber: values.answerNumber,
            answerChoices: values.answerChoices,
            answerOther: values.answerOther,
            answeredAt: values.answeredAt,
          },
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'survey.answer.submitted',
        resourceType: 'survey_answers',
        resourceId: answer.id,
        details: { surveyId: surveyId.data, responseId: response.id, questionId: question.id },
      });

      return { id: answer.id, questionId: answer.questionId, answeredAt: answer.answeredAt };
    });
  },
);
