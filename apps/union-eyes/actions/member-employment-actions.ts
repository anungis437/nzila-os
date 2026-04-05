"use server";

/**
 * Member Employment Server Actions
 * 
 * Phase 1.2: Member Profile v2 - Employment Attributes
 * 
 * Server actions for member employment management including:
 * - Member Employment (core employment data)
 * - Employment History (change tracking)
 * - Member Leaves (leave management)
 * - Job Classifications (classification system)
 * 
 * @module actions/member-employment-actions
 */

import { auth } from '@nzila/platform-auth/entra/server';
import {
  createMemberEmployment,
  getMemberEmploymentById,
  getActiveMemberEmployment,
  getAllMemberEmployment,
  getEmploymentByOrganization,
  updateMemberEmployment,
  deleteMemberEmployment,
  getEmploymentForDuesCalculation,
  createEmploymentHistory,
  getEmploymentHistoryByMember,
  createMemberLeave,
  getActiveMemberLeaves,
  getAllMemberLeaves,
  updateMemberLeave,
  createJobClassification,
  getJobClassificationByCode,
  getJobClassificationsByOrganization,
  updateJobClassification,
  calculateSeniorityYears,
} from "@/db/queries/member-employment-queries";

import type {
  MemberEmployment,
  NewMemberEmployment,
  EmploymentHistory,
  NewEmploymentHistory,
  MemberLeave,
  NewMemberLeave,
  JobClassification,
  NewJobClassification,
} from "@/db/schema/domains/member/member-employment";

import { ActionResult } from "@/types/actions/actions-types";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

// =============================================================================
// MEMBER EMPLOYMENT ACTIONS
// =============================================================================

export async function createMemberEmploymentAction(
  data: NewMemberEmployment
): Promise<ActionResult<MemberEmployment>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    const employment = await createMemberEmployment(data);
    revalidatePath("/dashboard/admin/employment");
    revalidatePath("/dashboard/members");
    return {
      isSuccess: true,
      message: "Employment record created successfully",
      data: employment,
    };
  } catch (error) {
    logger.error("Failed to create employment record", error as Error, { data });
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to create employment record",
    };
  }
}

export async function getMemberEmploymentByIdAction(
  id: string
): Promise<ActionResult<MemberEmployment | null>> {
  try {
    const employment = await getMemberEmploymentById(id);
    return {
      isSuccess: true,
      message: "Employment record retrieved successfully",
      data: employment,
    };
  } catch (error) {
    logger.error("Failed to get employment record", error as Error, { id });
    return {
      isSuccess: false,
      message: "Failed to retrieve employment record",
    };
  }
}

export async function getActiveMemberEmploymentAction(
  memberId: string
): Promise<ActionResult<MemberEmployment | null>> {
  try {
    const employment = await getActiveMemberEmployment(memberId);
    return {
      isSuccess: true,
      message: "Active employment retrieved successfully",
      data: employment,
    };
  } catch (error) {
    logger.error("Failed to get active employment", error as Error, { memberId });
    return {
      isSuccess: false,
      message: "Failed to retrieve active employment",
    };
  }
}

export async function getAllMemberEmploymentAction(
  memberId: string
): Promise<ActionResult<MemberEmployment[]>> {
  try {
    const employmentRecords = await getAllMemberEmployment(memberId);
    return {
      isSuccess: true,
      message: "Employment records retrieved successfully",
      data: employmentRecords,
    };
  } catch (error) {
    logger.error("Failed to get all employment records", error as Error, { memberId });
    return {
      isSuccess: false,
      message: "Failed to retrieve employment records",
    };
  }
}

export async function getEmploymentByOrganizationAction(
  organizationId: string,
  status?: string
): Promise<ActionResult<MemberEmployment[]>> {
  try {
    const employmentRecords = await getEmploymentByOrganization(organizationId, status);
    return {
      isSuccess: true,
      message: "Organization employment records retrieved successfully",
      data: employmentRecords,
    };
  } catch (error) {
    logger.error("Failed to get organization employment", error as Error, { organizationId, status });
    return {
      isSuccess: false,
      message: "Failed to retrieve organization employment records",
    };
  }
}

