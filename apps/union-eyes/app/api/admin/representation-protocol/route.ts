/**
 * Representation Protocol Admin API
 *
 * GET  /api/admin/representation-protocol  — Read the current protocol
 * PUT  /api/admin/representation-protocol  — Save (upsert) the protocol as pending approval
 * POST /api/admin/representation-protocol  — Approve the pending protocol (must not be its author)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/api/framework";
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

// The protocol is the caller organization's own configuration row: the handlers run in that organization's tenant transaction, so the read the
// service makes through the ambient handle carries the organization row-level security applies to. The writes open their own transaction with
// their audit record inside it (a savepoint of this one).

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

export const GET = withApi(
  {
    auth: { minRole: "admin" },
    rlsOrgContext: true,
    registry: { audience: "admin", productionStatus: "active", evidenceRequired: true, orgScoping: "caller-org" },
    openapi: { tags: ["Admin", "Representation"], summary: "Read the representation protocol of the current organization" },
  },
  async ({ userId, organizationId }) => {
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
  },
);

// ─── PUT — Save protocol ─────────────────────────────────────

export const PUT = withApi(
  {
    auth: { minRole: "admin" },
    rlsOrgContext: true,
    registry: { audience: "admin", productionStatus: "active", evidenceRequired: true, orgScoping: "caller-org" },
    openapi: { tags: ["Admin", "Representation"], summary: "Save the representation protocol of the current organization as pending approval" },
  },
  async ({ request, userId, organizationId }) => {
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Organization and user context required");
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

  await saveRepresentationProtocol(organizationId, parsed.data.protocol, userId);

  logApiAuditEvent({
    timestamp: new Date().toISOString(),
    userId,
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
  },
);

// ─── POST — Independently approve the pending protocol ────────

export const POST = withApi(
  {
    auth: { minRole: "admin" },
    rlsOrgContext: true,
    registry: { audience: "admin", productionStatus: "active", evidenceRequired: true, orgScoping: "caller-org" },
    openapi: { tags: ["Admin", "Representation"], summary: "Approve the pending representation protocol, or submit the legacy one for approval" },
  },
  async ({ request, userId, organizationId }) => {
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Organization and user context required");
  }

  // No body approves the pending protocol, and a body names its action. A body that is not JSON, or names an action this route does not
  // have, is a client error: it is never read as an approval.
  const text = await request.text();
  let body: { action?: unknown } = {};
  if (text.trim() !== "") {
    try {
      const parsed = JSON.parse(text);
      body = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : { action: "invalid" };
    } catch {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid JSON in request body");
    }
  }
  if (body.action !== undefined && body.action !== "approve" && body.action !== "submit_legacy") {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Unknown action: use submit_legacy, or send no action to approve");
  }
  if (body.action === "submit_legacy") {
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
  },
);
