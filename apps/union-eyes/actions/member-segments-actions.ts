"use server";

/**
 * Member Segments Server Actions
 * 
 * Phase 1.3: Search & Segmentation
 * 
 * Server actions for member segments, advanced search, and exports.
 * 
 * @module actions/member-segments-actions
 */

import { currentUser } from '@nzila/platform-auth/entra/server';
import { db } from "@/db";
import { organizations } from "@/db/schema-organizations";
import {
  createSegment,
  getSegments,
  getSegmentById,
  updateSegment,
  deleteSegment,
  searchMembersAdvanced,
  executeSegment,
  getSegmentExecutions,
  logSegmentExport,
  getExportHistory,
  generateExportWatermark,
  generateExportHash,
} from "@/db/queries/member-segments-queries";

import type {
  SelectMemberSegment,
  InsertMemberSegment,
  SelectSegmentExecution,
  SelectSegmentExport,
  MemberSegmentFilters,
} from "@/db/schema/domains/member/member-segments";

import { ActionResult } from "@/types/actions/actions-types";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
import {
  authorizeMemberSegmentAccess,
  MEMBER_SEGMENT_EXPORT_ENTITLEMENT,
  type SegmentAccessDenial,
  type SegmentAccessGrant,
} from "@/lib/member-segments/authorize-segment-access";

function denied(decision: SegmentAccessDenial): ActionResult<never> {
  return { isSuccess: false, message: decision.message };
}

async function requireSegmentAccess(
  organizationId: string,
  entitlement?: string,
): Promise<SegmentAccessGrant | SegmentAccessDenial> {
  return authorizeMemberSegmentAccess(
    organizationId,
    entitlement ? { entitlement } : undefined,
  );
}

// =============================================================================
// SEGMENT CRUD ACTIONS
// =============================================================================

/**
 * Create a new member segment
 */
export async function createMemberSegmentAction(
  data: Omit<InsertMemberSegment, "createdBy">
): Promise<ActionResult<SelectMemberSegment>> {
  try {
    const access = await requireSegmentAccess(data.organizationId);
    if (!access.ok) return denied(access);

    const segment = await createSegment({
      ...data,
      organizationId: access.organizationId,
      createdBy: access.userId,
    });

    revalidatePath("/dashboard/members");
    revalidatePath("/dashboard/admin/segments");

    return {
      isSuccess: true,
      message: "Segment created successfully",
      data: segment,
    };
  } catch (error) {
    logger.error("Failed to create segment", error as Error, { data });
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to create segment",
    };
  }
}

/**
 * Get all segments for an organization
 */
export async function getMemberSegmentsAction(
  organizationId: string,
  includePrivate: boolean = false
): Promise<ActionResult<SelectMemberSegment[]>> {
  try {
    const access = await requireSegmentAccess(organizationId);
    if (!access.ok) return denied(access);

    const segments = await getSegments(
      access.organizationId,
      includePrivate ? access.userId : undefined
    );

    return {
      isSuccess: true,
      message: "Segments retrieved successfully",
      data: segments,
    };
  } catch (error) {
    logger.error("Failed to get segments", error as Error, { organizationId });
    return {
      isSuccess: false,
      message: "Failed to retrieve segments",
    };
  }
}

/**
 * Get segment by ID
 */
export async function getMemberSegmentByIdAction(
  id: string,
  organizationId: string
): Promise<ActionResult<SelectMemberSegment>> {
  try {
    const access = await requireSegmentAccess(organizationId);
    if (!access.ok) return denied(access);

    const segment = await getSegmentById(id, access.organizationId);
    if (!segment) {
      return {
        isSuccess: false,
        message: "Segment not found",
      };
    }

    return {
      isSuccess: true,
      message: "Segment retrieved successfully",
      data: segment,
    };
  } catch (error) {
    logger.error("Failed to get segment", error as Error, { id, organizationId });
    return {
      isSuccess: false,
      message: "Failed to retrieve segment",
    };
  }
}

/**
 * Update a segment
 */
export async function updateMemberSegmentAction(
  id: string,
  organizationId: string,
  data: Partial<InsertMemberSegment>
): Promise<ActionResult<SelectMemberSegment>> {
  try {
    const access = await requireSegmentAccess(organizationId);
    if (!access.ok) return denied(access);

    const updated = await updateSegment(id, data, access.organizationId);

    revalidatePath("/dashboard/members");
    revalidatePath("/dashboard/admin/segments");

    return {
      isSuccess: true,
      message: "Segment updated successfully",
      data: updated,
    };
  } catch (error) {
    logger.error("Failed to update segment", error as Error, { id, data });
    return {
      isSuccess: false,
      message: "Failed to update segment",
    };
  }
}

/**
 * Delete a segment
 */
export async function deleteMemberSegmentAction(
  id: string,
  organizationId: string,
): Promise<ActionResult<void>> {
  try {
    const access = await requireSegmentAccess(organizationId);
    if (!access.ok) return denied(access);

    await deleteSegment(id, access.organizationId);

    revalidatePath("/dashboard/members");
    revalidatePath("/dashboard/admin/segments");

    return {
      isSuccess: true,
      message: "Segment deleted successfully",
    };
  } catch (error) {
    logger.error("Failed to delete segment", error as Error, { id });
    return {
      isSuccess: false,
      message: "Failed to delete segment",
    };
  }
}

// =============================================================================
// SEARCH ACTIONS
// =============================================================================

/**
 * Search members with advanced filters
 */
