/**
 * GET /api/committees/[id]/meetings/[meetingId] — Get meeting details
 * PATCH /api/committees/[id]/meetings/[meetingId] — Update a meeting
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import {
  getMeeting,
  updateMeeting,
  getMeetingAttendees,
} from "@/lib/services/committee-workspace-service";

const updateSchema = z.object({
  title: z.string().min(3).max(500).optional(),
  meetingDate: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().optional(),
  virtualLink: z.string().url().optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "postponed"]).optional(),
  agenda: z.string().optional(),
  agendaItems: z
    .array(
      z.object({
        order: z.number(),
        title: z.string(),
        presenter: z.string().optional(),
        duration: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  decisions: z
    .array(
      z.object({
        description: z.string(),
        movedBy: z.string().optional(),
        secondedBy: z.string().optional(),
        outcome: z.enum(["carried", "defeated", "tabled", "withdrawn"]),
        voteCount: z
          .object({
            for: z.number(),
            against: z.number(),
            abstained: z.number(),
          })
          .optional(),
      })
    )
    .optional(),
  nextMeetingDate: z.string().datetime().optional(),
  externalAttendees: z
    .array(
      z.object({
        name: z.string(),
        organization: z.string(),
        role: z.string().optional(),
        email: z.string().email().optional(),
      })
    )
    .optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: "member" },
    openapi: { tags: ["Committees"], summary: "Get meeting details" },
  },
  async ({ params }) => {
    const { meetingId } = params as { id: string; meetingId: string };
    const meeting = await getMeeting(meetingId);
    if (!meeting) throw ApiError.notFound("Meeting");

    const attendees = await getMeetingAttendees(meetingId);
    return { ...meeting, attendees };
  }
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: updateSchema,
    openapi: { tags: ["Committees"], summary: "Update meeting" },
  },
  async ({ body, userId, params }) => {
    const { meetingId } = params as { id: string; meetingId: string };
    const { meetingDate, endTime, nextMeetingDate, ...rest } = body;

    const updated = await updateMeeting(meetingId, {
      ...rest,
      ...(meetingDate && { meetingDate: new Date(meetingDate) }),
      ...(endTime && { endTime: new Date(endTime) }),
      ...(nextMeetingDate && { nextMeetingDate: new Date(nextMeetingDate) }),
      updatedBy: userId ?? undefined,
    });
    if (!updated) throw ApiError.notFound("Meeting");

    return updated;
  }
);
