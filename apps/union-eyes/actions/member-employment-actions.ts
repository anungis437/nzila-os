"use server";

/**
 * Member employment server actions.
 *
 * Every action resolves `auth()` through `authorizeEmploymentAccess` and
 * passes that sealed grant into the query layer. Reads require the same
 * employment-administration allow-list as writes. Individual pay is included
 * only when that grant has finance disclosure. Dues compensation requires the
 * finance allow-list and `financial_intelligence_suite`.
 * Member self-service is not granted.
 */

import { revalidatePath } from "next/cache";
import { authorizeEmploymentAccess } from "@/lib/member-employment/authorize-employment-access";
import { logger } from "@/lib/logger";
import { EmploymentBoundaryError } from "@/db/queries/member-employment-queries";
import {
  approveMemberLeave,
  calculateSeniorityYears,
  createEmploymentHistory,
  createJobClassification,
  createMemberEmployment,
  createMemberLeave,
  deleteMemberEmployment,
  getActiveMemberEmployment,
  getActiveMemberLeaves,
  getAllMemberEmployment,
  getAllMemberLeaves,
  getEmploymentByOrganization,
  getEmploymentForDuesCalculation,
  getEmploymentHistoryByMember,
  getJobClassificationByCode,
  getJobClassificationsByOrganization,
  getMemberEmploymentById,
  updateJobClassification,
  updateMemberEmployment,
  updateMemberLeave,
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

function failure(message: string): ActionResult<never> {
  return { isSuccess: false, message }
}

async function requireAdmin(organizationId: string | null | undefined) {
  return authorizeEmploymentAccess(organizationId ?? '', 'administer')
}

function safeMessage(error: unknown, fallback: string): string {
  if (error instanceof EmploymentBoundaryError) return error.message
  return fallback
}

function logFailure(operation: string, error: unknown, fields: Record<string, string | undefined>): void {
  logger.error(operation, new Error(operation), {
    ...fields,
    errorName: error instanceof Error ? error.name : 'error',
  })
}

function revalidateEmployment(): void {
  revalidatePath("/dashboard/admin/employment")
  revalidatePath("/dashboard/members")
}

export async function createMemberEmploymentAction(
  data: NewMemberEmployment
): Promise<ActionResult<MemberEmployment>> {
  const access = await requireAdmin(data?.organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const employment = await createMemberEmployment(access, data)
    revalidateEmployment()
    return { isSuccess: true, message: "Employment record created successfully", data: employment }
  } catch (error) {
    logFailure("Failed to create employment record", error, { organizationId: access.organizationId })
    return failure(safeMessage(error, "Failed to create employment record"))
  }
}

export async function getMemberEmploymentByIdAction(
  id: string,
  organizationId: string,
): Promise<ActionResult<MemberEmployment | null>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const employment = await getMemberEmploymentById(access, id)
    return { isSuccess: true, message: "Employment record retrieved successfully", data: employment }
  } catch (error) {
    logFailure("Failed to get employment record", error, { organizationId: access.organizationId, id })
    return failure("Failed to retrieve employment record")
  }
}

export async function getActiveMemberEmploymentAction(
  memberId: string,
  organizationId: string,
): Promise<ActionResult<MemberEmployment | null>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const employment = await getActiveMemberEmployment(access, memberId)
    return { isSuccess: true, message: "Active employment retrieved successfully", data: employment }
  } catch (error) {
    logFailure("Failed to get active employment", error, { organizationId: access.organizationId })
    return failure("Failed to retrieve active employment")
  }
}

export async function getAllMemberEmploymentAction(
  memberId: string,
  organizationId: string,
): Promise<ActionResult<MemberEmployment[]>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const employmentRecords = await getAllMemberEmployment(access, memberId)
    return { isSuccess: true, message: "Employment records retrieved successfully", data: employmentRecords }
  } catch (error) {
    logFailure("Failed to get all employment records", error, { organizationId: access.organizationId })
    return failure("Failed to retrieve employment records")
  }
}

