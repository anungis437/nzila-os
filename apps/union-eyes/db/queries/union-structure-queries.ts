"use server";

/**
 * Union Structure Query Functions
 * 
 * Provides data access layer for union operational structure:
 * - Employers (companies members work for)
 * - Worksites (physical work locations)
 * - Bargaining Units (certified units within locals)
 * - Committees (bargaining, grievance, safety, etc.)
 * - Committee Memberships (who sits on which committees)
 * - Steward Assignments (steward coverage by unit/worksite)
 * - Role Tenure History (historical role tracking)
 * 
 * Key Features:
 * - Row-Level Security (RLS) enforcement
 * - Soft deletes (archivedAt)
 * - Full relationship traversal
 * - Type-safe with TypeScript inference
 * - Transaction support for consistency
 * 
 * @module db/queries/union-structure-queries
 */

import {
  employers,
  worksites,
  bargainingUnits,
  committees,
  committeeMemberships,
  stewardAssignments,
  roleTenureHistory,
  type Employer,
  type NewEmployer,
  type Worksite,
  type NewWorksite,
  type BargainingUnit,
  type NewBargainingUnit,
  type Committee,
  type NewCommittee,
  type CommitteeMembership,
  type NewCommitteeMembership,
  type StewardAssignment,
  type NewStewardAssignment,
  type RoleTenureHistory,
  type NewRoleTenureHistory,
} from "@/db/schema/union-structure-schema";
import { eq, and, or, isNull, sql, desc, asc, like, between } from "drizzle-orm";
import { withRLSContext, type RLSTx } from "@/lib/db/with-rls-context";
import { logger } from "@/lib/logger";

// =====================================================
// EMPLOYER QUERIES
// =====================================================

/**
 * Create employer
 */
