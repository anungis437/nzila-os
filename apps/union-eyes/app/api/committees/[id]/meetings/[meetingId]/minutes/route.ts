/**
 * POST /api/committees/[id]/meetings/[meetingId]/minutes — Record or update minutes
 * PATCH /api/committees/[id]/meetings/[meetingId]/minutes — Approve minutes
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  recordMinutes,
  approveMinutes,
  getMeeting,
  requireCommitteeScope,
} from "@/lib/services/committee-workspace-service";

const minutesSchema = z.object({
  minutes: z.string().min(1, "Minutes content is required"),
});

export const POST = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "steward" },
    body: minutesSchema,
    openapi: { tags: ["Committees"], summary: "Record meeting minutes" },
  },
  async ({ body, userId, organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId, meetingId } = params as { id: string; meetingId: string };
    await requireCommitteeScope(organizationId, committeeId, { meetingId });

    const updated = await recordMinutes(meetingId, organizationId, body.minutes, userId!);
    // Scope is already proven, so no row means the minutes were approved in the meantime.
    if (!updated) throw ApiError.conflict("Approved minutes cannot be changed");

    return updated;
  }
);

export const PATCH = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "officer" },
    openapi: { tags: ["Committees"], summary: "Approve meeting minutes" },
  },
  async ({ userId, organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId, meetingId } = params as { id: string; meetingId: string };
    await requireCommitteeScope(organizationId, committeeId, { meetingId });

    const meeting = await getMeeting(meetingId);
    if (!meeting) throw ApiError.notFound("Meeting");
    if (!meeting.minutes) {
      throw ApiError.badRequest("Cannot approve — no minutes recorded yet");
    }

    const updated = await approveMinutes(meetingId, organizationId, userId!);
    if (!updated) throw ApiError.conflict("The minutes have already been approved");

    return updated;
  }
);
