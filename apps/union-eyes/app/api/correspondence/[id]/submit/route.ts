import { CORRESPONDENCE_STAFF_ROLES } from "@/lib/correspondence/roles";
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
    rlsOrgContext: true,
    auth: { required: true, roles: CORRESPONDENCE_STAFF_ROLES },
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
