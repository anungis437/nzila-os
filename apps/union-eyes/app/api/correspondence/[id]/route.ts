/**
 * GET    /api/correspondence/[id] — Get correspondence details
 * PATCH  /api/correspondence/[id] — Update draft correspondence
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  getCorrespondenceWithDetails,
  updateCorrespondence,
} from "@/lib/services/correspondence-service";

const updateSchema = z.object({
  subject: z.string().min(3).max(500).optional(),
  body: z.string().min(1).optional(),
  type: z
    .enum(["letter", "notice", "memo", "demand", "response", "proposal", "agreement", "report", "other"])
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedSignerId: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: "steward" },
    openapi: { tags: ["Correspondence"], summary: "Get correspondence details" },
  },
  async ({ params, organizationId }) => {
    const id = params?.id as string;
    if (!id) throw ApiError.badRequest("Missing correspondence ID");

    const item = await getCorrespondenceWithDetails(id);
    if (!item) throw ApiError.notFound("Correspondence");
    if (item.organizationId !== organizationId) throw ApiError.notFound("Correspondence");

    return { data: item };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: updateSchema,
    openapi: { tags: ["Correspondence"], summary: "Update draft correspondence" },
  },
  async ({ params, organizationId, userId, body, user, request }) => {
    const id = params?.id as string;
    if (!id) throw ApiError.badRequest("Missing correspondence ID");

    // Verify org ownership
    const existing = await getCorrespondenceWithDetails(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw ApiError.notFound("Correspondence");
    }

    const updated = await updateCorrespondence({
      id,
      ...body,
      actorUserId: userId!,
      actorName: user?.name ?? undefined,
      actorRole: user?.role ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return { data: updated };
  },
);
