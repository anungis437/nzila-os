/**
 * Survey results route
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { surveyResponses, surveyAnswers, surveyQuestions } from '@/db/schema';
import { eq, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Surveys'],
      summary: 'Get survey results',
      description: 'Returns aggregated results for a survey.',
    },
  },
  async ({ params }) => {
    const surveyId = params.surveyId;

    const [responseCount, questions, answers] = await Promise.all([
      db.select({ count: count() }).from(surveyResponses).where(eq(surveyResponses.surveyId, surveyId)),
      db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, surveyId)),
      db.select().from(surveyAnswers),
    ]);

    return {
      surveyId,
      totalResponses: responseCount[0]?.count ?? 0,
      questionCount: questions.length,
    };
  }
);
