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
import { withRLSContext } from "@/lib/db/with-rls-context";
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
export type ArbitrationDecisionSummary = Omit<ArbitrationDecision, 'fullText'> & {
  fullText?: string;
};

// arbitration_decisions is shared across organizations and has no organization column, so what a row permits is on the row:
// a decision marked not public, or carrying an access restriction, is never read through this library.
function sharedDecisions(): SQL {
  return and(
    eq(arbitrationDecisions.isPublic, true),
    or(sql`${arbitrationDecisions.accessRestrictions} is null`, eq(arbitrationDecisions.accessRestrictions, '')),
  ) as SQL;
}

/** The text of a search term with the LIKE wildcards taken literally, so a broad pattern cannot scan the whole text column. */
function containing(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}

export class PrecedentFilterError extends Error {
  readonly code = 'INVALID_PRECEDENT_FILTER';
}

/** A filter value that is not one of the column's declared values is refused, never cast through to the database. */
function checkedValues<T extends string>(values: string[] | undefined, allowed: readonly string[] | undefined, name: string): T[] | undefined {
  if (!values || values.length === 0) return undefined;
  if (allowed) {
    const rejected = values.find((value) => !allowed.includes(value));
    if (rejected !== undefined) throw new PrecedentFilterError(`Invalid ${name} filter value`);
  }
  return values as T[];
}

type TribunalFilter = ArbitrationDecision['tribunal'];
type DecisionTypeFilter = ArbitrationDecision['decisionType'];
type OutcomeFilter = ArbitrationDecision['outcome'];
type PrecedentValueFilter = ArbitrationDecision['precedentValue'];

