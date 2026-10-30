// cognition-governance-ci: allow-route-bypass — Publication workflow.
import { and, eq, inArray } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { exitInterviews, exitInterviewEvents, knowledgeBase } from '@/db/schema';
import { indexExitInterview } from '@/lib/knowledge-transfer/indexing/semantic-indexer';
import { extractExpertise, flattenExpertiseTags } from '@/lib/knowledge-transfer/expertise/expertise-extractor';
import { isIndexingAllowed } from '@/lib/knowledge-transfer/governance/consent-controls';
import { decidePublication } from '@/lib/knowledge-transfer/governance/publication-policy';

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

    const decision = decidePublication({
      sensitivityLevel: existing.sensitivityLevel ?? null,
      consentGranted: existing.consentGranted ?? null,
      createdBy: existing.createdBy ?? null,
      reviewedBy: existing.reviewedBy ?? null,
      publisher: userId!,
    });
    if (!decision.allowed) throw ApiError.conflict(decision.reason);

    const now = new Date();
    // The knowledge-base record, the status change, the event and the audit commit together; the status predicate
    // keeps two concurrent publications from creating two records.
    const { kbRecord, updated } = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      // Only a level that permits indexing is copied into the shared knowledge base, and the copy omits the retiring
      // employee's name. Its sensitivity and consent stay with the interview (sourceId) and are applied on every read.
      const [kb] = decision.copyToKnowledgeBase ? await tx
        .insert(knowledgeBase)
        .values({
          organizationId: organizationId!,
          title: existing.title,
          documentType: 'guide',
          content: [
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
        .returning() : [undefined];

      const [row] = await tx
        .update(exitInterviews)
        .set({
          status: 'published',
          reviewedAt: existing.reviewedAt ?? now,
          reviewedBy: existing.reviewedBy ?? userId!,
          publishedAt: now,
          knowledgeBaseId: kb?.id ?? null,
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
        payload: { knowledgeBaseId: kb?.id ?? null },
      });
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'exit_interview.publish',
        resourceType: 'exit_interviews',
        resourceId: params.id,
        details: { knowledgeBaseId: kb?.id ?? null, sensitivityLevel: existing.sensitivityLevel, copiedToKnowledgeBase: Boolean(kb) },
      });
      return { kbRecord: kb, updated: row };
    });

    // --- Intelligence Layer: expertise extraction + semantic indexing ---
    // Not part of the publish response, and not run at all unless the interview's level and consent allow it: the text is
    // not handed to the AI control plane for an interview that may not be indexed. The intent and the outcome are audited
    // and a failure is recorded, not swallowed; indexing can be retried through POST /[id]/index.
    if (decision.extractExpertise) {
      const organization = organizationId!;
      const actor = userId!;
      const interviewId = params.id;
      const auditStep = (action: string, details: Record<string, unknown>) =>
        withRLSContext({ organizationId: organization }, (tx) =>
          persistAtomicAudit(tx, { organizationId: organization, userId: actor, action, resourceType: 'exit_interviews', resourceId: interviewId, details }),
        );
      setImmediate(async () => {
        try {
          await auditStep('exit_interview.ai_extraction.requested', { sensitivityLevel: existing.sensitivityLevel, dataClass: 'internal' });
          // Publication and AI extraction run in different moments. Re-read
          // the CURRENT consent/classification before disclosure: a revoke
          // after publication must defeat this stale background task.
          const [current] = await withRLSContext({ organizationId: organization }, async (tx) =>
            tx.select().from(exitInterviews).where(and(
              eq(exitInterviews.id, interviewId),
              eq(exitInterviews.organizationId, organization),
              eq(exitInterviews.status, 'published'),
              eq(exitInterviews.consentGranted, true),
            )).limit(1),
          );
          if (!current || !isIndexingAllowed(current.sensitivityLevel, current.consentGranted)) {
            await auditStep('exit_interview.ai_extraction.skipped', { reason: 'Current consent, status or sensitivity forbids model use' });
            return;
          }
          const expertiseProfile = await extractExpertise(current);
          const expertiseTags = flattenExpertiseTags(expertiseProfile);
          const riskScore = expertiseProfile.continuitySensitivity === 'critical' ? 90
            : expertiseProfile.continuitySensitivity === 'high' ? 70
            : expertiseProfile.continuitySensitivity === 'medium' ? 40
            : 15;

          // Only a published interview is updated, and the update is audited with the extraction outcome.
          await withRLSContext({ organizationId: organization }, async (tx) => {
            const [updated] = await tx
              .update(exitInterviews)
              .set({ expertiseTags, continuityRiskScore: riskScore, continuityRiskFlags: expertiseProfile.undocumentedWorkflows, updatedAt: new Date() })
              .where(and(
                eq(exitInterviews.id, interviewId),
                eq(exitInterviews.organizationId, organization),
                eq(exitInterviews.status, 'published'),
                eq(exitInterviews.consentGranted, true),
                inArray(exitInterviews.sensitivityLevel, ['public_internal', 'restricted']),
              )).returning({ id: exitInterviews.id });
            if (!updated) throw new Error('Model outcome not recorded because consent or classification changed');
            await persistAtomicAudit(tx, {
              organizationId: organization,
              userId: actor,
              action: 'exit_interview.ai_extraction.completed',
              resourceType: 'exit_interviews',
              resourceId: interviewId,
              details: { tags: expertiseTags.length, riskScore },
            });
          });

          if (isIndexingAllowed(current.sensitivityLevel, current.consentGranted)) {
            await indexExitInterview(interviewId, organization, actor);
          }
        } catch (error) {
          await auditStep('exit_interview.ai_extraction.failed', { reason: error instanceof Error ? error.name : 'unknown' }).catch(() => undefined);
        }
      });
    }
    // --- end Intelligence Layer ---

    return { data: updated, knowledgeAsset: kbRecord };
  },
);
