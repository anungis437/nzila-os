/**
 * POST /api/correspondence/[id]/submit — Submit for review
 */

import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  getCorrespondenceById,
  submitForReview,
} from "@/lib/services/correspondence-service";

export const POST = withApi(
  {
    auth: { required: true, minRole: "steward" },
    openapi: { tags: ["Correspondence"], summary: "Submit for review" },
  },
  async ({ params, organizationId, userId, user, request }) => {
    const id = params?.id as string;
    if (!id) throw ApiError.badRequest("Missing correspondence ID");

    const existing = await getCorrespondenceById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw ApiError.notFound("Correspondence");
    }

    const updated = await submitForReview(id, {
      actorUserId: userId!,
      actorName: user?.name ?? undefined,
      actorRole: user?.role ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return { data: updated };
  },
);
