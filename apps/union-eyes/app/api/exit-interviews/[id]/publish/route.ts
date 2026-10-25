// cognition-governance-ci: allow-route-bypass — Publication workflow.
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { exitInterviews, exitInterviewEvents, knowledgeBase } from '@/db/schema';
import { indexExitInterview } from '@/lib/knowledge-transfer/indexing/semantic-indexer';
import { extractExpertise, flattenExpertiseTags } from '@/lib/knowledge-transfer/expertise/expertise-extractor';
import { isIndexingAllowed } from '@/lib/knowledge-transfer/governance/consent-controls';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Publish exit interview',
      description: 'Publishes an approved interview into the searchable knowledge base.',
    },
  },
  async ({ params, organizationId, userId }) => {
    const [existing] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!existing) {
      throw ApiError.notFound('Exit interview');
    }

    if (existing.status === 'published') {
      return { data: existing, alreadyPublished: true };
    }

    // Publication follows an independent review (review refuses the author); a submitted interview is not published
    // directly.
    if (existing.status !== 'reviewed') {
      throw ApiError.conflict('Only reviewed interviews can be published');
    }

    const now = new Date();
    // The knowledge-base record, the status change, the event and the audit commit together; the status predicate
    // keeps two concurrent publications from creating two records.
    const { kbRecord, updated } = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const [kb] = await tx
        .insert(knowledgeBase)
        .values({
          organizationId: organizationId!,
          title: existing.title,
          documentType: 'guide',
          content: [
            `Retiring employee: ${existing.retiringEmployeeName}`,
            `Role in union: ${existing.roleInUnion}`,
            `Years of service: ${existing.yearsOfService}`,
            `Key lessons: ${existing.keyLessons}`,
            existing.bestPractices ? `Best practices: ${existing.bestPractices}` : '',
            existing.bargainingAdvice ? `Bargaining advice: ${existing.bargainingAdvice}` : '',
            existing.mediationAdvice ? `Mediation advice: ${existing.mediationAdvice}` : '',
            existing.incomingOfficerAdvice ? `Incoming officer advice: ${existing.incomingOfficerAdvice}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          summary: existing.summary,
          sourceType: 'exit_interview',
          sourceId: existing.id,
          tags: existing.topics,
          keywords: existing.topics,
          isPublic: false,
          isActive: true,
          createdBy: userId!,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const [row] = await tx
        .update(exitInterviews)
        .set({
          status: 'published',
          reviewedAt: existing.reviewedAt ?? now,
          reviewedBy: existing.reviewedBy ?? userId!,
          publishedAt: now,
          knowledgeBaseId: kb.id,
          updatedAt: now,
          updatedBy: userId!,
        })
        .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!), eq(exitInterviews.status, 'reviewed')))
        .returning();
      if (!row) throw ApiError.conflict('The interview is no longer awaiting publication');

      await tx.insert(exitInterviewEvents).values({
        interviewId: params.id,
        organizationId: organizationId!,
        eventType: 'published',
        actorUserId: userId!,
        notes: 'Exit interview published to knowledge base',
        payload: { knowledgeBaseId: kb.id },
      });
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'exit_interview.publish',
        resourceType: 'exit_interviews',
        resourceId: params.id,
        details: { knowledgeBaseId: kb.id },
      });
      return { kbRecord: kb, updated: row };
    });

    // --- Intelligence Layer: expertise extraction + semantic indexing ---
    // Run non-blocking — publish response is not gated on these
    setImmediate(async () => {
      try {
        // Extract expertise tags before indexing (enriches vector content)
        const expertiseProfile = await extractExpertise(existing);
        const expertiseTags = flattenExpertiseTags(expertiseProfile);
        const riskScore = expertiseProfile.continuitySensitivity === 'critical' ? 90
          : expertiseProfile.continuitySensitivity === 'high' ? 70
          : expertiseProfile.continuitySensitivity === 'medium' ? 40
          : 15;

        await db
          .update(exitInterviews)
          .set({
            expertiseTags,
            continuityRiskScore: riskScore,
            continuityRiskFlags: expertiseProfile.undocumentedWorkflows,
            updatedAt: new Date(),
          })
          .where(eq(exitInterviews.id, params.id));

        // Semantic index if governance permits
        const shouldIndex = isIndexingAllowed(
          existing.sensitivityLevel as never ?? 'public_internal',
          existing.consentGranted ?? false,
        );
        if (shouldIndex) {
          await indexExitInterview(params.id, organizationId!, userId!);
        }
      } catch {
        // Non-critical — indexing can be retried via POST /[id]/index
      }
    });
    // --- end Intelligence Layer ---

    return { data: updated, knowledgeAsset: kbRecord };
  },
);
