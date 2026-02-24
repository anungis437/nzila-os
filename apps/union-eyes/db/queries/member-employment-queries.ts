"use server";

/**
 * Member Employment Query Functions
 * 
 * Phase 1.2: Member Profile v2 - Employment Attributes
 * 
 * Provides data access layer for member employment records:
 * - Member Employment (core employment data)
 * - Employment History (change tracking)
 * - Member Leaves (leave management)
 * - Job Classifications (classification system)
 * 
 * Key Features:
 * - Row-Level Security (RLS) enforcement
 * - Full relationship traversal
 * - Type-safe with TypeScript inference
 * - Transaction support for consistency
 * - Seniority calculation helpers
 * - Dues calculation data extraction
 * 
 * @module db/queries/member-employment-queries
 */

import {
  memberEmployment,
  employmentHistory,
  memberLeaves,
  jobClassifications,
  type MemberEmployment,
  type NewMemberEmployment,
  type EmploymentHistory,
  type NewEmploymentHistory,
  type MemberLeave,
  type NewMemberLeave,
  type JobClassification,
  type NewJobClassification,
} from "@/db/schema/domains/member/member-employment";
import { eq, and, or, isNull, desc, asc, gte, lte } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { logger } from "@/lib/logger";

// =====================================================
// MEMBER EMPLOYMENT QUERIES
// =====================================================

/**
 * Create member employment record
 */
