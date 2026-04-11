/**
 * GET  /api/correspondence/signatures — Get current user's signatures
 * POST /api/correspondence/signatures — Save a new signature
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import {
  saveUserSignature,
  getUserSignatures,
} from "@/lib/services/correspondence-service";

const saveSignatureSchema = z.object({
  displayName: z.string().min(1).max(255),
  displayTitle: z.string().max(255).optional(),
  source: z.enum(["drawn", "uploaded", "typed"]),
  imageUrl: z.string().url(),
  imageHash: z.string().length(64),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: "officer" },
    openapi: { tags: ["Correspondence"], summary: "Get user signatures" },
  },
  async ({ organizationId, userId }) => {
    const signatures = await getUserSignatures(userId!, organizationId!);
    return { data: signatures };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: "officer" },
    body: saveSignatureSchema,
    openapi: { tags: ["Correspondence"], summary: "Save new signature" },
  },
  async ({ organizationId, userId, body }) => {
    const created = await saveUserSignature({
      organizationId: organizationId!,
      userId: userId!,
      displayName: body.displayName,
      displayTitle: body.displayTitle,
      source: body.source,
      imageUrl: body.imageUrl,
      imageHash: body.imageHash,
    });

    return { data: created };
  },
);
