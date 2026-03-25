/**
 * Single Grievance API
 *
 * GET /api/grievances/[id] — Fetch grievance detail with events
 */

import { NextRequest as _NextRequest, NextResponse as _NextResponse } from "next/server";
import { db } from "@/db/db";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { grievanceEvents } from "@/db/schema/domains/claims/grievance-lifecycle";
import { grievanceDocuments } from "@/db/schema/domains/claims/grievance-lifecycle";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and, desc } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

export const GET = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");
    const canAccess = await hasMinRole("member");
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Unauthorized");
    }

    const [grievance] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, params.id),
          eq(grievances.organizationId, organizationId),
        ),
      );

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
    }

    // Fetch related events
    const events = await db
      .select()
      .from(grievanceEvents)
      .where(eq(grievanceEvents.grievanceId, params.id))
      .orderBy(desc(grievanceEvents.createdAt));

    // Fetch related documents
    const documents = await db
      .select()
      .from(grievanceDocuments)
      .where(eq(grievanceDocuments.grievanceId, params.id));

    return standardSuccessResponse({
      ...grievance,
      events,
      documents,
    });
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to fetch grievance");
  }
});
