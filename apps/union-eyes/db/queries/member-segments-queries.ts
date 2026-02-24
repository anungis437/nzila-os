/**
 * Member Segments Queries
 * 
 * Phase 1.3: Search & Segmentation
 * 
 * Database queries for member segments, advanced search, and exports.
 * 
 * @module db/queries/member-segments-queries
 */

import { 
  memberSegments, 
  segmentExecutions, 
  segmentExports,
  SelectMemberSegment,
  InsertMemberSegment,
  SelectSegmentExecution,
  InsertSegmentExecution,
  SelectSegmentExport,
  InsertSegmentExport,
  type MemberSegmentFilters,
} from "../schema/domains/member/member-segments";
import { organizationMembers } from "../schema/organization-members-schema";
import { memberEmployment } from "../schema/domains/member/member-employment";
import { eq, and, or, desc, asc, sql, gte, lte, inArray, SQL } from "drizzle-orm";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { logger } from "@/lib/logger";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

// =============================================================================
// SEGMENT CRUD
// =============================================================================

/**
 * Create a new member segment
 */
export async function createSegment(
  data: InsertMemberSegment
): Promise<SelectMemberSegment> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      const [segment] = await tx
        .insert(memberSegments)
        .values(data)
        .returning();
      
      return segment;
    } catch (error) {
      logger.error("Failed to create segment", error as Error, { data });
      throw new Error("Failed to create segment");
    }
  });
}

/**
 * Get all segments for an organization
 */
export async function getSegments(
  organizationId: string,
  userId?: string
): Promise<SelectMemberSegment[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      const conditions: SQL[] = [
        eq(memberSegments.organizationId, organizationId),
        eq(memberSegments.isActive, true),
      ];

      // If userId provided, filter to user's segments + public segments
      if (userId) {
        conditions.push(
          or(
            eq(memberSegments.createdBy, userId),
            eq(memberSegments.isPublic, true)
          )!
        );
      }

      return await tx
        .select()
        .from(memberSegments)
        .where(and(...conditions))
        .orderBy(desc(memberSegments.lastExecutedAt), desc(memberSegments.createdAt));
    } catch (error) {
      logger.error("Failed to get segments", error as Error, { organizationId, userId });
      throw new Error("Failed to get segments");
    }
  });
}

/**
 * Get segment by ID
 */
export async function getSegmentById(
  id: string,
  organizationId: string
): Promise<SelectMemberSegment | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      const [segment] = await tx
        .select()
        .from(memberSegments)
        .where(
          and(
            eq(memberSegments.id, id),
            eq(memberSegments.organizationId, organizationId)
          )
        )
        .limit(1);
      
      return segment || null;
    } catch (error) {
      logger.error("Failed to get segment", error as Error, { id, organizationId });
      throw new Error("Failed to get segment");
    }
  });
}

/**
 * Update a segment
 */
export async function updateSegment(
  id: string,
  data: Partial<InsertMemberSegment>
): Promise<SelectMemberSegment> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      const [updated] = await tx
        .update(memberSegments)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(memberSegments.id, id))
        .returning();
      
      if (!updated) {
        throw new Error(`Segment ${id} not found`);
      }
      
      return updated;
    } catch (error) {
      logger.error("Failed to update segment", error as Error, { id, data });
      throw new Error("Failed to update segment");
    }
  });
}

/**
 * Delete a segment (soft delete by setting isActive = false)
 */
export async function deleteSegment(
  id: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      await tx
        .update(memberSegments)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(memberSegments.id, id));
    } catch (error) {
      logger.error("Failed to delete segment", error as Error, { id });
      throw new Error("Failed to delete segment");
    }
  });
}

// =============================================================================
// ADVANCED MEMBER SEARCH
// =============================================================================

/**
 * Search members with advanced filters
 * 
 * Supports full-text search, faceted filtering, and pagination.
 */
