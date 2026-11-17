/**
 * POST /api/correspondence/[id]/dispatch — Dispatch signed correspondence
 */

import { z } from "zod";
import { after, NextResponse } from 'next/server';
import { queueCorrespondenceEmail, processCorrespondenceEmails } from '@/lib/correspondence/email-delivery';
import { logger } from '@/lib/logger';
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
}).strict();

export const POST = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "steward" },
    body: dispatchSchema,
    openapi: { tags: ["Correspondence"], summary: "Dispatch correspondence" },
  },
  async ({ params, organizationId, userId, body, user, request }) => {
    const id = params?.id as string;
    if (!z.string().uuid().safeParse(id).success) throw ApiError.badRequest("Invalid correspondence ID");

    const existing = await getCorrespondenceById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw ApiError.notFound("Correspondence");
    }

    if (body.dispatchMethod === 'email') {
      if (body.signedPdfUrl || body.signedPdfHash) throw ApiError.badRequest('Client supplied email attachments are not accepted.');
      const queued = await queueCorrespondenceEmail(id, organizationId!, userId!);
      // Runs after the response's tenant transaction commits. Only a signed
      // durable intent crosses this boundary; no user session is retained.
      after(async () => {
        try { await processCorrespondenceEmails(); }
        catch { logger.error('Correspondence queue processing failed', { feature:'approved-correspondence' }); }
      });
      return NextResponse.json({success:true,data:queued},{status:202});
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
