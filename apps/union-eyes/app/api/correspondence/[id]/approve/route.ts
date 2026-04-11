/**
 * POST /api/correspondence/[id]/approve — Approve correspondence for signing
 */

import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  getCorrespondenceById,
  approveCorrespondence,
} from "@/lib/services/correspondence-service";

export const POST = withApi(
  {
    auth: { required: true, minRole: "officer" },
    openapi: { tags: ["Correspondence"], summary: "Approve correspondence" },
  },
  async ({ params, organizationId, userId, user, request }) => {
    const id = params?.id as string;
    if (!id) throw ApiError.badRequest("Missing correspondence ID");

    const existing = await getCorrespondenceById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw ApiError.notFound("Correspondence");
    }

    const updated = await approveCorrespondence(id, {
      actorUserId: userId!,
      actorName: user?.name ?? undefined,
      actorRole: user?.role ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return { data: updated };
  },
);
