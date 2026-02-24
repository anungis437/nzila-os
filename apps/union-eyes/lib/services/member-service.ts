/**
 * Member Service - Organization Member Operations
 * 
 * Provides comprehensive member management including:
 * - Member CRUD operations
 * - Member search and filtering
 * - Bulk operations
 * - Engagement tracking
 * - Membership card management
 * - Member notes and documents
 */

import { db } from "@/db/db";
import { 
  organizationMembers
} from "@/db/schema";
import { eq, and, or, gte, lte, desc, asc, like, sql, inArray, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type NewMember = typeof organizationMembers.$inferInsert;
export type Member = typeof organizationMembers.$inferSelect;

export interface MemberFilters {
  organizationId?: string;
  status?: string[];
  role?: string[];
  department?: string;
  searchQuery?: string;
  hireDateFrom?: Date;
  hireDateTo?: Date;
  unionJoinDateFrom?: Date;
  unionJoinDateTo?: Date;
}

export interface MemberWithEngagement extends Member {
  engagementScore?: number;
  lastActivityDate?: Date;
  activityCount?: number;
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: Array<{ row: number; error: string }>;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get member by ID
 */
export async function getMemberById(id: string): Promise<Member | null> {
  try {
    const member = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.id, id),
    });

    return member || null;
  } catch (error) {
    logger.error("Error fetching member by ID", { error, id });
    throw new Error("Failed to fetch member");
  }
}

/**
 * Get member by user ID and organization
 */
export async function getMemberByUserId(
  userId: string,
  organizationId: string
): Promise<Member | null> {
  try {
    const member = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId)
      ),
    });

    return member || null;
  } catch (error) {
    logger.error("Error fetching member by user ID", { error, userId, organizationId });
    throw new Error("Failed to fetch member by user ID");
  }
}

/**
 * Get member by membership number
 */
export async function getMemberByMembershipNumber(
  membershipNumber: string,
  organizationId: string
): Promise<Member | null> {
  try {
    const member = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.membershipNumber, membershipNumber),
        eq(organizationMembers.organizationId, organizationId)
      ),
    });

    return member || null;
  } catch (error) {
    logger.error("Error fetching member by membership number", {
      error,
      membershipNumber,
      organizationId,
    });
    throw new Error("Failed to fetch member by membership number");
  }
}

/**
 * List members with filtering and pagination
 */
export async function listMembers(
  filters: MemberFilters = {},
  pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc" } = {}
): Promise<{ members: Member[]; total: number; page: number; limit: number }> {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = "name",
      sortOrder = "asc"
    } = pagination;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [];

    if (filters.organizationId) {
      conditions.push(eq(organizationMembers.organizationId, filters.organizationId));
    }

    if (filters.status && filters.status.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(organizationMembers.status, filters.status as any));
    }

    if (filters.role && filters.role.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(organizationMembers.role, filters.role as any));
    }

    if (filters.department) {
      conditions.push(like(organizationMembers.department, `%${filters.department}%`));
    }

    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      conditions.push(
        or(
          like(organizationMembers.name, searchTerm),
          like(organizationMembers.email, searchTerm),
          like(organizationMembers.membershipNumber, searchTerm)
        )!
      );
    }

    if (filters.hireDateFrom) {
      conditions.push(gte(organizationMembers.hireDate, filters.hireDateFrom));
    }

    if (filters.hireDateTo) {
      conditions.push(lte(organizationMembers.hireDate, filters.hireDateTo));
    }

    if (filters.unionJoinDateFrom) {
      conditions.push(gte(organizationMembers.unionJoinDate, filters.unionJoinDateFrom));
    }

    if (filters.unionJoinDateTo) {
      conditions.push(lte(organizationMembers.unionJoinDate, filters.unionJoinDateTo));
    }

    // Exclude soft-deleted records
    conditions.push(sql`${organizationMembers.deletedAt} IS NULL`);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(organizationMembers)
      .where(whereClause);

    const total = totalResult[0]?.count || 0;

    // Determine sort column
    const sortColumn = sortBy === "name" 
      ? organizationMembers.name
      : sortBy === "email"
      ? organizationMembers.email
      : sortBy === "hireDate"
      ? organizationMembers.hireDate
      : organizationMembers.createdAt;

    // Get members
    const members = await db
      .select()
      .from(organizationMembers)
      .where(whereClause)
      .orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
      .limit(limit)
      .offset(offset);

    return {
      members,
      total,
      page,
      limit,
    };
  } catch (error) {
    logger.error("Error listing members", { error, filters, pagination });
    throw new Error("Failed to list members");
  }
}

