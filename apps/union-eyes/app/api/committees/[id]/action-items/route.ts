/**
 * GET /api/committees/[id]/action-items — List action items
 * POST /api/committees/[id]/action-items — Create action item
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import {
  createActionItem,
  listActionItems,
} from "@/lib/services/committee-workspace-service";

const createSchema = z.object({
  title: z.string().min(3).max(500),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  meetingId: z.string().uuid().optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: "member" },
    openapi: { tags: ["Committees"], summary: "List action items" },
  },
  async ({ organizationId: _organizationId, params, request }) => {
    const { id: committeeId } = params as { id: string };
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") ?? undefined;
    const assignedTo = searchParams.get("assignedTo") ?? undefined;
    const includeCompleted = searchParams.get("includeCompleted") === "true";

    return listActionItems(committeeId, { status, assignedTo, includeCompleted });
  }
);

export const POST = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: createSchema,
    openapi: { tags: ["Committees"], summary: "Create action item" },
  },
  async ({ body, organizationId, userId, params }) => {
    const { id: committeeId } = params as { id: string };

    return createActionItem({
      ...body,
      committeeId,
      organizationId: organizationId!,
      createdBy: userId,
    });
  }
);
