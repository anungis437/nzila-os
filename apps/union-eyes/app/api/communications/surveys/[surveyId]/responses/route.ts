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
import { surveys, surveyResponses, surveyQuestions, surveyQuestionnaireVersions, surveyAnonymousParticipations, type SurveyQuestionSnapshot } from '@/db/schema';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { anonymousParticipationDigest, questionnaireDigest } from '@/lib/communications/survey-questionnaire';

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
          allowMultipleResponses: surveys.allowMultipleResponses,
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

      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${survey.id}::text))`);
      const questions = await tx
        .select({
          id: surveyQuestions.id,
          questionText: surveyQuestions.questionText,
          questionType: surveyQuestions.questionType,
          description: surveyQuestions.description,
          orderIndex: surveyQuestions.orderIndex,
          section: surveyQuestions.section,
          required: surveyQuestions.required,
          choices: surveyQuestions.choices,
          allowOther: surveyQuestions.allowOther,
          minChoices: surveyQuestions.minChoices,
          maxChoices: surveyQuestions.maxChoices,
          ratingMin: surveyQuestions.ratingMin,
          ratingMax: surveyQuestions.ratingMax,
          minLength: surveyQuestions.minLength,
          maxLength: surveyQuestions.maxLength,
          placeholder: surveyQuestions.placeholder,
          showIf: surveyQuestions.showIf,
        })
        .from(surveyQuestions)
        .where(and(eq(surveyQuestions.surveyId, survey.id), eq(surveyQuestions.organizationId, organizationId)))
        .orderBy(asc(surveyQuestions.orderIndex), asc(surveyQuestions.id)) as SurveyQuestionSnapshot[];
      if (questions.length === 0) throw ApiError.conflict('Survey has no published questionnaire');
      const contentDigest = questionnaireDigest(questions);
      let [questionnaireVersion] = await tx.select().from(surveyQuestionnaireVersions).where(and(eq(surveyQuestionnaireVersions.surveyId, survey.id), eq(surveyQuestionnaireVersions.contentDigest, contentDigest))).limit(1);
      if (!questionnaireVersion) {
        const [latest] = await tx.select({ version: surveyQuestionnaireVersions.version }).from(surveyQuestionnaireVersions).where(eq(surveyQuestionnaireVersions.surveyId, survey.id)).orderBy(desc(surveyQuestionnaireVersions.version)).limit(1);
        [questionnaireVersion] = await tx.insert(surveyQuestionnaireVersions).values({ organizationId, surveyId: survey.id, version: (latest?.version ?? 0) + 1, contentDigest, questions }).returning();
      }

      if (survey.allowAnonymous && !survey.allowMultipleResponses) {
        const principalDigest = anonymousParticipationDigest(survey.id, userId);
        if (!principalDigest) throw ApiError.capabilityUnavailable('Anonymous single-response surveys require the participation HMAC key');
        const [participation] = await tx.insert(surveyAnonymousParticipations).values({ organizationId, surveyId: survey.id, principalDigest }).onConflictDoNothing().returning({ id: surveyAnonymousParticipations.id });
        if (!participation) throw ApiError.conflict('An anonymous response has already been opened for this survey');
      }
      if (!survey.allowAnonymous && !survey.allowMultipleResponses) {
        const [existing] = await tx.select({ id: surveyResponses.id }).from(surveyResponses).where(and(eq(surveyResponses.surveyId, survey.id), eq(surveyResponses.organizationId, organizationId), eq(surveyResponses.userId, userId))).limit(1);
        if (existing) throw ApiError.conflict('A response has already been opened for this survey');
      }

      const capability = survey.allowAnonymous ? issueResponseCapability() : null;

      const [created] = await tx
        .insert(surveyResponses)
        .values({
          organizationId,
          surveyId: survey.id,
          questionnaireVersionId: questionnaireVersion.id,
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
        questionnaireVersion: { id: questionnaireVersion.id, version: questionnaireVersion.version, contentDigest, questions },
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
