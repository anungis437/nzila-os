/**
 * GET /api/committees/[id]/intelligence — Get intelligence snapshots
 * POST /api/committees/[id]/intelligence — Generate cross-committee synthesis
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  listIntelligenceSnapshots,
  gatherCrossCommitteeMinutes,
  createIntelligenceSnapshot,
  requireCommitteeScope,
} from "@/lib/services/committee-workspace-service";

const generateSchema = z.object({
  title: z.string().min(3).max(500),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  committeeIds: z.array(z.string().uuid()).optional(),
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
  async ({ body, organizationId, userId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId } = params as { id: string };
    if (committeeId !== "all") await requireCommitteeScope(organizationId, committeeId);
    // Every committee named for the synthesis must be this organization's own.
    for (const id of body.committeeIds ?? []) await requireCommitteeScope(organizationId, id);

    // Gather minutes for the period
    const meetings = await gatherCrossCommitteeMinutes(
      organizationId,
      new Date(body.periodStart),
      new Date(body.periodEnd),
      body.committeeIds
    );

    // For now, create a placeholder snapshot — AI integration layer can be plugged in
    const snapshot = await createIntelligenceSnapshot({
      organizationId: organizationId,
      committeeId: committeeId === "all" ? null : committeeId,
      title: body.title,
      summary: `Intelligence synthesis from ${meetings.length} meetings across the period ${body.periodStart} to ${body.periodEnd}. Full AI synthesis pending integration.`,
      keyThemes: [],
      positions: [],
      recommendations: [],
      sourceMeetingIds: meetings.map((m) => m.id),
      sourceCommitteeIds: [...new Set(meetings.map((m) => m.committeeId))],
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      generatedBy: userId,
      model: null,
    });

    return snapshot;
  }
);
