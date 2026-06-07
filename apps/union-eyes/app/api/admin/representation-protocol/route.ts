/**
 * Representation Protocol Admin API
 *
 * GET  /api/admin/representation-protocol  — Read the current protocol
 * PUT  /api/admin/representation-protocol  — Save (upsert) the protocol
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth, type BaseAuthContext } from "@/lib/api-auth-guard";
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import {
  getRepresentationProtocol,
  saveRepresentationProtocol,
} from "@/lib/representation/protocol-service";
import {
  ErrorCode,
  standardErrorResponse,
} from "@/lib/api/standardized-responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Validation ───────────────────────────────────────────────

const stewardPermissionsSchema = z.object({
  canFileGrievance: z.boolean(),
  canRepresent: z.boolean(),
  canBeAssigned: z.boolean(),
  canContactEmployer: z.boolean(),
  canEscalate: z.boolean(),
});

const protocolSchema = z.object({
  version: z.literal(1),
  primaryRepresentative: z.enum(["steward", "lro", "national_rep", "officer"]),
  stewardPermissions: stewardPermissionsSchema,
  representativeLabel: z.string().min(1).max(100),
  stewardLabel: z.string().min(1).max(100),
  minimumFilingRole: z.string().min(1).max(50),
  minimumRepresentationRole: z.string().min(1).max(50),
  notes: z.string().max(2000).optional(),
});

const putBodySchema = z.object({
  protocol: protocolSchema,
});

// ─── GET — Read current protocol ──────────────────────────────

export const GET = withAdminAuth(async (request, context: BaseAuthContext) => {
  const { userId, organizationId } = context;

  if (!organizationId) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Organization context required");
  }

  const protocol = await getRepresentationProtocol(organizationId);

  logApiAuditEvent({
    timestamp: new Date().toISOString(),
    userId: userId ?? "unknown",
    endpoint: "/api/admin/representation-protocol",
    method: "GET",
    eventType: "success",
    severity: "low",
    details: { primaryRepresentative: protocol.primaryRepresentative },
  });

  return NextResponse.json({ protocol });
});

// ─── PUT — Save protocol ─────────────────────────────────────

export const PUT = withAdminAuth(async (request, context: BaseAuthContext) => {
  const { userId, organizationId } = context;

  if (!organizationId) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Organization context required");
  }

  let rawBody: any;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid JSON in request body");
  }

  const parsed = putBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      "Invalid protocol payload",
      parsed.error,
    );
  }

  await saveRepresentationProtocol(organizationId, parsed.data.protocol, userId ?? "system");

  logApiAuditEvent({
    timestamp: new Date().toISOString(),
    userId: userId ?? "unknown",
    endpoint: "/api/admin/representation-protocol",
    method: "PUT",
    eventType: "success",
    severity: "medium",
    details: {
      primaryRepresentative: parsed.data.protocol.primaryRepresentative,
    },
  });

  return NextResponse.json({ ok: true, protocol: parsed.data.protocol });
});
