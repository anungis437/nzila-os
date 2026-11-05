"use server";

/**
 * Job classification server actions.
 *
 * The member employment, employment history and leave actions were deleted
 * with the screens that called them (mounted nowhere). The job classification
 * screen is mounted in the admin members console, so its three actions remain.
 *
 * Every action resolves `auth()` through `authorizeEmploymentAccess` and
 * passes that sealed grant into the query layer. Reads require the same
 * employment-administration allow-list as writes. The list is fetched by the
 * screen on demand, so no server-rendered view needs revalidating.
 */

import { authorizeEmploymentAccess } from "@/lib/member-employment/authorize-employment-access";
import { logger } from "@/lib/logger";
import { safeActionMessage } from "@/lib/actions/safe-action-error";
import {
  createJobClassification,
  EmploymentBoundaryError,
  getJobClassificationsByOrganization,
  updateJobClassification,
} from "@/db/queries/member-employment-queries";
import type {
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
  // Only the action's own boundary error is for the caller; the failure is logged by logFailure, name and fields only.
  return safeActionMessage(error, {
    action: fallback,
    fallback,
    isSafe: (candidate) => candidate instanceof EmploymentBoundaryError,
    log: false,
  })
}

function logFailure(operation: string, error: unknown, fields: Record<string, string | undefined>): void {
  logger.error(operation, new Error(operation), {
    ...fields,
    errorName: error instanceof Error ? error.name : 'error',
  })
}

export async function createJobClassificationAction(
  data: NewJobClassification
): Promise<ActionResult<JobClassification>> {
  const access = await requireAdmin(data?.organizationId)
  if (!access.ok) return failure(access.message)
  try {
    const classification = await createJobClassification(access, data)
    return { isSuccess: true, message: "Job classification created successfully", data: classification }
  } catch (error) {
    logFailure("Failed to create job classification", error, { organizationId: access.organizationId })
    return failure(safeMessage(error, "Failed to create job classification"))
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
    return failure(safeMessage(error, "Failed to retrieve job classifications"))
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
    return { isSuccess: true, message: "Job classification updated successfully", data: updatedClassification }
  } catch (error) {
    logFailure("Failed to update job classification", error, { organizationId: access.organizationId, id })
    return failure(safeMessage(error, "Failed to update job classification"))
  }
}
