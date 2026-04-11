/**
 * GET /api/committees/[id]/meetings — List meetings for a committee
 * POST /api/committees/[id]/meetings — Create a meeting
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import {
  createMeeting,
  listMeetings,
} from "@/lib/services/committee-workspace-service";

const createSchema = z.object({
  title: z.string().min(3).max(500),
  meetingDate: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  location: z.string().optional(),
  virtualLink: z.string().url().optional(),
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
  attendeeIds: z.array(z.string()).optional(),
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
    openapi: { tags: ["Committees"], summary: "List committee meetings" },
  },
  async ({ organizationId, params, request }) => {
    const { id: committeeId } = params as { id: string };
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") ?? undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined;

    return listMeetings(committeeId, { status, limit, offset });
  }
);

export const POST = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: createSchema,
    openapi: { tags: ["Committees"], summary: "Create committee meeting" },
  },
  async ({ body, organizationId, userId, params }) => {
    const { id: committeeId } = params as { id: string };

    return createMeeting({
      ...body,
      committeeId,
      organizationId: organizationId!,
      meetingDate: new Date(body.meetingDate),
      endTime: body.endTime ? new Date(body.endTime) : null,
      createdBy: userId,
    });
  }
);
