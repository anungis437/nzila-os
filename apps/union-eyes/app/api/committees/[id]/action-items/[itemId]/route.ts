/**
 * PATCH /api/committees/[id]/action-items/[itemId] — Update an action item
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import { updateActionItem } from "@/lib/services/committee-workspace-service";

const updateSchema = z.object({
  title: z.string().min(3).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "deferred", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  resolution: z.string().optional(),
});

export const PATCH = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: updateSchema,
    openapi: { tags: ["Committees"], summary: "Update action item" },
  },
  async ({ body, userId, params }) => {
    const { itemId } = params as { id: string; itemId: string };

    const updated = await updateActionItem(itemId, {
      ...body,
      updatedBy: userId ?? undefined,
    });
    if (!updated) throw ApiError.notFound("Action item");

    return updated;
  }
);
