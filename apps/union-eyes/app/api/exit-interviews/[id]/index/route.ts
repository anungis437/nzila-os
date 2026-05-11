// cognition-governance-ci: allow-route-bypass — Per-interview index ops.
/**
 * POST /api/exit-interviews/[id]/index
 *
 * Manually triggers (or re-triggers) semantic indexing for a published interview.
 * Useful when indexing failed on publish, consent was later granted, or content changed.
 *
 * Access: admin+
 */

import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { exitInterviews, exitInterviewEvents } from '@/db/schema';
import { indexExitInterview } from '@/lib/knowledge-transfer/indexing/semantic-indexer';
import { isIndexingAllowed } from '@/lib/knowledge-transfer/governance/consent-controls';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Trigger semantic indexing',
      description: 'Re-triggers vector indexing for a published interview. Respects governance and consent gates.',
    },
  },
  async ({ params, organizationId, userId }) => {
    const [interview] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!interview) throw ApiError.notFound('Exit interview');
    if (interview.status !== 'published') {
      throw ApiError.conflict('Only published interviews can be indexed');
    }

    const allowed = isIndexingAllowed(
      interview.sensitivityLevel as never ?? 'public_internal',
      interview.consentGranted ?? false,
    );
    if (!allowed) {
      return {
        data: { indexed: false, reason: `Governance gate: sensitivity='${interview.sensitivityLevel}', consentGranted=${interview.consentGranted}` },
      };
    }

    const result = await indexExitInterview(params.id, organizationId!, userId!);

    if (result.indexed) {
      await db.insert(exitInterviewEvents).values({
        interviewId: params.id,
        organizationId: organizationId!,
        eventType: 'indexed',
        actorUserId: userId!,
        notes: 'Manual semantic re-index triggered',
        payload: { knowledgeBaseId: result.knowledgeBaseId },
      });
    }

    return { data: result };
  },
);
