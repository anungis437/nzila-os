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
} from "@/lib/services/committee-workspace-service";

const minutesSchema = z.object({
  minutes: z.string().min(1, "Minutes content is required"),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: minutesSchema,
    openapi: { tags: ["Committees"], summary: "Record meeting minutes" },
  },
  async ({ body, userId, params }) => {
    const { meetingId } = params as { id: string; meetingId: string };

    const updated = await recordMinutes(meetingId, body.minutes, userId!);
    if (!updated) throw ApiError.notFound("Meeting");

    return updated;
  }
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: "officer" },
    openapi: { tags: ["Committees"], summary: "Approve meeting minutes" },
  },
  async ({ userId, params }) => {
    const { meetingId } = params as { id: string; meetingId: string };

    const meeting = await getMeeting(meetingId);
    if (!meeting) throw ApiError.notFound("Meeting");
    if (!meeting.minutes) {
      throw ApiError.badRequest("Cannot approve — no minutes recorded yet");
    }

    const updated = await approveMinutes(meetingId, userId!);
    if (!updated) throw ApiError.notFound("Meeting");

    return updated;
  }
);
