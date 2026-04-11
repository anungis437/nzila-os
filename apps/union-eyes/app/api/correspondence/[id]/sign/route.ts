/**
 * POST /api/correspondence/[id]/sign — Affix the signer's stored signature
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  getCorrespondenceById,
  signCorrespondence,
} from "@/lib/services/correspondence-service";

const signSchema = z.object({
  signatureId: z.string().uuid(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: "officer" },
    body: signSchema,
    openapi: { tags: ["Correspondence"], summary: "Sign correspondence" },
  },
  async ({ params, organizationId, userId, body, user, request }) => {
    const id = params?.id as string;
    if (!id) throw ApiError.badRequest("Missing correspondence ID");

    const existing = await getCorrespondenceById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw ApiError.notFound("Correspondence");
    }

    const updated = await signCorrespondence(id, {
      signatureId: body.signatureId,
      actorUserId: userId!,
      actorName: user?.name ?? undefined,
      actorRole: user?.role ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return { data: updated };
  },
);
