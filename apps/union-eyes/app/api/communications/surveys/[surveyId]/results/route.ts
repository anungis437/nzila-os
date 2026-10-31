/**
 * Survey results: a tenant-scoped aggregate. Answer text and respondent PII
 * are neither loaded nor returned by this endpoint.
 */
import { NextResponse } from 'next/server';
import { withApi, zUUID } from '@/lib/api/framework';
import { db } from '@/db/db';
import { surveys, surveyResponses, surveyQuestions } from '@/db/schema';
import { and, eq, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    requireOrg: true,
    rlsOrgContext: true,
    openapi: {
      tags: ['Surveys'],
      summary: 'Get survey results',
      description: 'Returns organization-scoped aggregate survey counts; never reads individual answers.',
    },
  },
  async ({ params, organizationId }) => {
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 403 });
    }
    const parsed = zUUID.safeParse(params.surveyId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid survey identifier' }, { status: 400 });
    }
    const surveyId = parsed.data;

    // Validate ownership before consulting any response or question rows.
    const [survey] = await db
      .select({ id: surveys.id })
      .from(surveys)
      .where(and(eq(surveys.id, surveyId), eq(surveys.organizationId, organizationId)))
      .limit(1);
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    const [responseCount, questions] = await Promise.all([
      db.select({ count: count() }).from(surveyResponses).where(and(
        eq(surveyResponses.surveyId, surveyId),
        eq(surveyResponses.organizationId, organizationId),
      )),
      db.select({ id: surveyQuestions.id }).from(surveyQuestions).where(and(
        eq(surveyQuestions.surveyId, surveyId),
        eq(surveyQuestions.organizationId, organizationId),
      )),
    ]);

    return {
      surveyId,
      totalResponses: responseCount[0]?.count ?? 0,
      questionCount: questions.length,
    };
  },
);