export async function createEmployer(
  data: NewEmployer,
   
  tx?: RLSTx
): Promise<Employer> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const result = (await dbOrTx.insert(employers).values(data).returning()) as Employer[];
      const employer = result[0]!;
      logger.info("Employer created", { employerId: employer.id, name: employer.name });
      return employer;
    } catch (error) {
      logger.error("Error creating employer", { error, data });
      throw new Error("Failed to create employer");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get employer by ID
 */
export async function getEmployerById(
  id: string,
   
  tx?: RLSTx
): Promise<Employer | null> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [employer] = await dbOrTx
        .select()
        .from(employers)
        .where(and(eq(employers.id, id), isNull(employers.archivedAt)))
        .limit(1);

      return employer ?? null;
    } catch (error) {
      logger.error("Error fetching employer by ID", { error, id });
      throw new Error(`Failed to fetch employer with ID ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * List employers by organization
 */
export async function listEmployersByOrganization(
  organizationId: string,
  options?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
   
  tx?: RLSTx
): Promise<Employer[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(employers)
        .where(
          and(
            eq(employers.organizationId, organizationId),
            isNull(employers.archivedAt)
          )
        )
        .$dynamic();

      if (options?.status) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.where(eq(employers.status, options.status as unknown));
      }

      if (options?.search) {
        query = query.where(
          or(
            like(employers.name, `%${options.search}%`),
            like(employers.legalName, `%${options.search}%`)
          )
        );
      }

      query = query.orderBy(asc(employers.name));

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      logger.error("Error listing employers", { error, organizationId });
      throw new Error("Failed to list employers");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Update employer
 */
export async function updateEmployer(
  id: string,
  data: Partial<Employer>,
   
  tx?: RLSTx
): Promise<Employer> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [employer] = await dbOrTx
        .update(employers)
        .set({ ...data, updatedAt: sql`NOW()` })
        .where(eq(employers.id, id))
        .returning();

      logger.info("Employer updated", { employerId: id });
      return employer;
    } catch (error) {
      logger.error("Error updating employer", { error, id });
      throw new Error(`Failed to update employer ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Archive employer (soft delete)
 */
export async function archiveEmployer(
  id: string,
   
  tx?: RLSTx
): Promise<void> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      await dbOrTx
        .update(employers)
        .set({ archivedAt: sql`NOW()`, status: 'archived' })
        .where(eq(employers.id, id));

      logger.info("Employer archived", { employerId: id });
    } catch (error) {
      logger.error("Error archiving employer", { error, id });
      throw new Error(`Failed to archive employer ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

// =====================================================
// WORKSITE QUERIES
// =====================================================

/**
 * Create worksite
 */
export async function createWorksite(
  data: NewWorksite,
   
  tx?: RLSTx
): Promise<Worksite> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [worksite] = await dbOrTx.insert(worksites).values(data).returning();
      logger.info("Worksite created", { worksiteId: worksite.id, name: worksite.name });
      return worksite;
    } catch (error) {
      logger.error("Error creating worksite", { error, data });
      throw new Error("Failed to create worksite");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get worksite by ID
 */
export async function getWorksiteById(
  id: string,
   
  tx?: RLSTx
): Promise<Worksite | null> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [worksite] = await dbOrTx
        .select()
        .from(worksites)
        .where(and(eq(worksites.id, id), isNull(worksites.archivedAt)))
        .limit(1);

      return worksite ?? null;
    } catch (error) {
      logger.error("Error fetching worksite by ID", { error, id });
      throw new Error(`Failed to fetch worksite with ID ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * List worksites by employer
 */
export async function listWorksitesByEmployer(
  employerId: string,
  options?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
   
  tx?: RLSTx
): Promise<Worksite[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(worksites)
        .where(
          and(
            eq(worksites.employerId, employerId),
            isNull(worksites.archivedAt)
          )
        )
        .$dynamic();

      if (options?.status) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.where(eq(worksites.status, options.status as unknown));
      }

      if (options?.search) {
        query = query.where(like(worksites.name, `%${options.search}%`));
      }

      query = query.orderBy(asc(worksites.name));

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      logger.error("Error listing worksites", { error, employerId });
      throw new Error("Failed to list worksites");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Update worksite
 */
export async function updateWorksite(
  id: string,
  data: Partial<Worksite>,
   
  tx?: RLSTx
): Promise<Worksite> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [worksite] = await dbOrTx
        .update(worksites)
        .set({ ...data, updatedAt: sql`NOW()` })
        .where(eq(worksites.id, id))
        .returning();

      logger.info("Worksite updated", { worksiteId: id });
      return worksite;
    } catch (error) {
      logger.error("Error updating worksite", { error, id });
      throw new Error(`Failed to update worksite ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Archive worksite (soft delete)
 */
export async function archiveWorksite(
  id: string,
   
  tx?: RLSTx
): Promise<void> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      await dbOrTx
        .update(worksites)
        .set({ archivedAt: sql`NOW()`, status: 'archived' })
        .where(eq(worksites.id, id));

      logger.info("Worksite archived", { worksiteId: id });
    } catch (error) {
      logger.error("Error archiving worksite", { error, id });
      throw new Error(`Failed to archive worksite ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

// =====================================================
// BARGAINING UNIT QUERIES
// =====================================================

/**
 * Create bargaining unit
 */
export async function createBargainingUnit(
  data: NewBargainingUnit,
   
  tx?: RLSTx
): Promise<BargainingUnit> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [unit] = await dbOrTx.insert(bargainingUnits).values(data).returning();
      logger.info("Bargaining unit created", { unitId: unit.id, name: unit.name });
      return unit;
    } catch (error) {
      logger.error("Error creating bargaining unit", { error, data });
      throw new Error("Failed to create bargaining unit");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get bargaining unit by ID
 */
export async function getBargainingUnitById(
  id: string,
   
  tx?: RLSTx
): Promise<BargainingUnit | null> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [unit] = await dbOrTx
        .select()
        .from(bargainingUnits)
        .where(and(eq(bargainingUnits.id, id), isNull(bargainingUnits.archivedAt)))
        .limit(1);

      return unit ?? null;
    } catch (error) {
      logger.error("Error fetching bargaining unit by ID", { error, id });
      throw new Error(`Failed to fetch bargaining unit with ID ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * List bargaining units by organization
 */
export async function listBargainingUnitsByOrganization(
  organizationId: string,
  options?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
   
  tx?: RLSTx
): Promise<BargainingUnit[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(bargainingUnits)
        .where(
          and(
            eq(bargainingUnits.organizationId, organizationId),
            isNull(bargainingUnits.archivedAt)
          )
        )
        .$dynamic();

      if (options?.status) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.where(eq(bargainingUnits.status, options.status as unknown));
      }

      if (options?.search) {
        query = query.where(
          or(
            like(bargainingUnits.name, `%${options.search}%`),
            like(bargainingUnits.unitNumber, `%${options.search}%`)
          )
        );
      }

      query = query.orderBy(asc(bargainingUnits.name));

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      logger.error("Error listing bargaining units", { error, organizationId });
      throw new Error("Failed to list bargaining units");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get units with expiring contracts (within next N days)
 */
export async function getUnitsWithExpiringContracts(
  organizationId: string,
  daysAhead: number = 90,
   
  tx?: RLSTx
): Promise<BargainingUnit[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const result = await dbOrTx
        .select()
        .from(bargainingUnits)
        .where(
          and(
            eq(bargainingUnits.organizationId, organizationId),
            isNull(bargainingUnits.archivedAt),
            between(
              bargainingUnits.contractExpiryDate,
              sql`CURRENT_DATE`,
              sql`CURRENT_DATE + INTERVAL '${sql.raw(daysAhead.toString())} days'`
            )
          )
        )
        .orderBy(asc(bargainingUnits.contractExpiryDate));

      return result;
    } catch (error) {
      logger.error("Error fetching units with expiring contracts", { error, organizationId });
      throw new Error("Failed to fetch units with expiring contracts");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Update bargaining unit
 */
export async function updateBargainingUnit(
  id: string,
  data: Partial<BargainingUnit>,
   
  tx?: RLSTx
): Promise<BargainingUnit> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [unit] = await dbOrTx
        .update(bargainingUnits)
        .set({ ...data, updatedAt: sql`NOW()` })
        .where(eq(bargainingUnits.id, id))
        .returning();

      logger.info("Bargaining unit updated", { unitId: id });
      return unit;
    } catch (error) {
      logger.error("Error updating bargaining unit", { error, id });
      throw new Error(`Failed to update bargaining unit ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Archive bargaining unit (soft delete)
 */
export async function archiveBargainingUnit(
  id: string,
   
  tx?: RLSTx
): Promise<void> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      await dbOrTx
        .update(bargainingUnits)
        .set({ archivedAt: sql`NOW()`, status: 'archived' })
        .where(eq(bargainingUnits.id, id));

      logger.info("Bargaining unit archived", { unitId: id });
    } catch (error) {
      logger.error("Error archiving bargaining unit", { error, id });
      throw new Error(`Failed to archive bargaining unit ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

// =====================================================
// COMMITTEE QUERIES
// =====================================================

/**
 * Create committee
 */
export async function createCommittee(
  data: NewCommittee,
   
  tx?: RLSTx
): Promise<Committee> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [committee] = await dbOrTx.insert(committees).values(data).returning();
      logger.info("Committee created", { committeeId: committee.id, name: committee.name });
      return committee;
    } catch (error) {
      logger.error("Error creating committee", { error, data });
      throw new Error("Failed to create committee");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get committee by ID
 */
export async function getCommitteeById(
  id: string,
   
  tx?: RLSTx
): Promise<Committee | null> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [committee] = await dbOrTx
        .select()
        .from(committees)
        .where(and(eq(committees.id, id), isNull(committees.archivedAt)))
        .limit(1);

      return committee ?? null;
    } catch (error) {
      logger.error("Error fetching committee by ID", { error, id });
      throw new Error(`Failed to fetch committee with ID ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * List committees by organization
 */
export async function listCommitteesByOrganization(
  organizationId: string,
  options?: {
    committeeType?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
   
  tx?: RLSTx
): Promise<Committee[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(committees)
        .where(
          and(
            eq(committees.organizationId, organizationId),
            isNull(committees.archivedAt)
          )
        )
        .$dynamic();

      if (options?.committeeType) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.where(eq(committees.committeeType, options.committeeType as unknown));
      }

      if (options?.status) {
        query = query.where(eq(committees.status, options.status));
      }

      if (options?.search) {
        query = query.where(like(committees.name, `%${options.search}%`));
      }

      query = query.orderBy(asc(committees.name));

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      logger.error("Error listing committees", { error, organizationId });
      throw new Error("Failed to list committees");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Update committee
 */
export async function updateCommittee(
  id: string,
  data: Partial<Committee>,
   
  tx?: RLSTx
): Promise<Committee> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [committee] = await dbOrTx
        .update(committees)
        .set({ ...data, updatedAt: sql`NOW()` })
        .where(eq(committees.id, id))
        .returning();

      logger.info("Committee updated", { committeeId: id });
      return committee;
    } catch (error) {
      logger.error("Error updating committee", { error, id });
      throw new Error(`Failed to update committee ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Archive committee (soft delete)
 */
export async function archiveCommittee(
  id: string,
   
  tx?: RLSTx
): Promise<void> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      await dbOrTx
        .update(committees)
        .set({ archivedAt: sql`NOW()`, status: 'archived' })
        .where(eq(committees.id, id));

      logger.info("Committee archived", { committeeId: id });
    } catch (error) {
      logger.error("Error archiving committee", { error, id });
      throw new Error(`Failed to archive committee ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

// =====================================================
// COMMITTEE MEMBERSHIP QUERIES
// =====================================================

/**
 * Create committee membership
 */
export async function createCommitteeMembership(
  data: NewCommitteeMembership,
   
  tx?: RLSTx
): Promise<CommitteeMembership> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [membership] = await dbOrTx
        .insert(committeeMemberships)
        .values(data)
        .returning();

      logger.info("Committee membership created", { 
        membershipId: membership.id,
        committeeId: membership.committeeId,
        memberId: membership.memberId,
      });

      // Update committee member count
      await dbOrTx
        .update(committees)
        .set({
          currentMemberCount: sql`${committees.currentMemberCount} + 1`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(committees.id, membership.committeeId));

      return membership;
    } catch (error) {
      logger.error("Error creating committee membership", { error, data });
      throw new Error("Failed to create committee membership");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get committee memberships for a member
 */
export async function getMemberCommitteeMemberships(
  memberId: string,
  options?: {
    active?: boolean;
    committeeType?: string;
  },
   
  tx?: RLSTx
): Promise<CommitteeMembership[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(committeeMemberships)
        .where(eq(committeeMemberships.memberId, memberId))
        .$dynamic();

      if (options?.active) {
        query = query.where(
          and(
            eq(committeeMemberships.status, 'active'),
            isNull(committeeMemberships.endDate)
          )
        );
      }

      query = query.orderBy(desc(committeeMemberships.startDate));

      return await query;
    } catch (error) {
      logger.error("Error fetching member committee memberships", { error, memberId });
      throw new Error("Failed to fetch committee memberships");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get committee members
 */
export async function getCommitteeMembers(
  committeeId: string,
  options?: {
    active?: boolean;
  },
   
  tx?: RLSTx
): Promise<CommitteeMembership[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(committeeMemberships)
        .where(eq(committeeMemberships.committeeId, committeeId))
        .$dynamic();

      if (options?.active) {
        query = query.where(
          and(
            eq(committeeMemberships.status, 'active'),
            isNull(committeeMemberships.endDate)
          )
        );
      }

      query = query.orderBy(asc(committeeMemberships.role));

      return await query;
    } catch (error) {
      logger.error("Error fetching committee members", { error, committeeId });
      throw new Error("Failed to fetch committee members");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * End committee membership
 */
export async function endCommitteeMembership(
  id: string,
  endDate: string,
   
  tx?: RLSTx
): Promise<CommitteeMembership> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [membership] = await dbOrTx
        .update(committeeMemberships)
        .set({ 
          endDate,
          status: 'inactive',
          updatedAt: sql`NOW()`,
        })
        .where(eq(committeeMemberships.id, id))
        .returning();

      logger.info("Committee membership ended", { membershipId: id });

      // Update committee member count
      await dbOrTx
        .update(committees)
        .set({
          currentMemberCount: sql`GREATEST(0, ${committees.currentMemberCount} - 1)`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(committees.id, membership.committeeId));

      return membership;
    } catch (error) {
      logger.error("Error ending committee membership", { error, id });
      throw new Error("Failed to end committee membership");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

// =====================================================
// STEWARD ASSIGNMENT QUERIES
// =====================================================

/**
 * Create steward assignment
 */
export async function createStewardAssignment(
  data: NewStewardAssignment,
   
  tx?: RLSTx
): Promise<StewardAssignment> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [assignment] = await dbOrTx
        .insert(stewardAssignments)
        .values(data)
        .returning();

      logger.info("Steward assignment created", {
        assignmentId: assignment.id,
        stewardId: assignment.stewardId,
        unitId: assignment.unitId,
      });

      return assignment;
    } catch (error) {
      logger.error("Error creating steward assignment", { error, data });
      throw new Error("Failed to create steward assignment");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get steward assignments for a member
 */
export async function getMemberStewardAssignments(
  stewardId: string,
  options?: {
    active?: boolean;
  },
   
  tx?: RLSTx
): Promise<StewardAssignment[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(stewardAssignments)
        .where(eq(stewardAssignments.stewardId, stewardId))
        .$dynamic();

      if (options?.active) {
        query = query.where(
          and(
            eq(stewardAssignments.status, 'active'),
            isNull(stewardAssignments.endDate)
          )
        );
      }

      query = query.orderBy(desc(stewardAssignments.startDate));

      return await query;
    } catch (error) {
      logger.error("Error fetching member steward assignments", { error, stewardId });
      throw new Error("Failed to fetch steward assignments");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get stewards for a unit
 */
export async function getUnitStewards(
  unitId: string,
  options?: {
    active?: boolean;
    stewardType?: string;
  },
   
  tx?: RLSTx
): Promise<StewardAssignment[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(stewardAssignments)
        .where(eq(stewardAssignments.unitId, unitId))
        .$dynamic();

      if (options?.active) {
        query = query.where(
          and(
            eq(stewardAssignments.status, 'active'),
            isNull(stewardAssignments.endDate)
          )
        );
      }

      if (options?.stewardType) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.where(eq(stewardAssignments.stewardType, options.stewardType as unknown));
      }

      query = query.orderBy(asc(stewardAssignments.stewardType));

      return await query;
    } catch (error) {
      logger.error("Error fetching unit stewards", { error, unitId });
      throw new Error("Failed to fetch unit stewards");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * End steward assignment
 */
export async function endStewardAssignment(
  id: string,
  endDate: string,
   
  tx?: RLSTx
): Promise<StewardAssignment> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [assignment] = await dbOrTx
        .update(stewardAssignments)
        .set({ 
          endDate,
          status: 'inactive',
          updatedAt: sql`NOW()`,
        })
        .where(eq(stewardAssignments.id, id))
        .returning();

      logger.info("Steward assignment ended", { assignmentId: id });
      return assignment;
    } catch (error) {
      logger.error("Error ending steward assignment", { error, id });
      throw new Error("Failed to end steward assignment");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

// =====================================================
// ROLE TENURE HISTORY QUERIES
// =====================================================

/**
 * Create role tenure record
 */
export async function createRoleTenureHistory(
  data: NewRoleTenureHistory,
   
  tx?: RLSTx
): Promise<RoleTenureHistory> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      // End any existing current roles of the same type for this member
      if (data.isCurrentRole) {
        await dbOrTx
          .update(roleTenureHistory)
          .set({
            isCurrentRole: false,
            updatedAt: sql`NOW()`,
          })
          .where(
            and(
              eq(roleTenureHistory.memberId, data.memberId!),
              eq(roleTenureHistory.roleType, data.roleType!),
              eq(roleTenureHistory.isCurrentRole, true)
            )
          );
      }

      const [tenure] = await dbOrTx
        .insert(roleTenureHistory)
        .values(data)
        .returning();

      logger.info("Role tenure history created", {
        tenureId: tenure.id,
        memberId: tenure.memberId,
        roleTitle: tenure.roleTitle,
      });

      return tenure;
    } catch (error) {
      logger.error("Error creating role tenure history", { error, data });
      throw new Error("Failed to create role tenure history");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get member role history
 */
export async function getMemberRoleHistory(
  memberId: string,
  options?: {
    currentOnly?: boolean;
    roleType?: string;
  },
   
  tx?: RLSTx
): Promise<RoleTenureHistory[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(roleTenureHistory)
        .where(eq(roleTenureHistory.memberId, memberId))
        .$dynamic();

      if (options?.currentOnly) {
        query = query.where(eq(roleTenureHistory.isCurrentRole, true));
      }

      if (options?.roleType) {
        query = query.where(eq(roleTenureHistory.roleType, options.roleType));
      }

      query = query.orderBy(desc(roleTenureHistory.startDate));

      return await query;
    } catch (error) {
      logger.error("Error fetching member role history", { error, memberId });
      throw new Error("Failed to fetch role history");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * End role tenure
 */
export async function endRoleTenure(
  id: string,
  endDate: string,
  endReason: string,
  endedBy?: string,
   
  tx?: RLSTx
): Promise<RoleTenureHistory> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      const [tenure] = await dbOrTx
        .update(roleTenureHistory)
        .set({
          endDate,
          endReason,
          endedBy,
          isCurrentRole: false,
          updatedAt: sql`NOW()`,
        })
        .where(eq(roleTenureHistory.id, id))
        .returning();

      logger.info("Role tenure ended", { tenureId: id, endReason });
      return tenure;
    } catch (error) {
      logger.error("Error ending role tenure", { error, id });
      throw new Error("Failed to end role tenure");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}

/**
 * Get organization role history (all members)
 */
export async function getOrganizationRoleHistory(
  organizationId: string,
  options?: {
    roleType?: string;
    currentOnly?: boolean;
    limit?: number;
    offset?: number;
  },
   
  tx?: RLSTx
): Promise<RoleTenureHistory[]> {
   
  const executeQuery = async (dbOrTx: RLSTx) => {
    try {
      let query = dbOrTx
        .select()
        .from(roleTenureHistory)
        .where(eq(roleTenureHistory.organizationId, organizationId))
        .$dynamic();

      if (options?.roleType) {
        query = query.where(eq(roleTenureHistory.roleType, options.roleType));
      }

      if (options?.currentOnly) {
        query = query.where(eq(roleTenureHistory.isCurrentRole, true));
      }

      query = query.orderBy(desc(roleTenureHistory.startDate));

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      logger.error("Error fetching organization role history", { error, organizationId });
      throw new Error("Failed to fetch organization role history");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
     
    return withRLSContext(async (tx: RLSTx) => executeQuery(tx));
  }
}
