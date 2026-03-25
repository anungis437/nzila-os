/**
 * Grievances API — List & Create
 *
 * POST /api/grievances     — File a new grievance (member+)
 * GET  /api/grievances     — List grievances for the org (union_staff+)
 */

import { NextResponse as _NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/db";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditDataMutation } from "@/lib/audit-logger";
import { emitCapeAuditEvent, CAPE_AUDIT_EVENTS } from "@/lib/audit/cape-audit-events";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, desc } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

// ── Validation ──────────────────────────────────────────────────────────────

const createGrievanceSchema = z.object({
  type: z.enum([
    "individual", "group", "policy", "contract", "harassment",
    "discrimination", "safety", "seniority", "discipline", "termination", "other",
  ]),
  title: z.string().min(5).max(500),
  description: z.string().min(10),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  employerId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  category: z.string().optional(),
});

// ── POST ────────────────────────────────────────────────────────────────────

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    const body = await request.json();
    const parsed = createGrievanceSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    const data = parsed.data;

    const [grievance] = await db
      .insert(grievances)
      .values({
        grievanceNumber: `GRV-${Date.now()}`,
        type: data.type,
        title: data.title,
        description: data.description,
        priority: data.priority ?? "medium",
        status: "filed",
        employerId: data.employerId ?? null,
        cbaId: data.contractId ?? null,
        organizationId,
        createdBy: userId,
        filedDate: new Date(),
      })
      .returning();

    // Emit event
    await db.insert(grievanceEvents).values({
      grievanceId: grievance.id,
      eventType: "created",
      actorUserId: userId,
      notes: `Grievance filed: ${data.title}`,
    });

    // Audit
    await auditDataMutation({
      userId,
      organizationId,
      resource: "grievances",
      action: "create",
      resourceId: grievance.id,
      newState: grievance,
    });

    // CAPE audit event
    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.GRIEVANCE_SUBMITTED,
      userId,
      organizationId,
      resource: "grievances",
      resourceId: grievance.id,
      details: { grievanceNumber: grievance.grievanceNumber, type: data.type },
    });

    return standardSuccessResponse(grievance);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to create grievance");
  }
});

// ── GET ─────────────────────────────────────────────────────────────────────

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    const canAccess = await hasMinRole("steward");
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires steward role or above");
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = db
      .select()
      .from(grievances)
      .where(eq(grievances.organizationId, organizationId))
      .orderBy(desc(grievances.createdAt))
      .$dynamic();

    const rows = await query;

    // If status filter is requested, apply in-memory (simple for now)
    const filtered = status
      ? rows.filter((r) => r.status === status)
      : rows;

    return standardSuccessResponse(filtered);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to list grievances");
  }
});
