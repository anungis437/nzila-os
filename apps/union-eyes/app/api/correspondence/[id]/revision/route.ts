/**
 * POST /api/correspondence/[id]/revision — Send back for revision
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  getCorrespondenceById,
  requestRevision,
} from "@/lib/services/correspondence-service";

const revisionSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: "officer" },
    body: revisionSchema,
    openapi: { tags: ["Correspondence"], summary: "Request revision" },
  },
  async ({ params, organizationId, userId, body, user, request }) => {
    const id = params?.id as string;
    if (!id) throw ApiError.badRequest("Missing correspondence ID");

    const existing = await getCorrespondenceById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw ApiError.notFound("Correspondence");
    }

    const updated = await requestRevision(id, body.reason, {
      actorUserId: userId!,
      actorName: user?.name ?? undefined,
      actorRole: user?.role ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return { data: updated };
  },
);
