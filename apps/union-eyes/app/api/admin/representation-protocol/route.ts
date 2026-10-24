/**
 * Representation Protocol Admin API
 *
 * GET  /api/admin/representation-protocol  — Read the current protocol
 * PUT  /api/admin/representation-protocol  — Save (upsert) the protocol as pending approval
 * POST /api/admin/representation-protocol  — Approve the pending protocol (must not be its author)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth, type BaseAuthContext } from "@/lib/api-auth-guard";
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import {
  resolveRepresentationProtocol,
  saveRepresentationProtocol,
  approveRepresentationProtocol,
  submitLegacyRepresentationProtocolForApproval,
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

  const resolution = await resolveRepresentationProtocol(organizationId);
  const protocol = resolution.protocol;

  logApiAuditEvent({
    timestamp: new Date().toISOString(),
    userId: userId ?? "unknown",
    endpoint: "/api/admin/representation-protocol",
    method: "GET",
    eventType: "success",
    severity: "low",
    details: { primaryRepresentative: protocol.primaryRepresentative, executionStatus: resolution.status },
  });

  // `protocol` may be a display default; only `execution.executable` indicates institutional authority.
  return NextResponse.json({
    protocol,
    execution: {
      status: resolution.status,
      executable: resolution.executable,
      reason: resolution.executable ? null : resolution.reason,
      approval: protocol.approval ?? null,
    },
  });
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

  return NextResponse.json({
    ok: true,
    protocol: parsed.data.protocol,
    execution: { status: "pending_approval", executable: false },
  });
});

// ─── POST — Independently approve the pending protocol ────────

export const POST = withAdminAuth(async (request, context: BaseAuthContext) => {
  const { userId, organizationId } = context;

  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Organization and user context required");
  }

  const body = await request.json().catch(() => ({}));
  if (body?.action === "submit_legacy") {
    const submitted = await submitLegacyRepresentationProtocolForApproval(organizationId, userId);
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint: "/api/admin/representation-protocol",
      method: "POST",
      eventType: submitted.ok ? "success" : "validation_failed",
      severity: "medium",
      details: { action: "submit_legacy", outcome: submitted.ok ? "pending_approval" : submitted.code },
    });
    if (!submitted.ok) {
      return NextResponse.json({ error: submitted.code, message: submitted.message }, { status: 409 });
    }
    return NextResponse.json({ ok: true, execution: { status: "pending_approval", executable: false } });
  }

  const result = await approveRepresentationProtocol(organizationId, userId);

  logApiAuditEvent({
    timestamp: new Date().toISOString(),
    userId,
    endpoint: "/api/admin/representation-protocol",
    method: "POST",
    eventType: result.ok ? "success" : "unauthorized_access",
    severity: "medium",
    details: { action: "approve", outcome: result.ok ? "approved" : result.code },
  });

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "SELF_APPROVAL_FORBIDDEN" ? 403 : 409;
    return NextResponse.json({ error: result.code, message: result.message }, { status });
  }
  return NextResponse.json({ ok: true, approvedAt: result.approvedAt, execution: { status: "approved", executable: true } });
});