export async function updateMemberEmploymentAction(
  id: string,
  data: Partial<NewMemberEmployment>
): Promise<ActionResult<MemberEmployment>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    const updatedEmployment = await updateMemberEmployment(id, data);
    revalidatePath("/dashboard/admin/employment");
    revalidatePath("/dashboard/members");
    return {
      isSuccess: true,
      message: "Employment record updated successfully",
      data: updatedEmployment,
    };
  } catch (error) {
    logger.error("Failed to update employment record", error as Error, { id, data });
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to update employment record",
    };
  }
}

export async function deleteMemberEmploymentAction(
  id: string
): Promise<ActionResult<void>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    await deleteMemberEmployment(id);
    revalidatePath("/dashboard/admin/employment");
    revalidatePath("/dashboard/members");
    return {
      isSuccess: true,
      message: "Employment record deleted successfully",
    };
  } catch (error) {
    logger.error("Failed to delete employment record", error as Error, { id });
    return {
      isSuccess: false,
      message: "Failed to delete employment record",
    };
  }
}

export async function getEmploymentForDuesCalculationAction(
  memberId: string
): Promise<ActionResult<{
  grossWages?: number;
  baseSalary?: number;
  hourlyRate?: number;
  hoursWorked?: number;
  employmentStatus: string;
  payFrequency: string;
} | null>> {
  try {
    const duesData = await getEmploymentForDuesCalculation(memberId);
    return {
      isSuccess: true,
      message: "Dues calculation data retrieved successfully",
      data: duesData,
    };
  } catch (error) {
    logger.error("Failed to get dues calculation data", error as Error, { memberId });
    return {
      isSuccess: false,
      message: "Failed to retrieve dues calculation data",
    };
  }
}

// =============================================================================
// EMPLOYMENT HISTORY ACTIONS
// =============================================================================

export async function createEmploymentHistoryAction(
  data: NewEmploymentHistory
): Promise<ActionResult<EmploymentHistory>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    const history = await createEmploymentHistory(data);
    revalidatePath("/dashboard/admin/employment");
    return {
      isSuccess: true,
      message: "Employment history record created successfully",
      data: history,
    };
  } catch (error) {
    logger.error("Failed to create employment history", error as Error, { data });
    return {
      isSuccess: false,
      message: "Failed to create employment history record",
    };
  }
}

export async function getEmploymentHistoryByMemberAction(
  memberId: string
): Promise<ActionResult<EmploymentHistory[]>> {
  try {
    const history = await getEmploymentHistoryByMember(memberId);
    return {
      isSuccess: true,
      message: "Employment history retrieved successfully",
      data: history,
    };
  } catch (error) {
    logger.error("Failed to get employment history", error as Error, { memberId });
    return {
      isSuccess: false,
      message: "Failed to retrieve employment history",
    };
  }
}

// =============================================================================
// MEMBER LEAVES ACTIONS
// =============================================================================

export async function createMemberLeaveAction(
  data: NewMemberLeave
): Promise<ActionResult<MemberLeave>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    const leave = await createMemberLeave(data);
    revalidatePath("/dashboard/admin/employment");
    revalidatePath("/dashboard/members");
    return {
      isSuccess: true,
      message: "Leave request created successfully",
      data: leave,
    };
  } catch (error) {
    logger.error("Failed to create leave request", error as Error, { data });
    return {
      isSuccess: false,
      message: "Failed to create leave request",
    };
  }
}

export async function getActiveMemberLeavesAction(
  memberId: string,
  currentDate?: Date
): Promise<ActionResult<MemberLeave[]>> {
  try {
    const leaves = await getActiveMemberLeaves(memberId, currentDate);
    return {
      isSuccess: true,
      message: "Active leaves retrieved successfully",
      data: leaves,
    };
  } catch (error) {
    logger.error("Failed to get active leaves", error as Error, { memberId });
    return {
      isSuccess: false,
      message: "Failed to retrieve active leaves",
    };
  }
}

export async function getAllMemberLeavesAction(
  memberId: string
): Promise<ActionResult<MemberLeave[]>> {
  try {
    const leaves = await getAllMemberLeaves(memberId);
    return {
      isSuccess: true,
      message: "Leave records retrieved successfully",
      data: leaves,
    };
  } catch (error) {
    logger.error("Failed to get leave records", error as Error, { memberId });
    return {
      isSuccess: false,
      message: "Failed to retrieve leave records",
    };
  }
}

