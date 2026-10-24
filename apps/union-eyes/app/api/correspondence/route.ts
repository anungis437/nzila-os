/**
 * GET /api/correspondence — List correspondence for the org
 * POST /api/correspondence — Create new correspondence (draft)
 */

import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import {
  createCorrespondence,
  listCorrespondence,
} from "@/lib/services/correspondence-service";

// ── Validation ─────────────────────────────────────────────────────────────

const createSchema = z.object({
  subject: z.string().min(3).max(500),
  body: z.string().min(1),
  type: z
    .enum(["letter", "notice", "memo", "demand", "response", "proposal", "agreement", "report", "other"])
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedSignerId: z.string().optional(),
  templateId: z.string().uuid().optional(),
  templateVariables: z.record(z.string()).optional(),
  grievanceId: z.string().uuid().optional(),
  recipients: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        mailingAddress: z.string().optional(),
        organization: z.string().optional(),
        title: z.string().optional(),
        recipientType: z.enum(["to", "cc", "bcc"]).optional(),
      }),
    )
    .optional(),
});

// ── Handlers ───────────────────────────────────────────────────────────────

export const GET = withApi(
  {
    auth: { required: true, minRole: "steward" },
    openapi: { tags: ["Correspondence"], summary: "List correspondence" },
  },
  async ({ organizationId, userId: _userId, request }) => {
    if (!organizationId) throw ApiError.forbidden("Organization context required");
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") ?? undefined;
    const draftedBy = searchParams.get("draftedBy") ?? undefined;
    const assignedSignerId = searchParams.get("assignedSignerId") ?? undefined;
    const limitRaw = searchParams.get("limit");
    const offsetRaw = searchParams.get("offset");
    const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const parsedOffset = offsetRaw ? Number.parseInt(offsetRaw, 10) : undefined;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : undefined;

    let items: Awaited<ReturnType<typeof listCorrespondence>>;
    try {
      items = await listCorrespondence({
        organizationId,
        status: status as Parameters<typeof listCorrespondence>[0]["status"],
        draftedBy,
        assignedSignerId,
        limit,
        offset,
      });
    } catch (error) {
      // A failed read must surface as a failure, never as an empty correspondence queue.
      logger.error("[correspondence] listCorrespondence failed", error instanceof Error ? error : new Error(String(error)), {
        organizationId,
      });
      throw ApiError.database("Correspondence is temporarily unavailable");
    }

    return { data: items, count: items.length };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: "steward" },
    body: createSchema,
    openapi: { tags: ["Correspondence"], summary: "Create new correspondence" },
  },
  async ({ organizationId, userId, body, user, request }) => {
    if (!organizationId || !userId) throw ApiError.forbidden("Organization context required");
    const created = await createCorrespondence({
      organizationId,
      subject: body.subject,
      body: body.body,
      type: body.type,
      priority: body.priority,
      draftedBy: userId,
      assignedSignerId: body.assignedSignerId,
      templateId: body.templateId,
      templateVariables: body.templateVariables,
      grievanceId: body.grievanceId,
      recipients: body.recipients,
      actorName: user?.name ?? undefined,
      actorRole: user?.role ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return { data: created };
  },
);