export async function getEmploymentByOrganizationAction(
  organizationId: string,
  status?: string
): Promise<ActionResult<MemberEmployment[]>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const employmentRecords = await getEmploymentByOrganization(access, status)
    return {
      isSuccess: true,
      message: "Organization employment records retrieved successfully",
      data: employmentRecords,
    }
  } catch (error) {
    logFailure("Failed to get organization employment", error, { organizationId: access.organizationId })
    return failure("Failed to retrieve organization employment records")
  }
}

export async function updateMemberEmploymentAction(
  id: string,
  data: Partial<NewMemberEmployment>
): Promise<ActionResult<MemberEmployment>> {
  const access = await requireAdmin(data?.organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const updatedEmployment = await updateMemberEmployment(access, id, data)
    revalidateEmployment()
    return { isSuccess: true, message: "Employment record updated successfully", data: updatedEmployment }
  } catch (error) {
    logFailure("Failed to update employment record", error, { organizationId: access.organizationId, id })
    return failure(safeMessage(error, "Failed to update employment record"))
  }
}

export async function deleteMemberEmploymentAction(
  id: string,
  organizationId: string,
): Promise<ActionResult<void>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    await deleteMemberEmployment(access, id)
    revalidateEmployment()
    return { isSuccess: true, message: "Employment record deleted successfully" }
  } catch (error) {
    logFailure("Failed to delete employment record", error, { organizationId: access.organizationId, id })
    return failure(safeMessage(error, "Failed to delete employment record"))
  }
}

export async function getEmploymentForDuesCalculationAction(
  memberId: string,
  organizationId: string,
): Promise<ActionResult<{
  grossWages?: number
  baseSalary?: number
  hourlyRate?: number
  hoursWorked?: number
  employmentStatus: string
  payFrequency: string
} | null>> {
  const access = await authorizeEmploymentAccess(organizationId, 'finance')
  if (!access.ok) return failure(access.message)
  try {
    const duesData = await getEmploymentForDuesCalculation(access, memberId)
    return { isSuccess: true, message: "Dues calculation data retrieved successfully", data: duesData }
  } catch (error) {
    logFailure("Failed to get dues calculation data", error, { organizationId: access.organizationId })
    return failure("Failed to retrieve dues calculation data")
  }
}

export async function createEmploymentHistoryAction(
  data: NewEmploymentHistory
): Promise<ActionResult<EmploymentHistory>> {
  const access = await requireAdmin(data?.organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const history = await createEmploymentHistory(access, data)
    revalidatePath("/dashboard/admin/employment")
    return { isSuccess: true, message: "Employment history record created successfully", data: history }
  } catch (error) {
    logFailure("Failed to create employment history", error, { organizationId: access.organizationId })
    return failure(safeMessage(error, "Failed to create employment history record"))
  }
}

export async function getEmploymentHistoryByMemberAction(
  memberId: string,
  organizationId: string,
): Promise<ActionResult<EmploymentHistory[]>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const history = await getEmploymentHistoryByMember(access, memberId)
    return { isSuccess: true, message: "Employment history retrieved successfully", data: history }
  } catch (error) {
    logFailure("Failed to get employment history", error, { organizationId: access.organizationId })
    return failure("Failed to retrieve employment history")
  }
}

export async function createMemberLeaveAction(
  data: NewMemberLeave
): Promise<ActionResult<MemberLeave>> {
  const access = await requireAdmin(data?.organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const leave = await createMemberLeave(access, data)
    revalidateEmployment()
    return { isSuccess: true, message: "Leave request created successfully", data: leave }
  } catch (error) {
    logFailure("Failed to create leave request", error, { organizationId: access.organizationId })
    return failure(safeMessage(error, "Failed to create leave request"))
  }
}

export async function getActiveMemberLeavesAction(
  memberId: string,
  organizationId: string,
  currentDate?: Date
): Promise<ActionResult<MemberLeave[]>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const leaves = await getActiveMemberLeaves(access, memberId, currentDate)
    return { isSuccess: true, message: "Active leaves retrieved successfully", data: leaves }
  } catch (error) {
    logFailure("Failed to get active leaves", error, { organizationId: access.organizationId })
    return failure("Failed to retrieve active leaves")
  }
}

