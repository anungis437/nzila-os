/**
 * POST /api/correspondence/[id]/cancel — Cancel correspondence
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import { zUUID } from "@/lib/api/schemas";
import {
  getCorrespondenceById,
  cancelCorrespondence,
} from "@/lib/services/correspondence-service";

const cancelSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export const POST = withApi(
  {
    // The organization-ownership read and the cancellation are both tenant work: they run in the caller's own tenant transaction.
    rlsOrgContext: true,
    auth: { required: true, minRole: "steward" },
    body: cancelSchema,
    openapi: { tags: ["Correspondence"], summary: "Cancel correspondence" },
  },
  async ({ params, organizationId, userId, body, user, request }) => {
    const id = params?.id as string;
    if (!id) throw ApiError.badRequest("Missing correspondence ID");
    if (!zUUID.safeParse(id).success) throw ApiError.badRequest("Invalid correspondence ID");

    const existing = await getCorrespondenceById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw ApiError.notFound("Correspondence");
    }

    const updated = await cancelCorrespondence(id, body.reason, {
      actorUserId: userId!,
      actorName: user?.name ?? undefined,
      actorRole: user?.role ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return { data: updated };
  },
);
