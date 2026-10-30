// cognition-governance-ci: allow-route-bypass — Per-interview governance metadata.
/**
 * PATCH /api/exit-interviews/[id]/governance
 *
 * Updates consent status and sensitivity classification for an exit interview.
 * All governance changes are audit-logged.
 *
 * Access: admin+
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { exitInterviews, exitInterviewEvents, knowledgeBase } from '@/db/schema';
import { SENSITIVITY_LEVELS } from '@/lib/knowledge-transfer/governance/consent-controls';

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

    // An administrator cannot create retiree consent by ticking a box or
    // entering free-text notes. The approved policy requires a verifiable
    // signed instruction from the retiring member. The authoritative
    // instruction verification store is not yet integrated here; fail closed
    // rather than issue an invalid grant. Revocation remains available.
    if (body?.consentGranted === true) {
      throw ApiError.conflict('Retiree consent grant requires verified signed instruction; no consent was recorded');
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

      // Immediately hide its knowledge-base derivative in the SAME tenant
      // transaction as consent withdrawal; do not let a revoked copy remain
      // in a privileged shared search surface. Retention/purge and legal hold
      // are separately governed and this operation does not delete evidence.
      let hiddenKnowledgeAssetId: string | null = null;
      if (body?.consentGranted === false && row.knowledgeBaseId) {
        const [hidden] = await tx.update(knowledgeBase)
          .set({ isActive: false, updatedAt: now })
          .where(and(
            eq(knowledgeBase.id, row.knowledgeBaseId),
            eq(knowledgeBase.organizationId, organizationId!),
            eq(knowledgeBase.sourceType, 'exit_interview'),
            eq(knowledgeBase.sourceId, row.id),
          )).returning({ id: knowledgeBase.id });
        hiddenKnowledgeAssetId = hidden?.id ?? null;
      }

      const change = {
        previousSensitivity: existing.sensitivityLevel,
        newSensitivity: row.sensitivityLevel,
        previousConsent: existing.consentGranted,
        newConsent: row.consentGranted,
        derivedKnowledgeAssetDisabled: hiddenKnowledgeAssetId,
        derivedRemovalReviewRequired: body?.consentGranted === false,
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