export async function updateMemberLeaveAction(
  id: string,
  data: Partial<NewMemberLeave>
): Promise<ActionResult<MemberLeave>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    const updatedLeave = await updateMemberLeave(id, data);
    revalidatePath("/dashboard/admin/employment");
    revalidatePath("/dashboard/members");
    return {
      isSuccess: true,
      message: "Leave record updated successfully",
      data: updatedLeave,
    };
  } catch (error) {
    logger.error("Failed to update leave record", error as Error, { id, data });
    return {
      isSuccess: false,
      message: "Failed to update leave record",
    };
  }
}

export async function approveMemberLeaveAction(
  id: string
): Promise<ActionResult<MemberLeave>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Unauthorized - must be logged in to approve leave requests",
      };
    }

    const updatedLeave = await updateMemberLeave(id, {
      isApproved: true,
      approvedBy: userId,
      approvedAt: new Date(),
    });
    revalidatePath("/dashboard/admin/employment");
    revalidatePath("/dashboard/members");
    return {
      isSuccess: true,
      message: "Leave request approved successfully",
      data: updatedLeave,
    };
  } catch (error) {
    logger.error("Failed to approve leave request", error as Error, { id });
    return {
      isSuccess: false,
      message: "Failed to approve leave request",
    };
  }
}

// =============================================================================
// JOB CLASSIFICATIONS ACTIONS
// =============================================================================

export async function createJobClassificationAction(
  data: NewJobClassification
): Promise<ActionResult<JobClassification>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    const classification = await createJobClassification(data);
    revalidatePath("/dashboard/admin/employment");
    return {
      isSuccess: true,
      message: "Job classification created successfully",
      data: classification,
    };
  } catch (error) {
    logger.error("Failed to create job classification", error as Error, { data });
    return {
      isSuccess: false,
      message: "Failed to create job classification",
    };
  }
}

export async function getJobClassificationByCodeAction(
  organizationId: string,
  jobCode: string
): Promise<ActionResult<JobClassification | null>> {
  try {
    const classification = await getJobClassificationByCode(organizationId, jobCode);
    return {
      isSuccess: true,
      message: "Job classification retrieved successfully",
      data: classification,
    };
  } catch (error) {
    logger.error("Failed to get job classification", error as Error, { organizationId, jobCode });
    return {
      isSuccess: false,
      message: "Failed to retrieve job classification",
    };
  }
}

export async function getJobClassificationsByOrganizationAction(
  organizationId: string,
  activeOnly: boolean = true
): Promise<ActionResult<JobClassification[]>> {
  try {
    const classifications = await getJobClassificationsByOrganization(organizationId, activeOnly);
    return {
      isSuccess: true,
      message: "Job classifications retrieved successfully",
      data: classifications,
    };
  } catch (error) {
    logger.error("Failed to get job classifications", error as Error, { organizationId, activeOnly });
    return {
      isSuccess: false,
      message: "Failed to retrieve job classifications",
    };
  }
}

export async function updateJobClassificationAction(
  id: string,
  data: Partial<NewJobClassification>
): Promise<ActionResult<JobClassification>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    const updatedClassification = await updateJobClassification(id, data);
    revalidatePath("/dashboard/admin/employment");
    return {
      isSuccess: true,
      message: "Job classification updated successfully",
      data: updatedClassification,
    };
  } catch (error) {
    logger.error("Failed to update job classification", error as Error, { id, data });
    return {
      isSuccess: false,
      message: "Failed to update job classification",
    };
  }
}

// =============================================================================
// UTILITY ACTIONS
// =============================================================================

export async function calculateSeniorityYearsAction(
  seniorityDate: string,
  currentDate?: Date,
  memberId?: string
): Promise<ActionResult<number>> {
  try {
    const years = await calculateSeniorityYears(new Date(seniorityDate), currentDate, memberId);
    return {
      isSuccess: true,
      message: "Seniority years calculated successfully",
      data: years,
    };
  } catch (error) {
    logger.error("Failed to calculate seniority years", error as Error, { seniorityDate, memberId });
    return {
      isSuccess: false,
      message: "Failed to calculate seniority years",
    };
  }
}