export async function getAllMemberLeavesAction(
  memberId: string,
  organizationId: string,
): Promise<ActionResult<MemberLeave[]>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const leaves = await getAllMemberLeaves(access, memberId)
    return { isSuccess: true, message: "Leave records retrieved successfully", data: leaves }
  } catch (error) {
    logFailure("Failed to get leave records", error, { organizationId: access.organizationId })
    return failure("Failed to retrieve leave records")
  }
}

export async function updateMemberLeaveAction(
  id: string,
  data: Partial<NewMemberLeave>
): Promise<ActionResult<MemberLeave>> {
  const access = await requireAdmin(data?.organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const updatedLeave = await updateMemberLeave(access, id, data)
    revalidateEmployment()
    return { isSuccess: true, message: "Leave record updated successfully", data: updatedLeave }
  } catch (error) {
    logFailure("Failed to update leave record", error, { organizationId: access.organizationId, id })
    return failure(safeMessage(error, "Failed to update leave record"))
  }
}

export async function approveMemberLeaveAction(
  id: string,
  organizationId: string,
): Promise<ActionResult<MemberLeave>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const updatedLeave = await approveMemberLeave(access, id)
    revalidateEmployment()
    return { isSuccess: true, message: "Leave request approved successfully", data: updatedLeave }
  } catch (error) {
    logFailure("Failed to approve leave request", error, { organizationId: access.organizationId, id })
    return failure(safeMessage(error, "Failed to approve leave request"))
  }
}

export async function createJobClassificationAction(
  data: NewJobClassification
): Promise<ActionResult<JobClassification>> {
  const access = await requireAdmin(data?.organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const classification = await createJobClassification(access, data)
    revalidatePath("/dashboard/admin/employment")
    return { isSuccess: true, message: "Job classification created successfully", data: classification }
  } catch (error) {
    logFailure("Failed to create job classification", error, { organizationId: access.organizationId })
    return failure(safeMessage(error, "Failed to create job classification"))
  }
}

export async function getJobClassificationByCodeAction(
  organizationId: string,
  jobCode: string
): Promise<ActionResult<JobClassification | null>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const classification = await getJobClassificationByCode(access, jobCode)
    return { isSuccess: true, message: "Job classification retrieved successfully", data: classification }
  } catch (error) {
    logFailure("Failed to get job classification", error, { organizationId: access.organizationId })
    return failure("Failed to retrieve job classification")
  }
}

export async function getJobClassificationsByOrganizationAction(
  organizationId: string,
  activeOnly: boolean = true
): Promise<ActionResult<JobClassification[]>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const classifications = await getJobClassificationsByOrganization(access, activeOnly)
    return { isSuccess: true, message: "Job classifications retrieved successfully", data: classifications }
  } catch (error) {
    logFailure("Failed to get job classifications", error, { organizationId: access.organizationId })
    return failure("Failed to retrieve job classifications")
  }
}

export async function updateJobClassificationAction(
  id: string,
  data: Partial<NewJobClassification>
): Promise<ActionResult<JobClassification>> {
  const access = await requireAdmin(data?.organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const updatedClassification = await updateJobClassification(access, id, data)
    revalidatePath("/dashboard/admin/employment")
    return { isSuccess: true, message: "Job classification updated successfully", data: updatedClassification }
  } catch (error) {
    logFailure("Failed to update job classification", error, { organizationId: access.organizationId, id })
    return failure(safeMessage(error, "Failed to update job classification"))
  }
}

export async function calculateSeniorityYearsAction(
  seniorityDate: string,
  organizationId: string,
  currentDate?: Date,
  memberId?: string
): Promise<ActionResult<number>> {
  const access = await requireAdmin(organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const years = await calculateSeniorityYears(
      access,
      new Date(seniorityDate),
      currentDate,
      memberId,
    )
    return { isSuccess: true, message: "Seniority years calculated successfully", data: years }
  } catch (error) {
    logFailure("Failed to calculate seniority years", error, { organizationId: access.organizationId })
    return failure(safeMessage(error, "Failed to calculate seniority years"))
  }
}
