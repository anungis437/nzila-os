/**
 * POST /api/committees/[id]/meetings/[meetingId]/attendance — Record attendance
 * GET /api/committees/[id]/meetings/[meetingId]/attendance — Get attendees
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  recordAttendance,
  getMeetingAttendees,
  requireCommitteeScope,
} from "@/lib/services/committee-workspace-service";

const attendanceSchema = z.object({
  attendees: z.array(
    z.object({
      memberId: z.string(),
      attended: z.boolean(),
      arrivedLate: z.boolean().optional(),
      leftEarly: z.boolean().optional(),
      proxy: z.string().optional(),
      regrets: z.boolean().optional(),
    })
  ),
});

export const GET = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "member" },
    openapi: { tags: ["Committees"], summary: "Get meeting attendance" },
  },
  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId, meetingId } = params as { id: string; meetingId: string };
    await requireCommitteeScope(organizationId, committeeId, { meetingId });
    return getMeetingAttendees(meetingId);
  }
);

export const POST = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: "steward" },
    body: attendanceSchema,
    openapi: { tags: ["Committees"], summary: "Record meeting attendance" },
  },
  async ({ body, userId, organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const { id: committeeId, meetingId } = params as { id: string; meetingId: string };
    await requireCommitteeScope(organizationId, committeeId, { meetingId });
    await recordAttendance(meetingId, organizationId, body.attendees, userId ?? undefined);
    return { success: true };
  }
);
