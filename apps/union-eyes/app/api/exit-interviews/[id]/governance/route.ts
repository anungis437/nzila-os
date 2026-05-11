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
import { exitInterviews, exitInterviewEvents } from '@/db/schema';
import { SENSITIVITY_LEVELS } from '@/lib/knowledge-transfer/governance/consent-controls';

export const dynamic = 'force-dynamic';

const governanceSchema = z.object({
  sensitivityLevel: z
    .enum(['public_internal', 'restricted', 'privileged', 'legal_sensitive', 'executive_confidential'])
    .optional(),
  consentGranted: z.boolean().optional(),
  consentNotes: z.string().max(1000).optional(),
});

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

    const [updated] = await db
      .update(exitInterviews)
      .set(updates as never)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .returning();

    await db.insert(exitInterviewEvents).values({
      interviewId: params.id,
      organizationId: organizationId!,
      eventType: 'governance_updated',
      actorUserId: userId!,
      notes: body?.consentNotes ?? 'Governance controls updated',
      payload: {
        previousSensitivity: existing.sensitivityLevel,
        newSensitivity: updated.sensitivityLevel,
        previousConsent: existing.consentGranted,
        newConsent: updated.consentGranted,
      },
    });

    const indexingEligible = SENSITIVITY_LEVELS[updated.sensitivityLevel]?.indexingAllowed && updated.consentGranted;

    return {
      data: updated,
      indexingEligible,
      sensitivityDescription: SENSITIVITY_LEVELS[updated.sensitivityLevel]?.description,
    };
  },
);
