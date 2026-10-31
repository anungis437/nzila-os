/**
 * GET /api/committees/[id]/action-items — List action items
 * POST /api/committees/[id]/action-items — Create action item
 */

import { z } from "zod";
import { requireCommitteeReader } from "@/lib/services/committee-read-access";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import { assertOrganizationMembers } from "@/lib/services/org-member-references";
import {
  createActionItem,
  listActionItems,
  requireCommitteeScope,
} from "@/lib/services/committee-workspace-service";

const createSchema = z.object({
  title: z.string().min(3).max(500),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  meetingId: z.guid().optional(),
});

export const GET = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "member" },
    openapi: { tags: ["Committees"], summary: "List action items" },
  },
  async ({ organizationId, userId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeReader(organizationId, committeeId, userId);
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") ?? undefined;
    const assignedTo = searchParams.get("assignedTo") ?? undefined;
    const includeCompleted = searchParams.get("includeCompleted") === "true";

    return listActionItems(committeeId, { status, assignedTo, includeCompleted });
  }
);

export const POST = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "steward" },
    body: createSchema,
    openapi: { tags: ["Committees"], summary: "Create action item" },
  },
  async ({ body, organizationId, userId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeScope(organizationId, committeeId, { meetingId: body.meetingId });
    await assertOrganizationMembers([body.assignedTo], organizationId);

    return createActionItem({
      ...body,
      committeeId,
      organizationId,
      createdBy: userId,
    });
  }
);
