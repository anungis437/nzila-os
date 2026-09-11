/**
 * Dispatch Assignment API
 *
 * POST /api/dispatch/assign — Assign workers to a dispatch request
 */

import { z } from "zod";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditDataMutation } from "@/lib/audit-logger";
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

    const assignments = await assignWorkersToDispatch(
      organizationId,
      parsed.data.requestId,
      parsed.data.memberIds,
    );

    await auditDataMutation({
      userId,
      organizationId,
      resource: "dispatch_assignments",
      action: "create",
      resourceId: parsed.data.requestId,
      newState: { assignedMembers: parsed.data.memberIds },
    });

    return standardSuccessResponse(assignments);
  } catch (error) {
    if (error instanceof Error && error.message === "Dispatch request not found.") {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Dispatch request not found");
    }
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to assign dispatch workers");
  }
});
