// cognition-governance-ci: allow-route-bypass — Per-interview governance metadata.
/**
 * PATCH /api/exit-interviews/[id]/governance
 *
 * Updates the sensitivity classification of an exit interview, or records the withdrawal of the retiree's consent.
 * Consent is the retiring employee's to give: this route refuses to record a grant (409) and only records a withdrawal,
 * which also takes the interview's knowledge-base copy out of service in the same transaction. A reclassification to a level that is
 * never indexed does the same. Taking the copy out of service deactivates it and erases its embedding. All changes are audit-logged.
 *
 * Lowering a published interview out of legal_sensitive or executive_confidential does not apply immediately: it is
 * recorded as a pending request (pendingApproval: true, no row changed) that a DIFFERENT admin must approve via
 * approveReclassificationEventId before the level actually changes (DEF-0B7-EXC-CONSENT-IS-ADMIN-ASSERTED-AND-RECLASSIFICATION-HAS-NO-REVIEW).
 *
 * A caller that read the interview before this call may pass expectedUpdatedAt; a mismatch (someone else changed it
 * since) is rejected with 409 rather than silently overwriting a change this caller never saw.
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
import { SENSITIVITY_LEVELS, requiresReclassificationApproval } from '@/lib/knowledge-transfer/governance/consent-controls';
import { eraseKnowledgeBaseEmbeddings } from '@/lib/ai/knowledge-base-embeddings';

export const dynamic = 'force-dynamic';

const governanceSchema = z.object({
  sensitivityLevel: z
    .enum(['public_internal', 'restricted', 'privileged', 'legal_sensitive', 'executive_confidential'])
    .optional(),
  consentGranted: z.boolean().optional(),
  consentNotes: z.string().max(1000).optional(),
  /** Id of a prior PATCH's pending-approval event this call approves. Must come from a different admin than the one who requested it. */
  approveReclassificationEventId: z.string().uuid().optional(),
  /** Optimistic concurrency: the interview's updatedAt this caller last read. A mismatch means someone else changed it since. */
  expectedUpdatedAt: z.string().datetime().optional(),
}).strict();

interface ReclassificationRequestPayload {
  kind: 'reclassification_requested';
  requestedLevel: string;
  previousLevel: string;
  requestedBy: string;
  reason: string | null;
}

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
    if (!body?.sensitivityLevel && body?.consentGranted === undefined && !body?.approveReclassificationEventId) {
      throw ApiError.badRequest('At least one governance field must be provided');
    }

    const [existing] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!existing) throw ApiError.notFound('Exit interview');

    // Optimistic concurrency: a caller acting on a stale read must not silently overwrite a change it never saw.
    if (body?.expectedUpdatedAt && new Date(body.expectedUpdatedAt).getTime() !== new Date(existing.updatedAt).getTime()) {
      throw ApiError.conflict('This interview changed since it was last read; reload and retry');
    }

    // Retiree consent is not created by an administrator's checkbox or note. There is no verified record of the retiring
    // employee's own instruction to check here, so a grant is refused and nothing is written. Withdrawal stays available.
    if (body?.consentGranted === true) {
      throw ApiError.conflict('Retiree consent cannot be granted through this route; no consent was recorded');
    }

    // Approving a pending reclassification request: load the request event, verify it is still live and that the
    // approver is not the requester, then apply the previously-requested level. No other field may be changed in
    // the same call - approval is its own, narrow action.
    if (body?.approveReclassificationEventId) {
      const [requestEvent] = await db
        .select()
        .from(exitInterviewEvents)
        .where(and(
          eq(exitInterviewEvents.id, body.approveReclassificationEventId),
          eq(exitInterviewEvents.interviewId, params.id),
          eq(exitInterviewEvents.organizationId, organizationId!),
        ))
        .limit(1);

      if (!requestEvent || requestEvent.eventType !== 'governance_updated') {
        throw ApiError.notFound('Pending reclassification request');
      }
      const payload = requestEvent.payload as unknown as ReclassificationRequestPayload | undefined;
      if (!payload || payload.kind !== 'reclassification_requested') {
        throw ApiError.notFound('Pending reclassification request');
      }
      if (payload.requestedBy === userId) {
        throw ApiError.conflict('A different administrator must approve this reclassification');
      }
      if (payload.previousLevel !== existing.sensitivityLevel) {
        throw ApiError.conflict('The interview\'s sensitivity level changed since this request was made; it is no longer valid');
      }

      const now = new Date();
      const updated = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
        const [row] = await tx
          .update(exitInterviews)
          .set({ sensitivityLevel: payload.requestedLevel, updatedAt: now, updatedBy: userId } as never)
          .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
          .returning();
        if (!row) throw ApiError.notFound('Exit interview');

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
          previousSensitivity: payload.previousLevel,
          newSensitivity: row.sensitivityLevel,
          approvedRequestEventId: body.approveReclassificationEventId,
          requestedBy: payload.requestedBy,
          deactivatedKnowledgeBaseIds,
          erasedEmbeddingIds,
        };
        await tx.insert(exitInterviewEvents).values({
          interviewId: params.id,
          organizationId: organizationId!,
          eventType: 'governance_updated',
          actorUserId: userId!,
          notes: body?.consentNotes ?? 'Reclassification request approved',
          payload: { kind: 'reclassification_approved', ...change },
        });
        await persistAtomicAudit(tx, {
          organizationId: organizationId!,
          userId: userId!,
          action: 'exit_interview.governance_reclassification_approved',
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
    }

    // Lowering a published interview out of legal_sensitive/executive_confidential is deferred to a second admin:
    // record the request and return without changing the row.
    if (body?.sensitivityLevel && requiresReclassificationApproval(existing.sensitivityLevel, body.sensitivityLevel)) {
      const requestPayload: ReclassificationRequestPayload = {
        kind: 'reclassification_requested',
        requestedLevel: body.sensitivityLevel,
        previousLevel: existing.sensitivityLevel,
        requestedBy: userId!,
        reason: body.consentNotes ?? null,
      };
      const requestEventId = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
        const [requestEvent] = await tx
          .insert(exitInterviewEvents)
          .values({
            interviewId: params.id,
            organizationId: organizationId!,
            eventType: 'governance_updated',
            actorUserId: userId!,
            notes: body.consentNotes ?? 'Reclassification requested, pending a second administrator\'s approval',
            payload: requestPayload as never,
          })
          .returning();
        await persistAtomicAudit(tx, {
          organizationId: organizationId!,
          userId: userId!,
          action: 'exit_interview.governance_reclassification_requested',
          resourceType: 'exit_interviews',
          resourceId: params.id,
          details: requestPayload as never,
        });
        return requestEvent?.id ?? null;
      });

      return {
        data: existing,
        pendingApproval: true,
        pendingApprovalEventId: requestEventId,
        message: 'This change lowers the interview out of its most restrictive tier and requires a different administrator\'s approval. Nothing has changed yet.',
      };
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