export async function searchMembersAdvanced(
  organizationId: string,
  filters: MemberSegmentFilters,
  options?: {
    page?: number;
    limit?: number;
    sortBy?: "name" | "joinDate" | "seniority" | "relevance";
    sortOrder?: "asc" | "desc";
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ members: any[]; total: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 50;
      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions: SQL[] = [
        eq(organizationMembers.organizationId, organizationId),
      ];

      // Member attributes (using only existing fields)
      if (filters.status && filters.status.length > 0) {
        conditions.push(inArray(organizationMembers.status, filters.status));
      }
      if (filters.role && filters.role.length > 0) {
        conditions.push(inArray(organizationMembers.role, filters.role));
      }
      if (filters.membershipType && filters.membershipType.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        conditions.push(inArray(organizationMembers.memberCategory, filters.membershipType as any));
      }

      // Date ranges (using joinedAt which exists)
      if (filters.joinDateFrom) {
        conditions.push(gte(organizationMembers.joinedAt, new Date(filters.joinDateFrom)));
      }
      if (filters.joinDateTo) {
        conditions.push(lte(organizationMembers.joinedAt, new Date(filters.joinDateTo)));
      }

      // Build query with joins for employment data
      const query = tx
        .select({
          // Member fields (only existing ones)
          id: organizationMembers.id,
          userId: organizationMembers.userId,
          organizationId: organizationMembers.organizationId,
          role: organizationMembers.role,
          status: organizationMembers.status,
          membershipNumber: organizationMembers.membershipNumber,
          memberCategory: organizationMembers.memberCategory,
          joinedAt: organizationMembers.joinedAt,
          // Employment fields (left join - may be null)
          employmentStatus: memberEmployment.employmentStatus,
          employerId: memberEmployment.employerId,
          worksiteId: memberEmployment.worksiteId,
          bargainingUnitId: memberEmployment.bargainingUnitId,
          jobClassification: memberEmployment.jobClassification,
          seniorityYears: memberEmployment.seniorityYears,
          seniorityDate: memberEmployment.seniorityDate,
          checkoffAuthorized: memberEmployment.checkoffAuthorized,
        })
        .from(organizationMembers)
        .leftJoin(
          memberEmployment,
          and(
            eq(memberEmployment.memberId, organizationMembers.id),
            eq(memberEmployment.employmentStatus, "active")
          )
        )
        .where(and(...conditions));

      // Apply employment filters if provided
      const employmentConditions: SQL[] = [];
      
      if (filters.employerId && filters.employerId.length > 0) {
        employmentConditions.push(inArray(memberEmployment.employerId, filters.employerId));
      }
      if (filters.worksiteId && filters.worksiteId.length > 0) {
        employmentConditions.push(inArray(memberEmployment.worksiteId, filters.worksiteId));
      }
      if (filters.bargainingUnitId && filters.bargainingUnitId.length > 0) {
        employmentConditions.push(inArray(memberEmployment.bargainingUnitId, filters.bargainingUnitId));
      }
      if (filters.employmentStatus && filters.employmentStatus.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        employmentConditions.push(inArray(memberEmployment.employmentStatus, filters.employmentStatus as any));
      }
      if (filters.checkoffAuthorized !== undefined) {
        employmentConditions.push(eq(memberEmployment.checkoffAuthorized, filters.checkoffAuthorized));
      }

      // Seniority filters
      if (filters.seniorityYearsMin !== undefined) {
        employmentConditions.push(gte(memberEmployment.seniorityYears, String(filters.seniorityYearsMin)));
      }
      if (filters.seniorityYearsMax !== undefined) {
        employmentConditions.push(lte(memberEmployment.seniorityYears, String(filters.seniorityYearsMax)));
      }
      if (filters.seniorityDateFrom) {
        employmentConditions.push(gte(memberEmployment.seniorityDate, filters.seniorityDateFrom));
      }
      if (filters.seniorityDateTo) {
        employmentConditions.push(lte(memberEmployment.seniorityDate, filters.seniorityDateTo));
      }

      // If employment filters exist, filter results to members with employment records
      if (employmentConditions.length > 0) {
        conditions.push(and(...employmentConditions)!);
      }

      // Sorting
      const sortBy = options?.sortBy || "name";
      const sortOrder = options?.sortOrder || "asc";
      const sortFn = sortOrder === "asc" ? asc : desc;

      // Apply sorting based on sortBy option
      let orderByClause;
      if (sortBy === "joinDate") {
        orderByClause = sortFn(organizationMembers.joinedAt);
      } else if (sortBy === "seniority") {
        orderByClause = sortFn(memberEmployment.seniorityDate);
      } else {
        // Default to joinedAt since we don't have name fields
        orderByClause = sortFn(organizationMembers.joinedAt);
      }

      // Execute query with pagination
      const members = await query.orderBy(orderByClause).limit(limit).offset(offset);

      // Get total count
      const countQuery = await tx
        .select({ count: sql<number>`count(*)` })
        .from(organizationMembers)
        .leftJoin(
          memberEmployment,
          and(
            eq(memberEmployment.memberId, organizationMembers.id),
            eq(memberEmployment.employmentStatus, "active")
          )
        )
        .where(and(...conditions));

      const total = Number(countQuery[0]?.count || 0);

      return { members, total };
    } catch (error) {
      logger.error("Failed to search members", error as Error, { organizationId, filters });
      throw new Error("Failed to search members");
    }
  });
}

