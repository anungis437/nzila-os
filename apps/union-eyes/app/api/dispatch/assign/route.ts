/**
 * Dispatch Assignment API
 *
 * POST /api/dispatch/assign — Assign workers to a dispatch request
 */

import { z } from "zod";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { assignWorkersToDispatch } from "@/lib/services/dispatch-engine";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";

const assignSchema = z.object({
  requestId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()).min(1),
});

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;

  try {
    const canAssign = await hasMinRole("officer");
    if (!canAssign) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires officer role or above");
    }

    const body = await request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    // The assignments, the request status change and the audit record commit together.
    const assignments = await withRLSContext({ organizationId }, async (tx) => {
      const rows = await assignWorkersToDispatch(
        organizationId,
        parsed.data.requestId,
        parsed.data.memberIds,
        tx,
      );
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: "dispatch.assign",
        resourceType: "dispatch_assignments",
        resourceId: parsed.data.requestId,
        details: { assignedMembers: parsed.data.memberIds },
      });
      return rows;
    });

    return standardSuccessResponse(assignments);
  } catch (error) {
    if (error instanceof Error && error.message === "Dispatch request not found.") {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Dispatch request not found");
    }
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to assign dispatch workers");
  }
});
