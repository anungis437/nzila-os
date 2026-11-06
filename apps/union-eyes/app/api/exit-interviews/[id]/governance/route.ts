// cognition-governance-ci: allow-route-bypass — Per-interview governance metadata.
/**
 * PATCH /api/exit-interviews/[id]/governance
 *
 * Updates the sensitivity classification of an exit interview, or records the withdrawal of the retiree's consent.
 * Consent is the retiring employee's to give: this route refuses to record a grant (409) and only records a withdrawal,
 * which also takes the interview's knowledge-base copy out of service in the same transaction. A reclassification to a level that is
 * never indexed does the same. Taking the copy out of service deactivates it and erases its embedding. All changes are audit-logged.
 *
 * Access: admin+
 */

import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { exitInterviews, exitInterviewEvents, knowledgeBase } from '@/db/schema';
import { SENSITIVITY_LEVELS } from '@/lib/knowledge-transfer/governance/consent-controls';
import { eraseKnowledgeBaseEmbeddings } from '@/lib/ai/knowledge-base-embeddings';

export const dynamic = 'force-dynamic';

const governanceSchema = z.object({
  sensitivityLevel: z
    .enum(['public_internal', 'restricted', 'privileged', 'legal_sensitive', 'executive_confidential'])
    .optional(),
  consentGranted: z.boolean().optional(),
  consentNotes: z.string().max(1000).optional(),
}).strict();

export const PATCH = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: 'admin' },
    entitlement: 'union_knowledge_suite',
    body: governanceSchema,
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Update governance controls',
      description: 'Updates sensitivity classification and retiree consent status. Audit-logged.',
    },
  },
  async ({ params, body, organizationId, userId }) => {
    if (!body?.sensitivityLevel && body?.consentGranted === undefined) {
      throw ApiError.badRequest('At least one governance field must be provided');
    }

    const [existing] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!existing) throw ApiError.notFound('Exit interview');

    // Retiree consent is not created by an administrator's checkbox or note. There is no verified record of the retiring
    // employee's own instruction to check here, so a grant is refused and nothing is written. Withdrawal stays available.
    if (body?.consentGranted === true) {
      throw ApiError.conflict('Retiree consent cannot be granted through this route; no consent was recorded');
    }

    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: now, updatedBy: userId };

    if (body?.sensitivityLevel) updates.sensitivityLevel = body.sensitivityLevel;
    if (body?.consentGranted !== undefined) {
      updates.consentGranted = body.consentGranted;
      if (body.consentGranted) {
        updates.consentGrantedAt = now;
        updates.consentGrantedBy = userId;
      } else {
        updates.consentGrantedAt = null;
        updates.consentGrantedBy = null;
      }
    }

    // The classification or consent change, its event and its audit record commit together.
    const updated = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const [row] = await tx
        .update(exitInterviews)
        .set(updates as never)
        .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
        .returning();
      if (!row) throw ApiError.notFound('Exit interview');

      // An interview that may no longer be indexed (consent withdrawn or never recorded, or a level that is never indexed) takes its
      // knowledge-base copy out of service in the same transaction: the copy is deactivated and its embedding, a derivative of the
      // interview text, is erased. The row and its text are not deleted: retention and legal hold are decided elsewhere.
      let deactivatedKnowledgeBaseIds: string[] = [];
      let erasedEmbeddingIds: string[] = [];
      const stillIndexable = Boolean(SENSITIVITY_LEVELS[row.sensitivityLevel]?.indexingAllowed) && row.consentGranted === true;
      if (!stillIndexable) {
        const linked = [and(eq(knowledgeBase.sourceType, 'exit_interview'), eq(knowledgeBase.sourceId, row.id))];
        if (row.knowledgeBaseId) linked.push(eq(knowledgeBase.id, row.knowledgeBaseId));
        const hidden = await tx
          .update(knowledgeBase)
          .set({ isActive: false, updatedAt: now })
          .where(and(eq(knowledgeBase.organizationId, organizationId!), eq(knowledgeBase.isActive, true), or(...linked)))
          .returning({ id: knowledgeBase.id });
        deactivatedKnowledgeBaseIds = hidden.map((h) => h.id);
        erasedEmbeddingIds = await eraseKnowledgeBaseEmbeddings(tx, {
          organizationId: organizationId!,
          sourceType: 'exit_interview',
          sourceId: row.id,
          ids: row.knowledgeBaseId ? [row.knowledgeBaseId] : [],
        });
      }

      const change = {
        previousSensitivity: existing.sensitivityLevel,
        newSensitivity: row.sensitivityLevel,
        previousConsent: existing.consentGranted,
        newConsent: row.consentGranted,
        deactivatedKnowledgeBaseIds,
        erasedEmbeddingIds,
      };
      await tx.insert(exitInterviewEvents).values({
        interviewId: params.id,
        organizationId: organizationId!,
        eventType: 'governance_updated',
        actorUserId: userId!,
        notes: body?.consentNotes ?? 'Governance controls updated',
        payload: change,
      });
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'exit_interview.governance_update',
        resourceType: 'exit_interviews',
        resourceId: params.id,
        details: change,
      });
      return row;
    });

    const indexingEligible = SENSITIVITY_LEVELS[updated.sensitivityLevel]?.indexingAllowed && updated.consentGranted;

    return {
      data: updated,
      indexingEligible,
      sensitivityDescription: SENSITIVITY_LEVELS[updated.sensitivityLevel]?.description,
    };
  },
);
