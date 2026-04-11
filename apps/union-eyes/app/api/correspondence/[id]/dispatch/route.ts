/**
 * POST /api/correspondence/[id]/dispatch — Dispatch signed correspondence
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  getCorrespondenceById,
  dispatchCorrespondence,
} from "@/lib/services/correspondence-service";

const dispatchSchema = z.object({
  dispatchMethod: z.enum(["email", "mail", "fax", "hand_delivered", "courier"]),
  signedPdfUrl: z.string().url().optional(),
  signedPdfHash: z.string().optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: dispatchSchema,
    openapi: { tags: ["Correspondence"], summary: "Dispatch correspondence" },
  },
  async ({ params, organizationId, userId, body, user, request }) => {
    const id = params?.id as string;
    if (!id) throw ApiError.badRequest("Missing correspondence ID");

    const existing = await getCorrespondenceById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw ApiError.notFound("Correspondence");
    }

    const updated = await dispatchCorrespondence(id, {
      dispatchMethod: body.dispatchMethod,
      signedPdfUrl: body.signedPdfUrl,
      signedPdfHash: body.signedPdfHash,
      actorUserId: userId!,
      actorName: user?.name ?? undefined,
      actorRole: user?.role ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return { data: updated };
  },
);
