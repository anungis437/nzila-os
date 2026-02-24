/**
 * Precedent Service - Arbitration Decision Operations
 * 
 * Provides comprehensive precedent management including:
 * - Arbitration decision CRUD operations
 * - Precedent search and filtering
 * - Arbitrator analytics
 * - Citation tracking
 * - Claim-to-precedent matching
 */

import { db } from "@/db/db";
import {
  arbitrationDecisions,
  arbitratorProfiles,
} from "@/db/schema";
import { eq, and, or, like, desc, asc, sql, inArray, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type NewArbitrationDecision = typeof arbitrationDecisions.$inferInsert;
export type ArbitrationDecision = typeof arbitrationDecisions.$inferSelect;
export type NewArbitratorProfile = typeof arbitratorProfiles.$inferInsert;
export type ArbitratorProfile = typeof arbitratorProfiles.$inferSelect;

export interface PrecedentFilters {
  tribunal?: string[];
  decisionType?: string[];
  outcome?: string[];
  precedentValue?: string[];
  arbitrator?: string;
  union?: string;
  employer?: string;
  jurisdiction?: string;
  sector?: string;
  dateFrom?: Date;
  dateTo?: Date;
  issueTypes?: string[];
  searchQuery?: string;
}

export interface PrecedentSearchOptions {
  includeFullText?: boolean;
  includeSummary?: boolean;
  includeRelated?: boolean;
}

export interface PrecedentComparisonRequest {
  decisionIds: string[];
  focusArea?: "outcome" | "remedy" | "reasoning";
}

// ============================================================================
// CRUD Operations - Arbitration Decisions
// ============================================================================

/**
 * Get arbitration decision by ID
 */
export async function getPrecedentById(
  id: string,
  options: PrecedentSearchOptions = {}
): Promise<ArbitrationDecision | null> {
  try {
    const decision = await db.query.arbitrationDecisions.findFirst({
      where: eq(arbitrationDecisions.id, id),
    });

    if (!decision) return null;

    // Increment view count
    await db
      .update(arbitrationDecisions)
      .set({ 
        viewCount: sql`${arbitrationDecisions.viewCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(arbitrationDecisions.id, id));

    // Optionally exclude full text if not needed
    if (!options.includeFullText) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { ...decision, fullText: undefined } as any;
    }

    return decision;
  } catch (error) {
    logger.error("Error fetching precedent by ID", { error, id });
    throw new Error("Failed to fetch precedent");
  }
}

/**
 * Get arbitration decision by case number
 */
export async function getPrecedentByCaseNumber(
  caseNumber: string
): Promise<ArbitrationDecision | null> {
  try {
    const decision = await db.query.arbitrationDecisions.findFirst({
      where: eq(arbitrationDecisions.caseNumber, caseNumber),
    });

    return decision || null;
  } catch (error) {
    logger.error("Error fetching precedent by case number", { error, caseNumber });
    throw new Error("Failed to fetch precedent by case number");
  }
}

/**
 * List arbitration decisions with filtering
 */
export async function listPrecedents(
  filters: PrecedentFilters = {},
  pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc" } = {}
): Promise<{ precedents: ArbitrationDecision[]; total: number; page: number; limit: number }> {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "decisionDate",
      sortOrder = "desc"
    } = pagination;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [];

    if (filters.tribunal && filters.tribunal.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(arbitrationDecisions.tribunal, filters.tribunal as any));
    }

    if (filters.decisionType && filters.decisionType.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(arbitrationDecisions.decisionType, filters.decisionType as any));
    }

    if (filters.outcome && filters.outcome.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(arbitrationDecisions.outcome, filters.outcome as any));
    }

    if (filters.precedentValue && filters.precedentValue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(arbitrationDecisions.precedentValue, filters.precedentValue as any));
    }

    if (filters.arbitrator) {
      conditions.push(like(arbitrationDecisions.arbitrator, `%${filters.arbitrator}%`));
    }

    if (filters.union) {
      conditions.push(like(arbitrationDecisions.union, `%${filters.union}%`));
    }

    if (filters.employer) {
      conditions.push(like(arbitrationDecisions.employer, `%${filters.employer}%`));
    }

    if (filters.jurisdiction) {
      conditions.push(eq(arbitrationDecisions.jurisdiction, filters.jurisdiction));
    }

    if (filters.sector) {
      conditions.push(like(arbitrationDecisions.sector, `%${filters.sector}%`));
    }

    if (filters.dateFrom) {
      conditions.push(gte(arbitrationDecisions.decisionDate, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(arbitrationDecisions.decisionDate, filters.dateTo));
    }

    if (filters.searchQuery) {
      conditions.push(
        or(
          like(arbitrationDecisions.caseTitle, `%${filters.searchQuery}%`),
          like(arbitrationDecisions.caseNumber, `%${filters.searchQuery}%`),
          like(arbitrationDecisions.summary, `%${filters.searchQuery}%`),
          like(arbitrationDecisions.headnote, `%${filters.searchQuery}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(arbitrationDecisions)
      .where(whereClause);

    // Get decisions with sorting
    const sortColumn = sortBy === "decisionDate" 
      ? arbitrationDecisions.decisionDate
      : sortBy === "citationCount"
      ? arbitrationDecisions.citationCount
      : arbitrationDecisions.createdAt;

    const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const precedents = await db
      .select({
        id: arbitrationDecisions.id,
        caseNumber: arbitrationDecisions.caseNumber,
        caseTitle: arbitrationDecisions.caseTitle,
        tribunal: arbitrationDecisions.tribunal,
        decisionType: arbitrationDecisions.decisionType,
        decisionDate: arbitrationDecisions.decisionDate,
        arbitrator: arbitrationDecisions.arbitrator,
        union: arbitrationDecisions.union,
        employer: arbitrationDecisions.employer,
        outcome: arbitrationDecisions.outcome,
        precedentValue: arbitrationDecisions.precedentValue,
        summary: arbitrationDecisions.summary,
        headnote: arbitrationDecisions.headnote,
        issueTypes: arbitrationDecisions.issueTypes,
        jurisdiction: arbitrationDecisions.jurisdiction,
        sector: arbitrationDecisions.sector,
        citationCount: arbitrationDecisions.citationCount,
        viewCount: arbitrationDecisions.viewCount,
        createdAt: arbitrationDecisions.createdAt,
      })
      .from(arbitrationDecisions)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      precedents: precedents as any,
      total: count,
      page,
      limit
    };
  } catch (error) {
    logger.error("Error listing precedents", { error, filters, pagination });
    throw new Error("Failed to list precedents");
  }
}

/**
 * Create a new arbitration decision
 */
export async function createPrecedent(data: NewArbitrationDecision): Promise<ArbitrationDecision> {
  try {
    const [newDecision] = await db
      .insert(arbitrationDecisions)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Update arbitrator profile if exists
    if (data.arbitrator) {
      await updateArbitratorStats(data.arbitrator);
    }

    return newDecision;
  } catch (error) {
    logger.error("Error creating precedent", { error, data });
    throw new Error("Failed to create precedent");
  }
}

/**
 * Update an arbitration decision
 */
export async function updatePrecedent(
  id: string,
  data: Partial<NewArbitrationDecision>
): Promise<ArbitrationDecision | null> {
  try {
    const [updated] = await db
      .update(arbitrationDecisions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(arbitrationDecisions.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating precedent", { error, id });
    throw new Error("Failed to update precedent");
  }
}

/**
 * Delete a precedent
 */
export async function deletePrecedent(id: string): Promise<boolean> {
  try {
    await db
      .delete(arbitrationDecisions)
      .where(eq(arbitrationDecisions.id, id));

    return true;
  } catch (error) {
    logger.error("Error deleting precedent", { error, id });
    throw new Error("Failed to delete precedent");
  }
}

// ============================================================================
// Search and Analysis
// ============================================================================

/**
 * Search arbitration decisions
 */
export async function searchPrecedents(
  query: string,
  filters: Omit<PrecedentFilters, "searchQuery"> = {},
  limit: number = 50
): Promise<ArbitrationDecision[]> {
  try {
    const conditions: SQL[] = [
      or(
        like(arbitrationDecisions.caseTitle, `%${query}%`),
        like(arbitrationDecisions.caseNumber, `%${query}%`),
        like(arbitrationDecisions.summary, `%${query}%`),
        like(arbitrationDecisions.headnote, `%${query}%`),
        like(arbitrationDecisions.fullText, `%${query}%`)
      )!
    ];

    if (filters.precedentValue && filters.precedentValue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(arbitrationDecisions.precedentValue, filters.precedentValue as any));
    }

    if (filters.tribunal && filters.tribunal.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(inArray(arbitrationDecisions.tribunal, filters.tribunal as any));
    }

    const results = await db
      .select({
        id: arbitrationDecisions.id,
        caseNumber: arbitrationDecisions.caseNumber,
        caseTitle: arbitrationDecisions.caseTitle,
        tribunal: arbitrationDecisions.tribunal,
        decisionType: arbitrationDecisions.decisionType,
        decisionDate: arbitrationDecisions.decisionDate,
        arbitrator: arbitrationDecisions.arbitrator,
        union: arbitrationDecisions.union,
        employer: arbitrationDecisions.employer,
        outcome: arbitrationDecisions.outcome,
        precedentValue: arbitrationDecisions.precedentValue,
        summary: arbitrationDecisions.summary,
        headnote: arbitrationDecisions.headnote,
        issueTypes: arbitrationDecisions.issueTypes,
        jurisdiction: arbitrationDecisions.jurisdiction,
        sector: arbitrationDecisions.sector,
        citationCount: arbitrationDecisions.citationCount,
        viewCount: arbitrationDecisions.viewCount,
      })
      .from(arbitrationDecisions)
      .where(and(...conditions))
      .orderBy(desc(arbitrationDecisions.precedentValue), desc(arbitrationDecisions.citationCount))
      .limit(limit);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results as any;
  } catch (error) {
    logger.error("Error searching precedents", { error, query, filters, limit });
    throw new Error("Failed to search precedents");
  }
}

/**
 * Get precedents by issue type
 */
export async function getPrecedentsByIssueType(
  issueType: string,
  limit: number = 20
): Promise<ArbitrationDecision[]> {
  try {
    // This would use JSONB operations in production
    const results = await db
      .select()
      .from(arbitrationDecisions)
      .where(sql`${arbitrationDecisions.issueTypes}::jsonb ? ${issueType}`)
      .orderBy(desc(arbitrationDecisions.precedentValue), desc(arbitrationDecisions.decisionDate))
      .limit(limit);

    return results;
  } catch (error) {
    logger.error("Error fetching precedents by issue type", { error, issueType, limit });
    throw new Error("Failed to fetch precedents by issue type");
  }
}

/**
 * Get related precedents
 */
export async function getRelatedPrecedents(
  decisionId: string,
  limit: number = 10
): Promise<ArbitrationDecision[]> {
  try {
    const decision = await getPrecedentById(decisionId, { includeFullText: false });
    
    if (!decision) return [];

    // Find related decisions based on similar criteria
    const conditions: SQL[] = [];

    if (decision.issueTypes) {
      // Would use vector similarity or JSONB overlap in production
      conditions.push(sql`${arbitrationDecisions.issueTypes}::jsonb && ${decision.issueTypes}::jsonb`);
    }

    if (decision.sector) {
      conditions.push(eq(arbitrationDecisions.sector, decision.sector));
    }

    // Exclude the current decision
    conditions.push(sql`${arbitrationDecisions.id} != ${decisionId}`);

    const related = await db
      .select({
        id: arbitrationDecisions.id,
        caseNumber: arbitrationDecisions.caseNumber,
        caseTitle: arbitrationDecisions.caseTitle,
        decisionDate: arbitrationDecisions.decisionDate,
        arbitrator: arbitrationDecisions.arbitrator,
        outcome: arbitrationDecisions.outcome,
        precedentValue: arbitrationDecisions.precedentValue,
        summary: arbitrationDecisions.summary,
      })
      .from(arbitrationDecisions)
      .where(and(...conditions))
      .orderBy(desc(arbitrationDecisions.precedentValue))
      .limit(limit);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return related as any;
  } catch (error) {
    logger.error("Error fetching related precedents", { error, decisionId, limit });
    throw new Error("Failed to fetch related precedents");
  }
}

// ============================================================================
// Arbitrator Analytics
// ============================================================================

/**
 * Get arbitrator profile
 */
export async function getArbitratorProfile(name: string): Promise<ArbitratorProfile | null> {
  try {
    const profile = await db.query.arbitratorProfiles.findFirst({
      where: eq(arbitratorProfiles.name, name),
    });

    return profile || null;
  } catch (error) {
    logger.error("Error fetching arbitrator profile", { error, name });
    throw new Error("Failed to fetch arbitrator profile");
  }
}

/**
 * Update arbitrator statistics
 * This should be called after adding/updating decisions
 */
export async function updateArbitratorStats(arbitratorName: string): Promise<void> {
  try {
    // Get all decisions by this arbitrator
    const decisions = await db
      .select()
      .from(arbitrationDecisions)
      .where(eq(arbitrationDecisions.arbitrator, arbitratorName));

    if (decisions.length === 0) return;

    // Calculate statistics
    const totalDecisions = decisions.length;
    const grievorSuccess = decisions.filter(d => 
      d.outcome === "grievance_upheld" || d.outcome === "partial_success"
    ).length;
    const employerSuccess = decisions.filter(d => 
      d.outcome === "grievance_denied"
    ).length;

    const grievorSuccessRate = ((grievorSuccess / totalDecisions) * 100).toFixed(2);
    const employerSuccessRate = ((employerSuccess / totalDecisions) * 100).toFixed(2);

    // Calculate monetary awards
    const monetaryAwards = decisions
      .filter(d => d.remedy && typeof d.remedy === 'object' && 'monetaryAward' in d.remedy)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(d => (d.remedy as any).monetaryAward)
      .filter(a => typeof a === 'number');

    const averageAward = monetaryAwards.length > 0
      ? (monetaryAwards.reduce((a, b) => a + b, 0) / monetaryAwards.length).toFixed(2)
      : null;

    // Get specializations (issue types)
    const issueTypesFlat = decisions
      .filter(d => d.issueTypes)
      .flatMap(d => d.issueTypes as string[]);
    const specializations = [...new Set(issueTypesFlat)];

    // Upsert arbitrator profile
    const existingProfile = await getArbitratorProfile(arbitratorName);

    if (existingProfile) {
      await db
        .update(arbitratorProfiles)
        .set({
          totalDecisions,
          grievorSuccessRate: grievorSuccessRate,
          employerSuccessRate: employerSuccessRate,
          averageAwardAmount: averageAward,
          specializations,
          lastDecisionDate: decisions[0].decisionDate,
          updated: new Date(),
        })
        .where(eq(arbitratorProfiles.name, arbitratorName));
    } else {
      await db
        .insert(arbitratorProfiles)
        .values({
          name: arbitratorName,
          totalDecisions,
          grievorSuccessRate: grievorSuccessRate,
          employerSuccessRate: employerSuccessRate,
          averageAwardAmount: averageAward,
          specializations,
          lastDecisionDate: decisions[0].decisionDate,
          isActive: true,
          updated: new Date(),
        });
    }
  } catch (error) {
    logger.error("Error updating arbitrator stats", { error, arbitratorName });
    // Don&apos;t throw - this is a background operation
  }
}

/**
 * List top arbitrators by decision count
 */
export async function getTopArbitrators(limit: number = 20): Promise<ArbitratorProfile[]> {
  try {
    const profiles = await db
      .select()
      .from(arbitratorProfiles)
      .where(eq(arbitratorProfiles.isActive, true))
      .orderBy(desc(arbitratorProfiles.totalDecisions))
      .limit(limit);

    return profiles;
  } catch (error) {
    logger.error("Error fetching top arbitrators", { error, limit });
    throw new Error("Failed to fetch top arbitrators");
  }
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get precedent statistics
 */
export async function getPrecedentStatistics() {
  try {
    const byOutcome = await db
      .select({
        outcome: arbitrationDecisions.outcome,
        count: sql<number>`count(*)::int`,
      })
      .from(arbitrationDecisions)
      .groupBy(arbitrationDecisions.outcome);

    const byTribunal = await db
      .select({
        tribunal: arbitrationDecisions.tribunal,
        count: sql<number>`count(*)::int`,
      })
      .from(arbitrationDecisions)
      .groupBy(arbitrationDecisions.tribunal);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(arbitrationDecisions);

    return {
      total,
      byOutcome,
      byTribunal,
    };
  } catch (error) {
    logger.error("Error fetching precedent statistics", { error });
    throw new Error("Failed to fetch precedent statistics");
  }
}

/**
 * Get most cited precedents
 */
export async function getMostCitedPrecedents(limit: number = 10): Promise<ArbitrationDecision[]> {
  try {
    const precedents = await db
      .select()
      .from(arbitrationDecisions)
      .orderBy(desc(arbitrationDecisions.citationCount))
      .limit(limit);

    return precedents;
  } catch (error) {
    logger.error("Error fetching most cited precedents", { error, limit });
    throw new Error("Failed to fetch most cited precedents");
  }
}

