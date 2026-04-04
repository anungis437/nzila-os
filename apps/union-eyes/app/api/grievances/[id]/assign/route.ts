/**
 * Grievance Assignment API
 *
 * POST /api/grievances/[id]/assign — Assign a steward to a grievance
 */

import { z } from "zod";
import { db } from "@/db/db";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditDataMutation } from "@/lib/audit-logger";
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { assignSteward } from "@/lib/services/steward-assignment";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

const assignSchema = z.object({
  stewardId: z.string().uuid(),
});

export const PATCH = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");
    const canAssign = await hasMinRole("officer");
    if (!canAssign) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires officer role or above");
    }

    const body = await request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    // Verify grievance belongs to org
    const [grievance] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, params.id),
          eq(grievances.organizationId, organizationId),
        ),
      );

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
    }

    const assignment = await assignSteward(params.id, parsed.data.stewardId);

    // Update grievance assigned rep
    await withRLSContext(async () => {
      await db
        .update(grievances)
        .set({ unionRepId: parsed.data.stewardId, updatedAt: new Date() })
        .where(eq(grievances.id, params.id));

      // Emit event
      await db.insert(grievanceEvents).values({
        grievanceId: params.id,
        eventType: "assigned",
        actorUserId: userId,
        notes: `Steward ${parsed.data.stewardId} assigned`,
      });
    });

    // Audit
    await auditDataMutation({
      userId,
      organizationId,
      resource: "grievances",
      action: "update",
      resourceId: params.id,
      newState: { assignedStewardId: parsed.data.stewardId },
    });

    buildUnionEvidencePack({
      actionType: 'GRIEVANCE_ASSIGNED',
      orgId: organizationId,
      actorId: userId,
      artifacts: [{ type: 'grievance', data: { grievanceId: params.id, stewardId: parsed.data.stewardId } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'GRIEVANCE_ASSIGNED' }));

    return standardSuccessResponse(assignment);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to assign steward");
  }
});
