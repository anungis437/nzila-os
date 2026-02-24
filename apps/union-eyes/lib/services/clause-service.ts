/**
 * Clause Service - CBA Clause Operations
 * 
 * Provides comprehensive clause management including:
 * - Clause CRUD operations
 * - Clause search and filtering
 * - Clause comparison across CBAs
 * - Wage progression tracking
 * - Benefit comparisons
 * - Entity extraction and classification
 */

import { db } from "@/db/db";
import {
  cbaClause,
  wageProgressions,
  benefitComparisons,
  clauseComparisons,
} from "@/db/schema";
import { eq, and, or, like, desc, asc, sql, inArray, gte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type NewClause = typeof cbaClause.$inferInsert;
export type Clause = typeof cbaClause.$inferSelect;
export type NewWageProgression = typeof wageProgressions.$inferInsert;
export type WageProgression = typeof wageProgressions.$inferSelect;
export type NewBenefitComparison = typeof benefitComparisons.$inferInsert;
export type BenefitComparison = typeof benefitComparisons.$inferSelect;

export interface ClauseFilters {
  cbaId?: string;
  clauseType?: string[];
  searchQuery?: string;
  pageNumber?: number;
  articleNumber?: string;
  confidenceMin?: number;
  hasEntities?: boolean;
}

export interface ClauseSearchOptions {
  includeContent?: boolean;
  includeEntities?: boolean;
  includeRelated?: boolean;
}

export interface ClauseComparisonRequest {
  clauseIds: string[];
  analysisType: "similarities" | "differences" | "best_practices" | "all";
}

export interface ClauseComparisonResult {
  clauses: Clause[];
  similarities: Array<{ description: string; clauseIds: string[] }>;
  differences: Array<{ description: string; clauseIds: string[]; impact: string }>;
  bestPractices: Array<{ description: string; clauseId: string; reason: string }>;
  recommendations: string[];
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get clause by ID
 */
export async function getClauseById(
  id: string,
  _options: ClauseSearchOptions = {}
): Promise<Clause | null> {
  try {
    const clause = await db.query.cbaClause.findFirst({
      where: eq(cbaClause.id, id),
    });

    if (!clause) return null;

    // Increment view count
    await db
      .update(cbaClause)
      .set({ 
        viewCount: sql`${cbaClause.viewCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(cbaClause.id, id));

    return clause;
  } catch (error) {
    logger.error("Error fetching clause by ID", { error, id });
    throw new Error("Failed to fetch clause");
  }
}

/**
 * Get clauses by CBA ID
 */
export async function getClausesByCBAId(
  cbaId: string,
  _options: ClauseSearchOptions = {}
): Promise<Clause[]> {
  try {
    const clauses = await db
      .select()
      .from(cbaClause)
      .where(eq(cbaClause.cbaId, cbaId))
      .orderBy(asc(cbaClause.orderIndex), asc(cbaClause.clauseNumber));

    return clauses;
  } catch (error) {
    logger.error("Error fetching clauses by CBA ID", { error, cbaId });
    throw new Error("Failed to fetch clauses");
  }
}

/**
 * List clauses with filtering
 */
export async function listClauses(
  filters: ClauseFilters = {},
  pagination: { page?: number; limit?: number } = {}
): Promise<{ clauses: Clause[]; total: number; page: number; limit: number }> {
  try {
    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (filters.cbaId) {
      conditions.push(eq(cbaClause.cbaId, filters.cbaId));
    }

    if (filters.clauseType && filters.clauseType.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(cbaClause.clauseType, filters.clauseType as any));
    }

    if (filters.articleNumber) {
      conditions.push(eq(cbaClause.articleNumber, filters.articleNumber));
    }

    if (filters.confidenceMin) {
      conditions.push(gte(cbaClause.confidenceScore, filters.confidenceMin.toString()));
    }

    if (filters.searchQuery) {
      conditions.push(
        or(
          like(cbaClause.title, `%${filters.searchQuery}%`),
          like(cbaClause.content, `%${filters.searchQuery}%`),
          like(cbaClause.contentPlainText, `%${filters.searchQuery}%`),
          like(cbaClause.clauseNumber, `%${filters.searchQuery}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaClause)
      .where(whereClause);

    // Get clauses
    const clauses = await db
      .select()
      .from(cbaClause)
      .where(whereClause)
      .orderBy(asc(cbaClause.orderIndex))
      .limit(limit)
      .offset(offset);

    return {
      clauses,
      total: count,
      page,
      limit
    };
  } catch (error) {
    logger.error("Error listing clauses", { error, filters });
    throw new Error("Failed to list clauses");
  }
}

/**
 * Create a new clause
 */
export async function createClause(data: NewClause): Promise<Clause> {
  try {
    const [newClause] = await db
      .insert(cbaClause)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newClause;
  } catch (error) {
    logger.error("Error creating clause", { error });
    throw new Error("Failed to create clause");
  }
}

/**
 * Bulk create clauses
 */
export async function bulkCreateClauses(clauses: NewClause[]): Promise<Clause[]> {
  try {
    const newClauses = await db
      .insert(cbaClause)
      .values(
        clauses.map(clause => ({
          ...clause,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      )
      .returning();

    return newClauses;
  } catch (error) {
    logger.error("Error bulk creating clauses", { error, count: clauses.length });
    throw new Error("Failed to bulk create clauses");
  }
}

/**
 * Update a clause
 */
export async function updateClause(
  id: string,
  data: Partial<NewClause>
): Promise<Clause | null> {
  try {
    const [updated] = await db
      .update(cbaClause)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(cbaClause.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating clause", { error, id });
    throw new Error("Failed to update clause");
  }
}

/**
 * Delete a clause
 */
export async function deleteClause(id: string): Promise<boolean> {
  try {
    await db
      .delete(cbaClause)
      .where(eq(cbaClause.id, id));

    return true;
  } catch (error) {
    logger.error("Error deleting clause", { error, id });
    throw new Error("Failed to delete clause");
  }
}

// ============================================================================
// Search and Classification
// ============================================================================

/**
 * Search clauses across CBAs
 */
export async function searchClauses(
  query: string,
  filters: Omit<ClauseFilters, "searchQuery"> = {},
  limit: number = 50
): Promise<Clause[]> {
  try {
    const conditions: SQL[] = [
      or(
        like(cbaClause.title, `%${query}%`),
        like(cbaClause.content, `%${query}%`),
        like(cbaClause.contentPlainText, `%${query}%`)
      )!
    ];

    if (filters.clauseType && filters.clauseType.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(cbaClause.clauseType, filters.clauseType as any));
    }

    if (filters.cbaId) {
      conditions.push(eq(cbaClause.cbaId, filters.cbaId));
    }

    const results = await db
      .select()
      .from(cbaClause)
      .where(and(...conditions))
      .orderBy(desc(cbaClause.confidenceScore), desc(cbaClause.viewCount))
      .limit(limit);

    return results;
  } catch (error) {
    logger.error("Error searching clauses", { error, query });
    throw new Error("Failed to search clauses");
  }
}

/**
 * Get clauses by type across multiple CBAs
 */
export async function getClausesByType(
  clauseType: string,
  options: { organizationId?: string; limit?: number } = {}
): Promise<Clause[]> {
  try {
    const { limit = 100 } = options;

    const clauses = await db
      .select()
      .from(cbaClause)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(cbaClause.clauseType, clauseType as any))
      .orderBy(desc(cbaClause.createdAt))
      .limit(limit);

    return clauses;
  } catch (error) {
    logger.error("Error fetching clauses by type", { error, clauseType });
    throw new Error("Failed to fetch clauses by type");
  }
}

/**
 * Get clause hierarchy (parent and children)
 */
export async function getClauseHierarchy(clauseId: string): Promise<{
  parent: Clause | null;
  clause: Clause | null;
  children: Clause[];
}> {
  try {
    const clause = await db.query.cbaClause.findFirst({
      where: eq(cbaClause.id, clauseId),
    });

    if (!clause) {
      return { parent: null, clause: null, children: [] };
    }

    let parent: Clause | null = null;
    if (clause.parentClauseId) {
      parent = await db.query.cbaClause.findFirst({
        where: eq(cbaClause.id, clause.parentClauseId),
      }) || null;
    }

    const children = await db
      .select()
      .from(cbaClause)
      .where(eq(cbaClause.parentClauseId, clauseId))
      .orderBy(asc(cbaClause.orderIndex));

    return { parent, clause, children };
  } catch (error) {
    logger.error("Error fetching clause hierarchy", { error, clauseId });
    throw new Error("Failed to fetch clause hierarchy");
  }
}

// ============================================================================
// Clause Comparison
// ============================================================================

/**
 * Compare multiple clauses
 * Note: Advanced AI analysis would be implemented here
 */
export async function compareClauses(
  request: ClauseComparisonRequest
): Promise<ClauseComparisonResult> {
  try {
    const clauses = await db
      .select()
      .from(cbaClause)
      .where(inArray(cbaClause.id, request.clauseIds));

    if (clauses.length === 0) {
      throw new Error("No clauses found for comparison");
    }

    // Basic comparison (would be enhanced with AI)
    const result: ClauseComparisonResult = {
      clauses,
      similarities: [],
      differences: [],
      bestPractices: [],
      recommendations: []
    };

    // Group by clause type
    const byType = clauses.reduce((acc, clause) => {
      if (!acc[clause.clauseType]) acc[clause.clauseType] = [];
      acc[clause.clauseType].push(clause);
      return acc;
    }, {} as Record<string, Clause[]>);

    // Find similarities
    Object.entries(byType).forEach(([type, typeClauses]) => {
      if (typeClauses.length > 1) {
        result.similarities.push({
          description: `All clauses are of type: ${type}`,
          clauseIds: typeClauses.map(c => c.id)
        });
      }
    });

    // Basic recommendations
    result.recommendations.push(
      "Consider standardizing clause language across CBAs",
      "Review clauses with lower confidence scores for accuracy",
      "Ensure all key terms are consistently defined"
    );

    return result;
  } catch (error) {
    logger.error("Error comparing clauses", { error, clauseIds: request.clauseIds });
    throw new Error("Failed to compare clauses");
  }
}

/**
 * Save clause comparison
 */
export async function saveClauseComparison(
  comparisonName: string,
  clauseType: string,
  clauseIds: string[],
  organizationId: string,
  createdBy: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysisResults?: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  try {
    const [comparison] = await db
      .insert(clauseComparisons)
      .values({
        comparisonName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clauseType: clauseType as any,
        clauseIds,
        organizationId,
        createdBy,
        analysisResults,
        createdAt: new Date(),
      })
      .returning();

    return comparison;
  } catch (error) {
    logger.error("Error saving clause comparison", { error, comparisonName });
    throw new Error("Failed to save clause comparison");
  }
}

// ============================================================================
// Wage Progressions
// ============================================================================

/**
 * Get wage progressions for a CBA
 */
export async function getWageProgressions(
  cbaId: string,
  classification?: string
): Promise<WageProgression[]> {
  try {
    const conditions = [eq(wageProgressions.cbaId, cbaId)];
    
    if (classification) {
      conditions.push(eq(wageProgressions.classification, classification));
    }

    const progressions = await db
      .select()
      .from(wageProgressions)
      .where(and(...conditions))
      .orderBy(asc(wageProgressions.classification), asc(wageProgressions.step));

    return progressions;
  } catch (error) {
    logger.error("Error fetching wage progressions", { error, cbaId });
    throw new Error("Failed to fetch wage progressions");
  }
}

/**
 * Create wage progression
 */
export async function createWageProgression(
  data: NewWageProgression
): Promise<WageProgression> {
  try {
    const [progression] = await db
      .insert(wageProgressions)
      .values(data)
      .returning();

    return progression;
  } catch (error) {
    logger.error("Error creating wage progression", { error });
    throw new Error("Failed to create wage progression");
  }
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get clause type distribution for a CBA
 */
export async function getClauseTypeDistribution(cbaId: string) {
  try {
    const distribution = await db
      .select({
        clauseType: cbaClause.clauseType,
        count: sql<number>`count(*)::int`,
      })
      .from(cbaClause)
      .where(eq(cbaClause.cbaId, cbaId))
      .groupBy(cbaClause.clauseType);

    return distribution;
  } catch (error) {
    logger.error("Error fetching clause type distribution", { error, cbaId });
    throw new Error("Failed to fetch clause type distribution");
  }
}

/**
 * Get most viewed clauses
 */
export async function getMostViewedClauses(
  limit: number = 10,
  cbaId?: string
): Promise<Clause[]> {
  try {
    let query = db
      .select()
      .from(cbaClause)
      .orderBy(desc(cbaClause.viewCount));

    if (cbaId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query.where(eq(cbaClause.cbaId, cbaId)) as any;
    }

    const clauses = await query.limit(limit);

    return clauses;
  } catch (error) {
    logger.error("Error fetching most viewed clauses", { error, cbaId, limit });
    throw new Error("Failed to fetch most viewed clauses");
  }
}