/**
 * Create a new member
 */
export async function createMember(data: NewMember): Promise<Member> {
  try {
    const [member] = await db
      .insert(organizationMembers)
      .values(data)
      .returning();

    return member;
  } catch (error) {
    logger.error("Error creating member", { error, data });
    throw new Error("Failed to create member");
  }
}

/**
 * Update member
 */
export async function updateMember(
  id: string,
  data: Partial<NewMember>
): Promise<Member | null> {
  try {
    const [updated] = await db
      .update(organizationMembers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(organizationMembers.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating member", { error, id });
    throw new Error("Failed to update member");
  }
}

/**
 * Soft delete member
 */
export async function deleteMember(id: string): Promise<boolean> {
  try {
    const [deleted] = await db
      .update(organizationMembers)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(organizationMembers.id, id))
      .returning();

    return !!deleted;
  } catch (error) {
    logger.error("Error deleting member", { error, id });
    throw new Error("Failed to delete member");
  }
}

/**
 * Permanently delete member (hard delete)
 */
export async function permanentlyDeleteMember(id: string): Promise<boolean> {
  try {
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, id));

    return true;
  } catch (error) {
    logger.error("Error permanently deleting member", { error, id });
    throw new Error("Failed to permanently delete member");
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk import members
 */
export async function bulkImportMembers(
  members: NewMember[]
): Promise<BulkOperationResult> {
  const errors: Array<{ row: number; error: string }> = [];
  let processed = 0;

  try {
    for (let i = 0; i < members.length; i++) {
      try {
        await createMember(members[i]);
        processed++;
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      success: errors.length === 0,
      processed,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    logger.error("Error in bulk import", { error });
    throw new Error("Failed to complete bulk import");
  }
}

/**
 * Bulk update member status
 */
export async function bulkUpdateMemberStatus(
  memberIds: string[],
  status: string
): Promise<BulkOperationResult> {
  try {
    await db
      .update(organizationMembers)
      .set({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: status as any,
        updatedAt: new Date(),
      })
      .where(inArray(organizationMembers.id, memberIds));

    return {
      success: true,
      processed: memberIds.length,
      failed: 0,
    };
  } catch (error) {
    logger.error("Error in bulk status update", {
      error,
      memberIdsCount: memberIds.length,
      status,
    });
    return {
      success: false,
      processed: 0,
      failed: memberIds.length,
      errors: [{ row: 0, error: "Bulk update failed" }],
    };
  }
}

/**
 * Bulk update member role
 */
export async function bulkUpdateMemberRole(
  memberIds: string[],
  role: string
): Promise<BulkOperationResult> {
  try {
    await db
      .update(organizationMembers)
      .set({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: role as any,
        updatedAt: new Date(),
      })
      .where(inArray(organizationMembers.id, memberIds));

    return {
      success: true,
      processed: memberIds.length,
      failed: 0,
    };
  } catch (error) {
    logger.error("Error in bulk role update", {
      error,
      memberIdsCount: memberIds.length,
      role,
    });
    return {
      success: false,
      processed: 0,
      failed: memberIds.length,
      errors: [{ row: 0, error: "Bulk update failed" }],
    };
  }
}

// ============================================================================
// Search & Advanced Queries
// ============================================================================

/**
 * Advanced member search with full-text search
 */
export async function searchMembers(
  organizationId: string,
  searchQuery: string,
  filters?: {
    status?: string[];
    role?: string[];
    department?: string;
  },
  pagination?: { page?: number; limit?: number }
): Promise<{ members: Member[]; total: number }> {
  const { page = 1, limit = 50 } = pagination || {};
  const offset = (page - 1) * limit;

  try {
    const conditions: SQL[] = [
      eq(organizationMembers.organizationId, organizationId),
      sql`${organizationMembers.deletedAt} IS NULL`,
    ];

    // Full-text search
    if (searchQuery) {
      const searchTerm = `%${searchQuery}%`;
      conditions.push(
        or(
          like(organizationMembers.name, searchTerm),
          like(organizationMembers.email, searchTerm),
          like(organizationMembers.membershipNumber, searchTerm),
          like(organizationMembers.department, searchTerm),
          like(organizationMembers.position, searchTerm)
        )!
      );
    }

    if (filters?.status && filters.status.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(organizationMembers.status, filters.status as any));
    }

    if (filters?.role && filters.role.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(organizationMembers.role, filters.role as any));
    }

    if (filters?.department) {
      conditions.push(like(organizationMembers.department, `%${filters.department}%`));
    }

    const whereClause = and(...conditions);

    const [totalResult, members] = await Promise.all([
      db.select({ count: count() }).from(organizationMembers).where(whereClause),
      db.select().from(organizationMembers).where(whereClause).limit(limit).offset(offset),
    ]);

    return {
      members,
      total: totalResult[0]?.count || 0,
    };
  } catch (error) {
    logger.error("Error searching members", {
      error,
      organizationId,
      searchQuery,
    });
    throw new Error("Failed to search members");
  }
}

/**
 * Get member statistics
 */
export async function getMemberStatistics(organizationId: string): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byRole: Record<string, number>;
  byDepartment: Record<string, number>;
}> {
  try {
    const members = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          sql`${organizationMembers.deletedAt} IS NULL`
        )
      );

    const byStatus: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};

    members.forEach((member) => {
      // Count by status
      byStatus[member.status] = (byStatus[member.status] || 0) + 1;

      // Count by role
      byRole[member.role] = (byRole[member.role] || 0) + 1;

      // Count by department
      if (member.department) {
        byDepartment[member.department] = (byDepartment[member.department] || 0) + 1;
      }
    });

    return {
      total: members.length,
      byStatus,
      byRole,
      byDepartment,
    };
  } catch (error) {
    logger.error("Error getting member statistics", { error, organizationId });
    throw new Error("Failed to get member statistics");
  }
}

