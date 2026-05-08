// cognition-governance-ci: allow-route-bypass — Summarization workflow with parameters.
/**
 * POST /api/exit-interviews/[id]/summarize
 *
 * Generates (or regenerates) an AI knowledge summary for a published interview.
 * Stores the result in the aiSummary + aiSummaryGeneratedAt columns.
 *
 * Access: steward+, own org, published status only
 */

import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { exitInterviews, exitInterviewEvents } from '@/db/schema';
import { generateKnowledgeSummary } from '@/lib/knowledge-transfer/summaries/knowledge-summarizer';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

function hasStewardPrivileges(role: string | null): boolean {
  const normalized = normalizeRole((role ?? 'member') as never);
  return (ROLE_HIERARCHY[normalized] ?? 0) >= ROLE_HIERARCHY.steward;
}

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Generate AI knowledge summary',
      description: 'Produces a traceable AI operational handoff summary for a published exit interview.',
    },
  },
  async ({ params, organizationId, userId, user }) => {
    if (!hasStewardPrivileges(user?.role ?? null)) {
      throw ApiError.forbidden('Steward-level access required');
    }

    const [interview] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!interview) throw ApiError.notFound('Exit interview');
    if (interview.status !== 'published') {
      throw ApiError.conflict('Summaries can only be generated for published interviews');
    }

    const summary = await generateKnowledgeSummary(interview);
    const now = new Date();

    await db
      .update(exitInterviews)
      .set({
        aiSummary: summary.operationalSummary,
        aiSummaryGeneratedAt: now,
        updatedAt: now,
      })
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)));

    await db.insert(exitInterviewEvents).values({
      interviewId: params.id,
      organizationId: organizationId!,
      eventType: 'summarized',
      actorUserId: userId!,
      notes: 'AI knowledge summary generated',
      payload: { generatedAt: now.toISOString() },
    });

    return { data: summary };
  },
);