export async function createMemberEmployment(
  data: NewMemberEmployment,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberEmployment> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [employment] = await dbOrTx.insert(memberEmployment).values(data).returning();
      logger.info("Member employment created", { 
        employmentId: employment.id, 
        memberId: employment.memberId,
        jobTitle: employment.jobTitle 
      });
      return employment;
    } catch (error) {
      logger.error("Error creating member employment", error as Error, { data });
      throw new Error("Failed to create member employment");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get member employment by ID
 */
export async function getMemberEmploymentById(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberEmployment | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [employment] = await dbOrTx
        .select()
        .from(memberEmployment)
        .where(eq(memberEmployment.id, id))
        .limit(1);

      return employment ?? null;
    } catch (error) {
      logger.error("Error fetching member employment by ID", error as Error, { id });
      throw new Error(`Failed to fetch member employment with ID ${id}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get active employment record for a member
 */
export async function getActiveMemberEmployment(
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberEmployment | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [employment] = await dbOrTx
        .select()
        .from(memberEmployment)
        .where(
          and(
            eq(memberEmployment.memberId, memberId),
            eq(memberEmployment.employmentStatus, "active")
          )
        )
        .orderBy(desc(memberEmployment.hireDate))
        .limit(1);

      return employment ?? null;
    } catch (error) {
      logger.error("Error fetching active member employment", error as Error, { memberId });
      throw new Error(`Failed to fetch active employment for member ${memberId}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get all employment records for a member (including historical)
 */
export async function getAllMemberEmployment(
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberEmployment[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      return await dbOrTx
        .select()
        .from(memberEmployment)
        .where(eq(memberEmployment.memberId, memberId))
        .orderBy(desc(memberEmployment.hireDate));
    } catch (error) {
      logger.error("Error fetching all member employment", error as Error, { memberId });
      throw new Error(`Failed to fetch employment records for member ${memberId}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get employment records by organization
 */
export async function getEmploymentByOrganization(
  organizationId: string,
  status?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberEmployment[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const conditions = [eq(memberEmployment.organizationId, organizationId)];
      if (status) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        conditions.push(eq(memberEmployment.employmentStatus, status as any));
      }

      return await dbOrTx
        .select()
        .from(memberEmployment)
        .where(and(...conditions))
        .orderBy(asc(memberEmployment.jobTitle));
    } catch (error) {
      logger.error("Error fetching employment by organization", error as Error, { organizationId });
      throw new Error(`Failed to fetch employment records for organization ${organizationId}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Update member employment
 */
export async function updateMemberEmployment(
  id: string,
  data: Partial<NewMemberEmployment>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberEmployment> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [employment] = await dbOrTx
        .update(memberEmployment)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(memberEmployment.id, id))
        .returning();

      logger.info("Member employment updated", { employmentId: id });
      return employment;
    } catch (error) {
      logger.error("Error updating member employment", error as Error, { id, data });
      throw new Error("Failed to update member employment");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Delete member employment (hard delete - use with caution)
 */
export async function deleteMemberEmployment(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      await dbOrTx
        .delete(memberEmployment)
        .where(eq(memberEmployment.id, id));

      logger.info("Member employment deleted", { employmentId: id });
    } catch (error) {
      logger.error("Error deleting member employment", error as Error, { id });
      throw new Error("Failed to delete member employment");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get employment data for dues calculation
 * Returns member employment with compensation fields needed by dues engine
 */
export async function getEmploymentForDuesCalculation(
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<{
  grossWages?: number;
  baseSalary?: number;
  hourlyRate?: number;
  hoursWorked?: number;
  employmentStatus: string;
  payFrequency: string;
} | null> {
  const employment = await getActiveMemberEmployment(memberId, tx);
  
  if (!employment) {
    return null;
  }

  return {
    grossWages: employment.grossWages ? parseFloat(employment.grossWages.toString()) : undefined,
    baseSalary: employment.baseSalary ? parseFloat(employment.baseSalary.toString()) : undefined,
    hourlyRate: employment.hourlyRate ? parseFloat(employment.hourlyRate.toString()) : undefined,
    hoursWorked: employment.regularHoursPerPeriod ? parseFloat(employment.regularHoursPerPeriod.toString()) : undefined,
    employmentStatus: employment.employmentStatus,
    payFrequency: employment.payFrequency,
  };
}

// =====================================================
// EMPLOYMENT HISTORY QUERIES
// =====================================================

/**
 * Create employment history record
 */
export async function createEmploymentHistory(
  data: NewEmploymentHistory,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<EmploymentHistory> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [history] = await dbOrTx.insert(employmentHistory).values(data).returning();
      logger.info("Employment history created", { 
        historyId: history.id, 
        memberId: history.memberId,
        changeType: history.changeType 
      });
      return history;
    } catch (error) {
      logger.error("Error creating employment history", error as Error, { data });
      throw new Error("Failed to create employment history");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get employment history for a member
 */
export async function getEmploymentHistoryByMember(
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<EmploymentHistory[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      return await dbOrTx
        .select()
        .from(employmentHistory)
        .where(eq(employmentHistory.memberId, memberId))
        .orderBy(desc(employmentHistory.effectiveDate));
    } catch (error) {
      logger.error("Error fetching employment history", error as Error, { memberId });
      throw new Error(`Failed to fetch employment history for member ${memberId}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

// =====================================================
// MEMBER LEAVES QUERIES
// =====================================================

/**
 * Create member leave
 */
export async function createMemberLeave(
  data: NewMemberLeave,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberLeave> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [leave] = await dbOrTx.insert(memberLeaves).values(data).returning();
      logger.info("Member leave created", { 
        leaveId: leave.id, 
        memberId: leave.memberId,
        leaveType: leave.leaveType 
      });
      return leave;
    } catch (error) {
      logger.error("Error creating member leave", error as Error, { data });
      throw new Error("Failed to create member leave");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get active leaves for a member
 */
export async function getActiveMemberLeaves(
  memberId: string,
  currentDate?: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberLeave[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const now = currentDate || new Date();
      const nowStr = now.toISOString().split('T')[0];

      return await dbOrTx
        .select()
        .from(memberLeaves)
        .where(
          and(
            eq(memberLeaves.memberId, memberId),
            lte(memberLeaves.startDate, nowStr),
            or(
              isNull(memberLeaves.endDate),
              gte(memberLeaves.endDate, nowStr)
            )
          )
        )
        .orderBy(desc(memberLeaves.startDate));
    } catch (error) {
      logger.error("Error fetching active member leaves", error as Error, { memberId });
      throw new Error(`Failed to fetch active leaves for member ${memberId}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get all leaves for a member
 */
export async function getAllMemberLeaves(
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberLeave[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      return await dbOrTx
        .select()
        .from(memberLeaves)
        .where(eq(memberLeaves.memberId, memberId))
        .orderBy(desc(memberLeaves.startDate));
    } catch (error) {
      logger.error("Error fetching all member leaves", error as Error, { memberId });
      throw new Error(`Failed to fetch leaves for member ${memberId}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Update member leave
 */
export async function updateMemberLeave(
  id: string,
  data: Partial<NewMemberLeave>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<MemberLeave> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [leave] = await dbOrTx
        .update(memberLeaves)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(memberLeaves.id, id))
        .returning();

      logger.info("Member leave updated", { leaveId: id });
      return leave;
    } catch (error) {
      logger.error("Error updating member leave", error as Error, { id, data });
      throw new Error("Failed to update member leave");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

// =====================================================
// JOB CLASSIFICATIONS QUERIES
// =====================================================

/**
 * Create job classification
 */
export async function createJobClassification(
  data: NewJobClassification,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<JobClassification> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [classification] = await dbOrTx.insert(jobClassifications).values(data).returning();
      logger.info("Job classification created", { 
        classificationId: classification.id,
        jobCode: classification.jobCode,
        jobTitle: classification.jobTitle 
      });
      return classification;
    } catch (error) {
      logger.error("Error creating job classification", error as Error, { data });
      throw new Error("Failed to create job classification");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get job classification by code
 */
export async function getJobClassificationByCode(
  organizationId: string,
  jobCode: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<JobClassification | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [classification] = await dbOrTx
        .select()
        .from(jobClassifications)
        .where(
          and(
            eq(jobClassifications.organizationId, organizationId),
            eq(jobClassifications.jobCode, jobCode),
            eq(jobClassifications.isActive, true)
          )
        )
        .limit(1);

      return classification ?? null;
    } catch (error) {
      logger.error("Error fetching job classification by code", error as Error, { jobCode });
      throw new Error(`Failed to fetch job classification for code ${jobCode}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Get all job classifications for an organization
 */
export async function getJobClassificationsByOrganization(
  organizationId: string,
  activeOnly: boolean = true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<JobClassification[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const conditions = [eq(jobClassifications.organizationId, organizationId)];
      if (activeOnly) {
        conditions.push(eq(jobClassifications.isActive, true));
      }

      return await dbOrTx
        .select()
        .from(jobClassifications)
        .where(and(...conditions))
        .orderBy(asc(jobClassifications.jobCode));
    } catch (error) {
      logger.error("Error fetching job classifications", error as Error, { organizationId });
      throw new Error(`Failed to fetch job classifications for organization ${organizationId}`);
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

/**
 * Update job classification
 */
export async function updateJobClassification(
  id: string,
  data: Partial<NewJobClassification>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<JobClassification> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [classification] = await dbOrTx
        .update(jobClassifications)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(jobClassifications.id, id))
        .returning();

      logger.info("Job classification updated", { classificationId: id });
      return classification;
    } catch (error) {
      logger.error("Error updating job classification", error as Error, { id, data });
      throw new Error("Failed to update job classification");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Calculate seniority years based on dates and leaves
 */
export async function calculateSeniorityYears(
  seniorityDate: Date,
  currentDate?: Date,
  memberId?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<number> {
  const now = currentDate || new Date();
  let totalDays = Math.floor((now.getTime() - seniorityDate.getTime()) / (1000 * 60 * 60 * 24));

  // If memberId provided, subtract leave days that affect seniority
  if (memberId) {
    const leaves = await getAllMemberLeaves(memberId, tx);
    const adjustmentDays = leaves
      .filter(leave => leave.affectsSeniority && leave.seniorityAdjustmentDays)
      .reduce((sum, leave) => sum + (leave.seniorityAdjustmentDays || 0), 0);
    
    totalDays -= adjustmentDays;
  }

  return Math.max(0, totalDays / 365.25); // Account for leap years
}

