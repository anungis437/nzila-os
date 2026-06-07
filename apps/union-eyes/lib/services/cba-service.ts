/**
 * CBA Service - Collective Bargaining Agreement Operations
 * 
 * Provides comprehensive CRUD operations for CBAs including:
 * - CBA retrieval and listing
 * - CBA creation and updates
 * - Status management
 * - Search and filtering
 * - Analytics and reporting
 */

import { db } from "@/db/db";
import {
  collectiveAgreements,
} from "@/db/schema";
import { eq, and, or, gte, lte, desc, asc, like, sql, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type NewCBA = typeof collectiveAgreements.$inferInsert;
export type CBA = typeof collectiveAgreements.$inferSelect;

export interface CBAFilters {
  organizationId?: string;
  status?: string[];
  jurisdiction?: string[];
  sector?: string;
  employerName?: string;
  unionName?: string;
  effectiveDateFrom?: Date;
  effectiveDateTo?: Date;
  expiryDateFrom?: Date;
  expiryDateTo?: Date;
  searchQuery?: string;
  isPublic?: boolean;
}

export interface CBAWithClauses extends CBA {
  clauseCount?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clauses?: any[];
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get CBA by ID with optional clause information
 */
export async function getCBAById(
  id: string, 
  options: { includeClauses?: boolean; includeAnalytics?: boolean } = {}
): Promise<CBAWithClauses | null> {
  try {
    const cba = await db.query.collectiveAgreements.findFirst({
      where: eq(collectiveAgreements.id, id),
      with: options.includeClauses ? {
        // Add relation to clauses when defined
        // clauses: true
      } : undefined,
    });

    if (!cba) return null;

    // Increment view count
    if (options.includeAnalytics) {
      await db
        .update(collectiveAgreements)
        .set({ 
          viewCount: sql`${collectiveAgreements.viewCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(collectiveAgreements.id, id));
    }

    return cba as CBAWithClauses;
  } catch (error) {
    logger.error("Error fetching CBA by ID", { error, id });
    throw new Error("Failed to fetch CBA");
  }
}

/**
 * Get CBA by CBA number
 */
export async function getCBAByNumber(cbaNumber: string): Promise<CBA | null> {
  try {
    const cba = await db.query.collectiveAgreements.findFirst({
      where: eq(collectiveAgreements.cbaNumber, cbaNumber),
    });

    return cba || null;
  } catch (error) {
    logger.error("Error fetching CBA by number", { error, cbaNumber });
    throw new Error("Failed to fetch CBA by number");
  }
}

/**
 * List CBAs with filtering and pagination
 */
export async function listCBAs(
  filters: CBAFilters = {},
  pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc" } = {}
): Promise<{ cbas: CBA[]; total: number; page: number; limit: number }> {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "effectiveDate",
      sortOrder = "desc"
    } = pagination;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [];

    if (filters.organizationId) {
      conditions.push(eq(collectiveAgreements.organizationId, filters.organizationId));
    }

    if (filters.status && filters.status.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(collectiveAgreements.status, filters.status as any));
    }

    if (filters.jurisdiction && filters.jurisdiction.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(collectiveAgreements.jurisdiction, filters.jurisdiction as any));
    }

    if (filters.sector) {
      conditions.push(like(collectiveAgreements.industrySector, `%${filters.sector}%`));
    }

    if (filters.employerName) {
      conditions.push(like(collectiveAgreements.employerName, `%${filters.employerName}%`));
    }

    if (filters.unionName) {
      conditions.push(like(collectiveAgreements.unionName, `%${filters.unionName}%`));
    }

    if (filters.effectiveDateFrom) {
      conditions.push(gte(collectiveAgreements.effectiveDate, filters.effectiveDateFrom));
    }

    if (filters.effectiveDateTo) {
      conditions.push(lte(collectiveAgreements.effectiveDate, filters.effectiveDateTo));
    }

    if (filters.expiryDateFrom) {
      conditions.push(gte(collectiveAgreements.expiryDate, filters.expiryDateFrom));
    }

    if (filters.expiryDateTo) {
      conditions.push(lte(collectiveAgreements.expiryDate, filters.expiryDateTo));
    }

    if (filters.isPublic !== undefined) {
      conditions.push(eq(collectiveAgreements.isPublic, filters.isPublic));
    }

    if (filters.searchQuery) {
      conditions.push(
        or(
          like(collectiveAgreements.title, `%${filters.searchQuery}%`),
          like(collectiveAgreements.employerName, `%${filters.searchQuery}%`),
          like(collectiveAgreements.unionName, `%${filters.searchQuery}%`),
          like(collectiveAgreements.cbaNumber, `%${filters.searchQuery}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectiveAgreements)
      .where(whereClause);

    // Get CBAs with sorting
    const sortColumn = sortBy === "effectiveDate" 
      ? collectiveAgreements.effectiveDate
      : sortBy === "expiryDate"
      ? collectiveAgreements.expiryDate
      : collectiveAgreements.createdAt;

    const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const cbas = await db
      .select()
      .from(collectiveAgreements)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      cbas,
      total: count,
      page,
      limit
    };
  } catch (error) {
    logger.error("Error listing CBAs", { error, filters });
    throw new Error("Failed to list CBAs");
  }
}

/**
 * Create a new CBA
 */
export async function createCBA(data: NewCBA): Promise<CBA> {
  try {
    const [newCBA] = await db
      .insert(collectiveAgreements)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newCBA;
  } catch (error) {
    logger.error("Error creating CBA", { error });
    throw new Error("Failed to create CBA");
  }
}

/**
 * Update an existing CBA
 */
export async function updateCBA(
  id: string,
  data: Partial<NewCBA>
): Promise<CBA | null> {
  try {
    const [updated] = await db
      .update(collectiveAgreements)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(collectiveAgreements.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating CBA", { error, id });
    throw new Error("Failed to update CBA");
  }
}

/**
 * Delete a CBA (soft delete by setting status to archived)
 */
export async function deleteCBA(id: string): Promise<boolean> {
  try {
    const [deleted] = await db
      .update(collectiveAgreements)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(collectiveAgreements.id, id))
      .returning();

    return !!deleted;
  } catch (error) {
    logger.error("Error deleting CBA", { error, id });
    throw new Error("Failed to delete CBA");
  }
}

/**
 * Hard delete a CBA (permanent deletion)
 */
export async function hardDeleteCBA(id: string): Promise<boolean> {
  try {
    const _result = await db
      .delete(collectiveAgreements)
      .where(eq(collectiveAgreements.id, id));

    return true;
  } catch (error) {
    logger.error("Error hard deleting CBA", { error, id });
    throw new Error("Failed to hard delete CBA");
  }
}

// ============================================================================
// Status Management
// ============================================================================

/**
 * Update CBA status
 */
export async function updateCBAStatus(
  id: string,
  status: "active" | "expired" | "under_negotiation" | "ratified_pending" | "archived"
): Promise<CBA | null> {
  try {
    const [updated] = await db
      .update(collectiveAgreements)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(collectiveAgreements.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating CBA status", { error, id, status });
    throw new Error("Failed to update CBA status");
  }
}

/**
 * Get CBAs expiring soon
 */
export async function getCBAsExpiringSoon(
  daysAhead: number = 90,
  organizationId?: string
): Promise<CBA[]> {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const conditions = [
      lte(collectiveAgreements.expiryDate, futureDate),
      gte(collectiveAgreements.expiryDate, new Date()),
      eq(collectiveAgreements.status, "active")
    ];

    if (organizationId) {
      conditions.push(eq(collectiveAgreements.organizationId, organizationId));
    }

    const cbas = await db
      .select()
      .from(collectiveAgreements)
      .where(and(...conditions))
      .orderBy(asc(collectiveAgreements.expiryDate));

    return cbas;
  } catch (error) {
    logger.error("Error fetching expiring CBAs", { error, organizationId, daysAhead });
    throw new Error("Failed to fetch expiring CBAs");
  }
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get CBA statistics for an organization
 */
export async function getCBAStatistics(organizationId: string) {
  try {
    const stats = await db
      .select({
        status: collectiveAgreements.status,
        count: sql<number>`count(*)::int`,
        totalEmployees: sql<number>`sum(${collectiveAgreements.employeeCoverage})::int`,
      })
      .from(collectiveAgreements)
      .where(eq(collectiveAgreements.organizationId, organizationId))
      .groupBy(collectiveAgreements.status);

    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectiveAgreements)
      .where(eq(collectiveAgreements.organizationId, organizationId));

    return {
      byStatus: stats,
      total: total[0]?.count || 0,
    };
  } catch (error) {
    logger.error("Error fetching CBA statistics", { error, organizationId });
    throw new Error("Failed to fetch CBA statistics");
  }
}

/**
 * Search CBAs with full-text search (basic implementation)
 */
export async function searchCBAs(
  query: string,
  organizationId?: string,
  limit: number = 20
): Promise<CBA[]> {
  try {
    const conditions = [
      or(
        like(collectiveAgreements.title, `%${query}%`),
        like(collectiveAgreements.employerName, `%${query}%`),
        like(collectiveAgreements.unionName, `%${query}%`),
        like(collectiveAgreements.cbaNumber, `%${query}%`),
        like(collectiveAgreements.rawText, `%${query}%`)
      )!
    ];

    if (organizationId) {
      conditions.push(eq(collectiveAgreements.organizationId, organizationId));
    }

    const results = await db
      .select()
      .from(collectiveAgreements)
      .where(and(...conditions))
      .limit(limit)
      .orderBy(desc(collectiveAgreements.viewCount));

    return results;
  } catch (error) {
    logger.error("Error searching CBAs", { error, query, organizationId });
    throw new Error("Failed to search CBAs");
  }
}

