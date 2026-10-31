/**
 * GET /api/committees/[id]/documents — List committee documents
 * POST /api/committees/[id]/documents — Link a document to committee
 */

import { z } from "zod";
import { requireCommitteeReader } from "@/lib/services/committee-read-access";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  linkDocument,
  listCommitteeDocuments,
  requireCommitteeScope,
} from "@/lib/services/committee-workspace-service";

const linkSchema = z.object({
  title: z.string().min(1).max(500),
  fileUrl: z.string().url().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
  documentId: z.guid().optional(),
  meetingId: z.guid().optional(),
  category: z.string().optional(),
});

export const GET = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "member" },
    openapi: { tags: ["Committees"], summary: "List committee documents" },
  },
  async ({ organizationId, userId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeReader(organizationId, committeeId, userId);
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") ?? undefined;
    const meetingId = searchParams.get("meetingId") ?? undefined;

    return listCommitteeDocuments(committeeId, { category, meetingId });
  }
);

export const POST = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "steward" },
    body: linkSchema,
    openapi: { tags: ["Committees"], summary: "Link document to committee" },
  },
  async ({ body, organizationId, userId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    await requireCommitteeScope(organizationId, committeeId, { meetingId: body.meetingId });

    return linkDocument({
      ...body,
      committeeId,
      organizationId,
      uploadedBy: userId,
    });
  }
);
