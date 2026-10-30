/**
 * GET /api/committees/[id]/intelligence — Get intelligence snapshots
 * POST /api/committees/[id]/intelligence — Not implemented (501): no synthesis exists
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  listIntelligenceSnapshots,
  requireCommitteeScope,
} from "@/lib/services/committee-workspace-service";

const generateSchema = z.object({
  title: z.string().min(3).max(500),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  committeeIds: z.array(z.guid()).optional(),
});

export const GET = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "steward" },
    openapi: { tags: ["Committees"], summary: "List intelligence snapshots" },
  },
  async ({ organizationId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    if (committeeId !== "all") await requireCommitteeScope(organizationId, committeeId);
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

    return listIntelligenceSnapshots(organizationId, {
      committeeId: committeeId === "all" ? undefined : committeeId,
      limit,
    });
  }
);

export const POST = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "officer" },
    body: generateSchema,
    openapi: { tags: ["Committees"], summary: "Generate cross-committee intelligence" },
  },
  async ({ body, organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    if (committeeId !== "all") await requireCommitteeScope(organizationId, committeeId);
    // Every committee named for the synthesis must be this organization's own.
    for (const id of body.committeeIds ?? []) await requireCommitteeScope(organizationId, id);

    // No synthesis exists. The route used to store a snapshot whose summary said "Full AI synthesis pending integration" with empty themes,
    // positions and recommendations, which a reader of the snapshot list could take for the result of an analysis. Nothing is stored
    // until a synthesis is implemented, and the caller is told so.
    throw ApiError.notImplemented('Cross-committee intelligence synthesis is not implemented; no snapshot was created.');
  }
);
