"use server";

import { eq, and, desc, sql, count } from "drizzle-orm";
import { claims, claimUpdates } from "../schema/claims-schema";
import { organizations } from "../schema-organizations";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { logger } from "@/lib/logger";

// Type for inserting a new claim
export type InsertClaim = typeof claims.$inferInsert;
export type SelectClaim = typeof claims.$inferSelect;

/**
 * Create a new claim
 */
export const createClaim = async (
  data: Omit<InsertClaim, 'claimId' | 'claimNumber' | 'createdAt' | 'updatedAt'>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      // Generate claim number (format: CASE-YYYYMMDD-XXXX)
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get count of claims today to generate sequential number
      const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      
      const todayCount = await dbOrTx
        .select({ count: count() })
        .from(claims)
        .where(
          and(
            sql`${claims.createdAt} >= ${todayStart}`,
            sql`${claims.createdAt} < ${todayEnd}`
          )
        );
      
      const sequentialNum = (todayCount[0]?.count || 0) + 1;
      const claimNumber = `CASE-${dateStr}-${sequentialNum.toString().padStart(4, '0')}`;
      
      const [newClaim] = await dbOrTx
        .insert(claims)
        .values({
          ...data,
          claimNumber,
        })
        .returning();
      
      logger.info("Created claim", { claimNumber });
      return newClaim;
    } catch (error) {
      logger.error("Error creating claim", { error });
      throw new Error("Failed to create claim");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Get all claims for a specific member
 */
export const getClaimsByMember = async (
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const memberClaims = await dbOrTx
        .select()
        .from(claims)
        .where(eq(claims.memberId, memberId))
        .orderBy(desc(claims.createdAt));
      
      return memberClaims;
    } catch (error) {
      logger.error("Error fetching claims by member", { error, memberId });
      throw new Error("Failed to fetch claims");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Get all claims for an organization
 * @param organizationSlug - Organization slug (TEXT) from organization_members.organization_id
 */
export const getClaimsByOrganization = async (
  organizationSlug: string,
  limit?: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      // Convert organization slug to UUID
      const [org] = await dbOrTx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, organizationSlug))
        .limit(1);
      
      if (!org) {
        throw new Error(`Organization with slug ${organizationSlug} not found`);
      }
      
      const orgId = org.id;
      
      let query = dbOrTx
        .select()
        .from(claims)
        .where(eq(claims.organizationId, orgId))
        .orderBy(desc(claims.createdAt));
      
      if (limit) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.limit(limit) as any;
      }
      
      const organizationClaims = await query;
      return organizationClaims;
    } catch (error) {
      logger.error("Error fetching claims by organization", { error, organizationSlug });
      throw new Error("Failed to fetch claims");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Get a single claim by ID
 */
export const getClaimById = async (
  claimId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [claim] = await dbOrTx
        .select()
        .from(claims)
        .where(eq(claims.claimId, claimId));
      
      return claim;
    } catch (error) {
      logger.error("Error fetching claim", { error, claimId });
      throw new Error("Failed to fetch claim");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Update claim status
 */
export const updateClaimStatus = async (
  claimId: string, 
  newStatus: SelectClaim['status'],
  updatedBy: string,
  notes?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      // Update the claim
      const [updatedClaim] = await dbOrTx
        .update(claims)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(claims.claimId, claimId))
        .returning();
      
      // Create an update record
      await dbOrTx.insert(claimUpdates).values({
        claimId,
        updateType: 'status_change',
        message: notes || `Status changed to ${newStatus}`,
        createdBy: updatedBy,
      });
      
      return updatedClaim;
    } catch (error) {
      logger.error("Error updating claim status", { error, claimId, newStatus });
      throw new Error("Failed to update claim status");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Assign claim to a user
 */
export const assignClaim = async (
  claimId: string,
  assignedTo: string,
  assignedBy: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [updatedClaim] = await dbOrTx
        .update(claims)
        .set({
          assignedTo,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(claims.claimId, claimId))
        .returning();
      
      // Create an update record
      await dbOrTx.insert(claimUpdates).values({
        claimId,
        updateType: 'assignment',
        message: `Claim assigned to user ${assignedTo}`,
        createdBy: assignedBy,
      });
      
      return updatedClaim;
    } catch (error) {
      logger.error("Error assigning claim", { error, claimId, assignedTo });
      throw new Error("Failed to assign claim");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Get claims assigned to a specific user (for stewards/officers)
 * @param organizationSlug - Optional organization slug (TEXT) from organization_members.organization_id
 */
export const getClaimsAssignedToUser = async (
  userId: string,
  organizationSlug?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const conditions = [eq(claims.assignedTo, userId)];
      
      // Filter by organization if provided (for multi-tenant isolation)
      if (organizationSlug) {
        // Convert organization slug to UUID
        const [org] = await dbOrTx
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.slug, organizationSlug))
          .limit(1);
        
        if (org) {
          conditions.push(eq(claims.organizationId, org.id));
        }
      }
      
      const assignedClaims = await dbOrTx
        .select()
        .from(claims)
        .where(and(...conditions))
        .orderBy(desc(claims.priority), desc(claims.createdAt));
      
      return assignedClaims;
    } catch (error) {
      logger.error("Error fetching assigned claims", { error, userId, organizationSlug });
      throw new Error("Failed to fetch assigned claims");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Get claim statistics for dashboard
 */
export const getClaimStatistics = async (
  organizationSlugOrId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      // Check if input is a UUID (contains hyphens and is 36 chars) or a slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationSlugOrId);
      
      // Convert organization slug/id to UUID
      const [org] = await dbOrTx
        .select({ id: organizations.id })
        .from(organizations)
        .where(
          isUUID 
            ? eq(organizations.id, organizationSlugOrId)
            : eq(organizations.slug, organizationSlugOrId)
        )
        .limit(1);
      
      if (!org) {
        throw new Error(`Organization with ${isUUID ? 'id' : 'slug'} ${organizationSlugOrId} not found`);
      }
      
      const orgId = org.id;
      
      // Total active claims (not resolved or closed)
      const [activeClaims] = await dbOrTx
        .select({ count: count() })
        .from(claims)
        .where(
          and(
            eq(claims.organizationId, orgId),
            sql`${claims.status} NOT IN ('resolved', 'closed', 'rejected')`
          )
        );
      
      // Pending reviews (submitted or under review)
      const [pendingReviews] = await dbOrTx
        .select({ count: count() })
        .from(claims)
        .where(
          and(
            eq(claims.organizationId, orgId),
            sql`${claims.status} IN ('submitted', 'under_review')`
          )
        );
      
      // Resolved cases
      const [resolvedCases] = await dbOrTx
        .select({ count: count() })
        .from(claims)
        .where(
          and(
            eq(claims.organizationId, orgId),
            eq(claims.status, 'resolved')
          )
        );
      
      // High priority claims
      const [highPriorityClaims] = await dbOrTx
        .select({ count: count() })
        .from(claims)
        .where(
          and(
            eq(claims.organizationId, orgId),
            sql`${claims.priority} IN ('high', 'critical')`,
            sql`${claims.status} NOT IN ('resolved', 'closed', 'rejected')`
          )
        );
      
      return {
        activeClaims: activeClaims.count,
        pendingReviews: pendingReviews.count,
        resolvedCases: resolvedCases.count,
        highPriorityClaims: highPriorityClaims.count,
      };
    } catch (error) {
      logger.error("Error fetching claim statistics", { error, organizationSlugOrId });
      throw new Error("Failed to fetch statistics");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Get recent claim updates/activity
 */
export const getRecentClaimUpdates = async (
  claimId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const updates = await dbOrTx
        .select()
        .from(claimUpdates)
        .where(eq(claimUpdates.claimId, claimId))
        .orderBy(desc(claimUpdates.createdAt))
        .limit(20);
      
      return updates;
    } catch (error) {
      logger.error("Error fetching claim updates", { error, claimId });
      throw new Error("Failed to fetch updates");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Add a note/comment to a claim
 */
export const addClaimUpdate = async (
  claimId: string,
  message: string,
  createdBy: string,
  updateType: string = 'note',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [newUpdate] = await dbOrTx
        .insert(claimUpdates)
        .values({
          claimId,
          updateType,
          message,
          createdBy,
        })
        .returning();
      
      // Update last activity timestamp on the claim
      await dbOrTx
        .update(claims)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(claims.claimId, claimId));
      
      return newUpdate;
    } catch (error) {
      logger.error("Error adding claim update", { error, claimId, updateType });
      throw new Error("Failed to add update");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Delete a claim (soft delete by setting status to closed)
 */
export const deleteClaim = async (
  claimId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [deletedClaim] = await dbOrTx
        .update(claims)
        .set({
          status: 'closed',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(claims.claimId, claimId))
        .returning();
      
      return deletedClaim;
    } catch (error) {
      logger.error("Error deleting claim", { error, claimId });
      throw new Error("Failed to delete claim");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

