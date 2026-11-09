/**
 * Survey answer submission.
 *
 * DEF-0B5-SURVEY-ANSWERS-HAVE-NO-ROUTE: no route under app/api wrote survey_answers, so a response could be created
 * (POST .../responses) and no answer could ever be recorded against it. This route fills that gap: one answer per
 * call, upserted by (responseId, questionId) so a respondent can change an answer before submitting the response.
 *
 * DEF-0B5-SURVEY-RESPONSES-IDENTIFIED-OR-ANONYMOUS-RESPONSE-MUTATION-AUTHORITY: an anonymous response has no owning
 * user by design, but a bare response id is not sufficient authority to answer on its behalf — any org member who
 * knew or enumerated the id could otherwise submit someone else's answers. An anonymous response must instead
 * present the one-time capability token issued at creation (see lib/communications/survey-response-capability.ts).
 */
import { z } from 'zod';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { RESPONSE_CAPABILITY_HEADER, verifyResponseCapability } from '@/lib/communications/survey-response-capability';
import { surveyResponses, surveyQuestionnaireVersions, surveyAnswers } from '@/db/schema';
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
  async ({ request, params, organizationId, userId, body }) => {
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
      // An identified response may only be answered by its own respondent. An anonymous response has no owning
      // user (set at creation, see responses/route.ts) and is instead authorized by a capability token: a bare
      // response id is never sufficient authority on its own.
      if (response.userId) {
        if (response.userId !== userId) {
          throw ApiError.forbidden('This response belongs to a different respondent');
        }
      } else {
        const presented = request.headers.get(RESPONSE_CAPABILITY_HEADER);
        if (!verifyResponseCapability(presented, response.responseTokenHash)) {
          throw ApiError.forbidden('A valid response capability token is required for an anonymous response');
        }
      }

      const [questionnaire] = await tx
        .select({ questions: surveyQuestionnaireVersions.questions })
        .from(surveyQuestionnaireVersions)
        .where(and(
          eq(surveyQuestionnaireVersions.id, response.questionnaireVersionId),
          eq(surveyQuestionnaireVersions.surveyId, surveyId.data),
          eq(surveyQuestionnaireVersions.organizationId, organizationId),
        ))
        .limit(1);
      const question = questionnaire?.questions.find((candidate) => candidate.id === body.questionId);
      if (!question) throw ApiError.notFound('Question');

      validateAnswerAgainstQuestion(body, question);

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

type AnswerBody = z.infer<typeof answerBodySchema>;
type QuestionConstraints = {
  choices: unknown;
  allowOther: boolean | null;
  minChoices: number | null;
  maxChoices: number | null;
  ratingMin: number | null;
  ratingMax: number | null;
  minLength: number | null;
  maxLength: number | null;
};

/**
 * Dispatches validation on which shape the question is configured for (its own choices/rating/length fields),
 * rather than on a free-text questionType string: survey_questions.questionType has no established, enforced set
 * of values anywhere else in this codebase yet, so the question's own configured constraints are the only
 * authoritative source of what a valid answer looks like.
 */
function validateAnswerAgainstQuestion(body: AnswerBody, question: QuestionConstraints): void {
  const choiceList = Array.isArray(question.choices)
    ? (question.choices as Array<{ id?: unknown }>).filter((c) => typeof c?.id === 'string')
    : null;
  const isRatingQuestion = question.ratingMin !== null || question.ratingMax !== null;

  if (choiceList && choiceList.length > 0) {
    if (body.answerChoices === undefined) {
      throw ApiError.badRequest('This question requires answerChoices');
    }
    const validIds = new Set(choiceList.map((c) => c.id as string));
    const invalidChoiceIds = body.answerChoices.filter((c) => !validIds.has(c));
    if (invalidChoiceIds.length > 0) {
      throw ApiError.badRequest('One or more selected choices are not valid for this question', { invalidChoiceIds });
    }
    const uniqueCount = new Set(body.answerChoices).size;
    const min = question.minChoices ?? 1;
    const max = question.maxChoices ?? choiceList.length;
    if (uniqueCount < min || uniqueCount > max) {
      throw ApiError.badRequest(`This question requires between ${min} and ${max} selected choice(s)`, {
        minChoices: min,
        maxChoices: max,
        provided: uniqueCount,
      });
    }
  } else if (isRatingQuestion) {
    if (body.answerNumber === undefined) {
      throw ApiError.badRequest('This question requires answerNumber');
    }
    const min = question.ratingMin ?? 1;
    const max = question.ratingMax ?? 10;
    if (body.answerNumber < min || body.answerNumber > max) {
      throw ApiError.badRequest(`answerNumber must be between ${min} and ${max}`, { ratingMin: min, ratingMax: max });
    }
  } else {
    if (body.answerText === undefined) {
      throw ApiError.badRequest('This question requires answerText');
    }
    if (question.minLength != null && body.answerText.length < question.minLength) {
      throw ApiError.badRequest(`answerText must be at least ${question.minLength} character(s)`);
    }
    if (question.maxLength != null && body.answerText.length > question.maxLength) {
      throw ApiError.badRequest(`answerText must be at most ${question.maxLength} character(s)`);
    }
  }

  if (body.answerOther !== undefined && !question.allowOther) {
    throw ApiError.badRequest('This question does not allow an "other" response');
  }
}