function getMonetaryAward(
  remedy: ArbitrationDecision['remedy']
): number | undefined {
  return typeof remedy?.monetaryAward === 'number'
    ? remedy.monetaryAward
    : undefined;
}

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
): Promise<ArbitrationDecisionSummary | null> {
  try {
    const decision = await db.query.arbitrationDecisions.findFirst({
      where: and(eq(arbitrationDecisions.id, id), sharedDecisions()),
    });

    if (!decision) return null;

    // A read no longer counts itself. The old counter was a write by any tenant to a row owned by another, which a tenant may not
    // make once the library has an owner (platform 0051 / cache 0041); view_count is no longer maintained.

    // Optionally exclude full text if not needed
    if (!options.includeFullText) {
      const { fullText: _fullText, ...summary } = decision;
      return summary;
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
      where: and(eq(arbitrationDecisions.caseNumber, caseNumber), sharedDecisions()),
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
    const conditions: SQL[] = [sharedDecisions()];

    const tribunals = checkedValues<TribunalFilter>(filters.tribunal, arbitrationDecisions.tribunal?.enumValues, 'tribunal');
    if (tribunals) conditions.push(inArray(arbitrationDecisions.tribunal, tribunals));

    const decisionTypes = checkedValues<DecisionTypeFilter>(filters.decisionType, arbitrationDecisions.decisionType?.enumValues, 'decisionType');
    if (decisionTypes) conditions.push(inArray(arbitrationDecisions.decisionType, decisionTypes));

    const outcomes = checkedValues<OutcomeFilter>(filters.outcome, arbitrationDecisions.outcome?.enumValues, 'outcome');
    if (outcomes) conditions.push(inArray(arbitrationDecisions.outcome, outcomes));

    const precedentValues = checkedValues<PrecedentValueFilter>(filters.precedentValue, arbitrationDecisions.precedentValue?.enumValues, 'precedentValue');
    if (precedentValues) conditions.push(inArray(arbitrationDecisions.precedentValue, precedentValues));

    if (filters.arbitrator) {
      conditions.push(like(arbitrationDecisions.arbitrator, containing(filters.arbitrator)));
    }

    if (filters.union) {
      conditions.push(like(arbitrationDecisions.union, containing(filters.union)));
    }

    if (filters.employer) {
      conditions.push(like(arbitrationDecisions.employer, containing(filters.employer)));
    }

    if (filters.jurisdiction) {
      conditions.push(eq(arbitrationDecisions.jurisdiction, filters.jurisdiction));
    }

    if (filters.sector) {
      conditions.push(like(arbitrationDecisions.sector, containing(filters.sector)));
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
          like(arbitrationDecisions.caseTitle, containing(filters.searchQuery)),
          like(arbitrationDecisions.caseNumber, containing(filters.searchQuery)),
          like(arbitrationDecisions.summary, containing(filters.searchQuery)),
          like(arbitrationDecisions.headnote, containing(filters.searchQuery))
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
      .select()
      .from(arbitrationDecisions)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      precedents,
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
export async function createPrecedent(
  scope: { organizationId: string },
  data: Omit<NewArbitrationDecision, 'sourceOrganizationId' | 'isPublic' | 'accessRestrictions'>,
): Promise<ArbitrationDecision> {
  try {
    // The decision is owned by the organization that supplies it and is not shared until it is reviewed, whatever the caller sends.
    const [newDecision] = await withRLSContext({ organizationId: scope.organizationId }, (tx) => tx
      .insert(arbitrationDecisions)
      .values({
        ...data,
        sourceOrganizationId: scope.organizationId,
        isPublic: false,
        accessRestrictions: 'pending_review',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning());

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
  scope: { organizationId: string },
  id: string,
  data: Partial<Omit<NewArbitrationDecision, 'id' | 'sourceOrganizationId' | 'isPublic' | 'accessRestrictions'>>,
): Promise<ArbitrationDecision | null> {
  try {
    // Only the supplying organization changes its decision; publication and ownership are not editable here.
    const [updated] = await withRLSContext({ organizationId: scope.organizationId }, (tx) => tx
      .update(arbitrationDecisions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(arbitrationDecisions.id, id), eq(arbitrationDecisions.sourceOrganizationId, scope.organizationId)))
      .returning());

    return updated || null;
  } catch (error) {
    logger.error("Error updating precedent", { error, id });
    throw new Error("Failed to update precedent");
  }
}

/**
 * Delete a precedent
 */
export async function deletePrecedent(scope: { organizationId: string }, id: string): Promise<boolean> {
  try {
    const removed = await withRLSContext({ organizationId: scope.organizationId }, (tx) => tx
      .delete(arbitrationDecisions)
      .where(and(eq(arbitrationDecisions.id, id), eq(arbitrationDecisions.sourceOrganizationId, scope.organizationId)))
      .returning({ id: arbitrationDecisions.id }));

    return removed.length > 0;
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
  const precedentValues = checkedValues<PrecedentValueFilter>(filters.precedentValue, arbitrationDecisions.precedentValue?.enumValues, 'precedentValue');
  const tribunals = checkedValues<TribunalFilter>(filters.tribunal, arbitrationDecisions.tribunal?.enumValues, 'tribunal');
  try {
    const conditions: SQL[] = [
      sharedDecisions(),
      or(
        like(arbitrationDecisions.caseTitle, containing(query)),
        like(arbitrationDecisions.caseNumber, containing(query)),
        like(arbitrationDecisions.summary, containing(query)),
        like(arbitrationDecisions.headnote, containing(query)),
        like(arbitrationDecisions.fullText, containing(query))
      )!
    ];

    if (precedentValues) conditions.push(inArray(arbitrationDecisions.precedentValue, precedentValues));
    if (tribunals) conditions.push(inArray(arbitrationDecisions.tribunal, tribunals));

    const results = await db
      .select()
      .from(arbitrationDecisions)
      .where(and(...conditions))
      .orderBy(desc(arbitrationDecisions.precedentValue), desc(arbitrationDecisions.citationCount))
      .limit(limit);

    return results;
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
      .where(and(sharedDecisions(), sql`${arbitrationDecisions.issueTypes}::jsonb ? ${issueType}`))
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
    const conditions: SQL[] = [sharedDecisions()];

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
      .select()
      .from(arbitrationDecisions)
      .where(and(...conditions))
      .orderBy(desc(arbitrationDecisions.precedentValue))
      .limit(limit);

    return related;
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
      .map((decision) => getMonetaryAward(decision.remedy))
      .filter((award): award is number => typeof award === 'number');

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
      .where(sharedDecisions())
      .groupBy(arbitrationDecisions.outcome);

    const byTribunal = await db
      .select({
        tribunal: arbitrationDecisions.tribunal,
        count: sql<number>`count(*)::int`,
      })
      .from(arbitrationDecisions)
      .where(sharedDecisions())
      .groupBy(arbitrationDecisions.tribunal);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(arbitrationDecisions)
      .where(sharedDecisions());

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
      .where(sharedDecisions())
      .orderBy(desc(arbitrationDecisions.citationCount))
      .limit(limit);

    return precedents;
  } catch (error) {
    logger.error("Error fetching most cited precedents", { error, limit });
    throw new Error("Failed to fetch most cited precedents");
  }
}

