/**
 * POST /api/committees/[id]/meetings/[meetingId]/attendance — Record attendance
 * GET /api/committees/[id]/meetings/[meetingId]/attendance — Get attendees
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import {
  recordAttendance,
  getMeetingAttendees,
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
    auth: { required: true, minRole: "member" },
    openapi: { tags: ["Committees"], summary: "Get meeting attendance" },
  },
  async ({ params }) => {
    const { meetingId } = params as { id: string; meetingId: string };
    return getMeetingAttendees(meetingId);
  }
);

export const POST = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: attendanceSchema,
    openapi: { tags: ["Committees"], summary: "Record meeting attendance" },
  },
  async ({ body, params }) => {
    const { meetingId } = params as { id: string; meetingId: string };
    await recordAttendance(meetingId, body.attendees);
    return { success: true };
  }
);
