/**
 * GET /api/committees/[id]/intelligence — Get intelligence snapshots
 * POST /api/committees/[id]/intelligence — Generate cross-committee synthesis
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import {
  listIntelligenceSnapshots,
  gatherCrossCommitteeMinutes,
  createIntelligenceSnapshot,
} from "@/lib/services/committee-workspace-service";

const generateSchema = z.object({
  title: z.string().min(3).max(500),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  committeeIds: z.array(z.string().uuid()).optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: "steward" },
    openapi: { tags: ["Committees"], summary: "List intelligence snapshots" },
  },
  async ({ organizationId, params, request }) => {
    const { id: committeeId } = params as { id: string };
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

    return listIntelligenceSnapshots(organizationId!, {
      committeeId: committeeId === "all" ? undefined : committeeId,
      limit,
    });
  }
);

export const POST = withApi(
  {
    auth: { required: true, minRole: "officer" },
    body: generateSchema,
    openapi: { tags: ["Committees"], summary: "Generate cross-committee intelligence" },
  },
  async ({ body, organizationId, userId, params }) => {
    const { id: committeeId } = params as { id: string };

    // Gather minutes for the period
    const meetings = await gatherCrossCommitteeMinutes(
      organizationId!,
      new Date(body.periodStart),
      new Date(body.periodEnd),
      body.committeeIds
    );

    // Build synthesis material (actual AI call would go here)
    const minutesSummary = meetings
      .filter((m) => m.minutes)
      .map((m) => ({
        committeeId: m.committeeId,
        title: m.title,
        date: m.meetingDate,
        minutes: m.minutes,
        decisions: m.decisions,
      }));

    // For now, create a placeholder snapshot — AI integration layer can be plugged in
    const snapshot = await createIntelligenceSnapshot({
      organizationId: organizationId!,
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