/**
 * Merge duplicate members
 */
export async function mergeMembers(
  primaryMemberId: string,
  duplicateMemberId: string,
  keepData: "primary" | "duplicate" | "merge"
): Promise<Member> {
  try {
    const [primary, duplicate] = await Promise.all([
      getMemberById(primaryMemberId),
      getMemberById(duplicateMemberId),
    ]);

    if (!primary || !duplicate) {
      throw new Error("One or both members not found");
    }

    let mergedData: Partial<NewMember> = {};

    if (keepData === "primary") {
      mergedData = { ...primary };
    } else if (keepData === "duplicate") {
      mergedData = { ...duplicate };
    } else {
      // Merge: prefer non-null values from duplicate, then primary
      mergedData = {
        ...primary,
        ...Object.fromEntries(
          Object.entries(duplicate).filter(([_, v]) => v != null)
        ),
      };
    }

    // Update primary member
    const updated = await updateMember(primaryMemberId, mergedData);

    // Soft delete duplicate
    await deleteMember(duplicateMemberId);

    return updated!;
  } catch (error) {
    logger.error("Error merging members", {
      error,
      primaryMemberId,
      duplicateMemberId,
      keepData,
    });
    throw new Error("Failed to merge members");
  }
}

/**
 * Calculate seniority for member
 */
export async function calculateSeniority(memberId: string): Promise<string> {
  try {
    const member = await getMemberById(memberId);
    if (!member || !member.unionJoinDate) {
      return "N/A";
    }

    const joinDate = new Date(member.unionJoinDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
    const diffMonths = Math.floor((diffTime % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));

    return `${diffYears} years, ${diffMonths} months`;
  } catch (error) {
    logger.error("Error calculating seniority", { error, memberId });
    return "N/A";
  }
}

/**
 * Get members by department
 */
export async function getMembersByDepartment(
  organizationId: string,
  department: string
): Promise<Member[]> {
  try {
    const members = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.department, department),
          sql`${organizationMembers.deletedAt} IS NULL`
        )
      );

    return members;
  } catch (error) {
    logger.error("Error fetching members by department", {
      error,
      organizationId,
      department,
    });
    throw new Error("Failed to fetch members by department");
  }
}

/**
 * Get members by role
 */
export async function getMembersByRole(
  organizationId: string,
  role: string
): Promise<Member[]> {
  try {
    const members = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(organizationMembers.role, role as any),
          sql`${organizationMembers.deletedAt} IS NULL`
        )
      );

    return members;
  } catch (error) {
    logger.error("Error fetching members by role", { error, organizationId, role });
    throw new Error("Failed to fetch members by role");
  }
}