export async function searchMembersAdvancedAction(
  organizationId: string,
  filters: MemberSegmentFilters,
  options?: {
    page?: number;
    limit?: number;
    sortBy?: "name" | "joinDate" | "seniority" | "relevance";
    sortOrder?: "asc" | "desc";
  }
): Promise<ActionResult<{ members: any[]; total: number }>> {
  try {
    const access = await requireSegmentAccess(organizationId);
    if (!access.ok) return denied(access);

    const result = await searchMembersAdvanced(access.organizationId, filters, options);

    return {
      isSuccess: true,
      message: "Search completed successfully",
      data: result,
    };
  } catch (error) {
    logger.error("Failed to search members", error as Error, { organizationId, filters });
    return {
      isSuccess: false,
      message: "Failed to search members",
    };
  }
}

/**
 * Execute a saved segment
 */
export async function executeSegmentAction(
  segmentId: string,
  organizationId: string,
  options?: {
    page?: number;
    limit?: number;
  }
): Promise<ActionResult<{ members: any[]; total: number }>> {
  try {
    const access = await requireSegmentAccess(organizationId);
    if (!access.ok) return denied(access);

    const result = await executeSegment(segmentId, access.organizationId, access.userId, options);

    return {
      isSuccess: true,
      message: "Segment executed successfully",
      data: result,
    };
  } catch (error) {
    logger.error("Failed to execute segment", error as Error, { segmentId, organizationId });
    return {
      isSuccess: false,
      message: "Failed to execute segment",
    };
  }
}

/**
 * Get execution history for a segment
 */
export async function getSegmentExecutionHistoryAction(
  segmentId: string,
  organizationId: string,
): Promise<ActionResult<SelectSegmentExecution[]>> {
  try {
    const access = await requireSegmentAccess(organizationId);
    if (!access.ok) return denied(access);

    const segment = await getSegmentById(segmentId, access.organizationId);
    if (!segment) {
      return {
        isSuccess: false,
        message: "Segment not found",
      };
    }

    const executions = await getSegmentExecutions(segmentId, access.organizationId);

    return {
      isSuccess: true,
      message: "Execution history retrieved successfully",
      data: executions,
    };
  } catch (error) {
    logger.error("Failed to get execution history", error as Error, { segmentId });
    return {
      isSuccess: false,
      message: "Failed to retrieve execution history",
    };
  }
}

// =============================================================================
// EXPORT ACTIONS
// =============================================================================

/**
 * Export members data
 * 
 * @param organizationId - Organization ID
 * @param filters - Search filters or null to use segment
 * @param segmentId - Segment ID (if exporting from saved segment)
 * @param format - Export format (csv, excel, pdf)
 * @param includeFields - Fields to include in export
 * @param purpose - Optional purpose for audit
 */
export async function exportMembersAction(
  organizationId: string,
  filters: MemberSegmentFilters | null,
  segmentId: string | null,
  format: "csv" | "excel" | "pdf",
  includeFields: string[],
  purpose?: string
): Promise<ActionResult<{ exportId: string; watermark: string }>> {
  try {
    const access = await requireSegmentAccess(
      organizationId,
      MEMBER_SEGMENT_EXPORT_ENTITLEMENT,
    );
    if (!access.ok) return denied(access);

    // Get members data
    let members: any[];
    let totalCount: number;

    if (segmentId) {
      // Execute segment
      const result = await executeSegment(segmentId, access.organizationId, access.userId, { limit: 10000 });
      members = result.members;
      totalCount = result.total;
    } else if (filters) {
      // Execute ad-hoc search
      const result = await searchMembersAdvanced(access.organizationId, filters, { limit: 10000 });
      members = result.members;
      totalCount = result.total;
    } else {
      return {
        isSuccess: false,
        message: "Must provide either segmentId or filters",
      };
    }

    const clerkUser = await currentUser();
    const userDisplayName = clerkUser?.fullName
      || [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ")
      || clerkUser?.primaryEmailAddress?.emailAddress
      || access.userId;

    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(organizations.id, access.organizationId as any))
      .limit(1);

    const organizationName = org?.name || access.organizationId;

    // Generate watermark
    const watermark = generateExportWatermark(
      access.userId,
      userDisplayName,
      organizationName
    );

    // Generate export hash (simplified - in practice would hash actual export data)
    const exportHash = generateExportHash(JSON.stringify(members));

    // Log export
    const exportLog = await logSegmentExport({
      organizationId: access.organizationId,
      segmentId: segmentId || undefined,
      exportedBy: access.userId,
      format,
      includeFields,
      memberCount: totalCount,
      filtersUsed: filters || undefined,
      watermark,
      exportHash,
      purpose,
    });

    revalidatePath("/dashboard/admin/exports");

    return {
      isSuccess: true,
      message: `Successfully exported ${totalCount} members`,
      data: {
        exportId: exportLog.id,
        watermark,
      },
    };
  } catch (error) {
    logger.error("Failed to export members", error as Error, { organizationId, format });
    return {
      isSuccess: false,
      message: "Failed to export members",
    };
  }
}

/**
 * Get export history for an organization
 */
export async function getExportHistoryAction(
  organizationId: string,
  limit?: number
): Promise<ActionResult<SelectSegmentExport[]>> {
  try {
    const access = await requireSegmentAccess(
      organizationId,
      MEMBER_SEGMENT_EXPORT_ENTITLEMENT,
    );
    if (!access.ok) return denied(access);

    const history = await getExportHistory(access.organizationId, limit);

    return {
      isSuccess: true,
      message: "Export history retrieved successfully",
      data: history,
    };
  } catch (error) {
    logger.error("Failed to get export history", error as Error, { organizationId });
    return {
      isSuccess: false,
      message: "Failed to retrieve export history",
    };
  }
}
