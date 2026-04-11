/**
 * GET /api/committees/[id]/documents — List committee documents
 * POST /api/committees/[id]/documents — Link a document to committee
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import {
  linkDocument,
  listCommitteeDocuments,
} from "@/lib/services/committee-workspace-service";

const linkSchema = z.object({
  title: z.string().min(1).max(500),
  fileUrl: z.string().url().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
  documentId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
  category: z.string().optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: "member" },
    openapi: { tags: ["Committees"], summary: "List committee documents" },
  },
  async ({ params, request }) => {
    const { id: committeeId } = params as { id: string };
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") ?? undefined;
    const meetingId = searchParams.get("meetingId") ?? undefined;

    return listCommitteeDocuments(committeeId, { category, meetingId });
  }
);

export const POST = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: linkSchema,
    openapi: { tags: ["Committees"], summary: "Link document to committee" },
  },
  async ({ body, organizationId, userId, params }) => {
    const { id: committeeId } = params as { id: string };

    return linkDocument({
      ...body,
      committeeId,
      organizationId: organizationId!,
      uploadedBy: userId,
    });
  }
);