/**
 * Execute a saved segment
 */
export async function executeSegment(
  segmentId: string,
  organizationId: string,
  executedBy: string,
  options?: {
    page?: number;
    limit?: number;
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ members: any[]; total: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      // Get segment
      const segment = await getSegmentById(segmentId, organizationId);
      if (!segment) {
        throw new Error(`Segment ${segmentId} not found`);
      }

      // Start timing
      const startTime = Date.now();

      // Execute search with segment filters
      const result = await searchMembersAdvanced(
        organizationId,
        segment.filters as MemberSegmentFilters,
        options
      );

      // Calculate execution time
      const executionTimeMs = Date.now() - startTime;

      // Log execution
      await logSegmentExecution({
        segmentId,
        executedBy,
        resultCount: result.total,
        executionTimeMs,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filtersSnapshot: segment.filters as any,
      });

      // Update segment metadata
      await tx
        .update(memberSegments)
        .set({
          lastExecutedAt: new Date(),
          executionCount: sql`${memberSegments.executionCount} + 1`,
        })
        .where(eq(memberSegments.id, segmentId));

      return result;
    } catch (error) {
      logger.error("Failed to execute segment", error as Error, { segmentId, organizationId });
      throw new Error("Failed to execute segment");
    }
  });
}

// =============================================================================
// SEGMENT EXECUTIONS (AUDIT)
// =============================================================================

/**
 * Log segment execution for audit trail
 */
export async function logSegmentExecution(
  data: InsertSegmentExecution
): Promise<SelectSegmentExecution> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      const [execution] = await tx
        .insert(segmentExecutions)
        .values(data)
        .returning();
      
      return execution;
    } catch (error) {
      logger.error("Failed to log segment execution", error as Error, { data });
      throw new Error("Failed to log segment execution");
    }
  });
}

/**
 * Get execution history for a segment
 */
export async function getSegmentExecutions(
  segmentId: string,
  limit: number = 50
): Promise<SelectSegmentExecution[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      return await tx
        .select()
        .from(segmentExecutions)
        .where(eq(segmentExecutions.segmentId, segmentId))
        .orderBy(desc(segmentExecutions.executedAt))
        .limit(limit);
    } catch (error) {
      logger.error("Failed to get segment executions", error as Error, { segmentId });
      throw new Error("Failed to get segment executions");
    }
  });
}

// =============================================================================
// EXPORTS (WATERMARKING & AUDIT)
// =============================================================================

/**
 * Log member data export
 */
export async function logSegmentExport(
  data: InsertSegmentExport
): Promise<SelectSegmentExport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      const [exportLog] = await tx
        .insert(segmentExports)
        .values(data)
        .returning();
      
      return exportLog;
    } catch (error) {
      logger.error("Failed to log segment export", error as Error, { data });
      throw new Error("Failed to log segment export");
    }
  });
}

/**
 * Get export history for an organization
 */
export async function getExportHistory(
  organizationId: string,
  limit: number = 100
): Promise<SelectSegmentExport[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withRLSContext(async (tx: NodePgDatabase<any>) => {
    try {
      return await tx
        .select()
        .from(segmentExports)
        .where(eq(segmentExports.organizationId, organizationId))
        .orderBy(desc(segmentExports.exportedAt))
        .limit(limit);
    } catch (error) {
      logger.error("Failed to get export history", error as Error, { organizationId });
      throw new Error("Failed to get export history");
    }
  });
}

/**
 * Generate export watermark text
 */
export function generateExportWatermark(
  exportedBy: string,
  exportedByName: string,
  organizationName: string
): string {
  const timestamp = new Date().toISOString();
  return `Exported by ${exportedByName} (${exportedBy}) for ${organizationName} on ${timestamp}. Confidential - Do not distribute.`;
}

/**
 * Generate export hash for verification
 */
export function generateExportHash(data: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(data).digest("hex");
}
