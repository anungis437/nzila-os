/**
 * Resolves external payroll identities to member employment records (DEF-0B6-EMP-OFFICIAL-APPROVAL-
 * UNREACHABLE, UE-CAP-D-002). See app/api/employer-execution/timesheets/[batchId]/mapping/route.ts for
 * the HTTP wrapper (auth, body validation) and the full design rationale.
 *
 * Extracted as a plain, testable function - no withApi/HTTP context - mirroring
 * lib/employer-execution/payroll-run-transitions.ts's approveRun/executeRun.
 */
import { ApiError } from "@/lib/api/framework";
import {
  employerTimesheetBatches,
  employerTimesheetEntries,
  employerPayrollRuns,
  employerExecutionComplianceEvents,
  memberEmployment,
  jobClassifications,
} from "@/db/schema";
import { type RLSTx } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { and, eq, inArray, isNull } from "drizzle-orm";

export interface EmploymentMappingInput {
  employeeExternalId: string;
  memberEmploymentId: string;
  jobClassificationId?: string;
}

export interface EmploymentMappingResult {
  results: Array<{ employeeExternalId: string; entriesUpdated: number }>;
  resolvedEventCount: number;
}

export async function resolveEmploymentMapping(
  tx: RLSTx,
  input: { organizationId: string; userId: string; batchId: string; mappings: EmploymentMappingInput[] },
): Promise<EmploymentMappingResult> {
  const { organizationId, userId, batchId, mappings } = input;

  const [batch] = await tx
    .select({ id: employerTimesheetBatches.id, employerId: employerTimesheetBatches.employerId })
    .from(employerTimesheetBatches)
    .where(and(eq(employerTimesheetBatches.organizationId, organizationId), eq(employerTimesheetBatches.id, batchId)))
    .limit(1);
  if (!batch) throw ApiError.notFound("Timesheet batch");

  // Deduplicate by employeeExternalId: a caller submitting the same external id twice with different
  // targets is ambiguous, not a deterministic mapping, so it is refused rather than silently taking
  // the last one.
  const seen = new Set<string>();
  for (const mapping of mappings) {
    if (seen.has(mapping.employeeExternalId)) {
      throw ApiError.badRequest(`employeeExternalId ${mapping.employeeExternalId} is mapped more than once in this request`);
    }
    seen.add(mapping.employeeExternalId);
  }

  // Every target must be a real row of THIS organization and (when the employment names an employer)
  // THIS batch's employer - a mapping cannot quietly attribute hours to another employer's member
  // record.
  const employmentIds = [...new Set(mappings.map((m) => m.memberEmploymentId))];
  const employments = employmentIds.length > 0
    ? await tx
      .select({ id: memberEmployment.id, employerId: memberEmployment.employerId })
      .from(memberEmployment)
      .where(and(eq(memberEmployment.organizationId, organizationId), inArray(memberEmployment.id, employmentIds)))
    : [];
  const employmentById = new Map(employments.map((e) => [e.id, e]));
  for (const mapping of mappings) {
    const employment = employmentById.get(mapping.memberEmploymentId);
    if (!employment) throw ApiError.badRequest(`memberEmploymentId ${mapping.memberEmploymentId} does not exist in this organization`);
    if (employment.employerId && batch.employerId && employment.employerId !== batch.employerId) {
      throw ApiError.badRequest(`memberEmploymentId ${mapping.memberEmploymentId} belongs to a different employer than this batch`);
    }
  }

  const classificationIds = [...new Set(mappings.map((m) => m.jobClassificationId).filter((id): id is string => Boolean(id)))];
  if (classificationIds.length > 0) {
    const classifications = await tx
      .select({ id: jobClassifications.id })
      .from(jobClassifications)
      .where(and(eq(jobClassifications.organizationId, organizationId), inArray(jobClassifications.id, classificationIds)));
    const validIds = new Set(classifications.map((c) => c.id));
    for (const id of classificationIds) {
      if (!validIds.has(id)) throw ApiError.badRequest(`jobClassificationId ${id} does not exist in this organization`);
    }
  }

  const results: EmploymentMappingResult["results"] = [];
  for (const mapping of mappings) {
    const updated = await tx
      .update(employerTimesheetEntries)
      .set({
        memberEmploymentId: mapping.memberEmploymentId,
        ...(mapping.jobClassificationId ? { jobClassificationId: mapping.jobClassificationId } : {}),
        updatedAt: new Date(),
      })
      .where(and(
        eq(employerTimesheetEntries.organizationId, organizationId),
        eq(employerTimesheetEntries.batchId, batchId),
        eq(employerTimesheetEntries.employeeExternalId, mapping.employeeExternalId),
      ))
      .returning({ id: employerTimesheetEntries.id });
    results.push({ employeeExternalId: mapping.employeeExternalId, entriesUpdated: updated.length });
  }

  // Re-derive the truth from current data rather than trusting the snapshot count the compliance
  // event was opened with: resolve it only for a run whose batch now has zero unmapped entries.
  const runs = await tx
    .select({ id: employerPayrollRuns.id })
    .from(employerPayrollRuns)
    .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.sourceBatchId, batchId)));

  let resolvedEventCount = 0;
  if (runs.length > 0) {
    const [stillUnmapped] = await tx
      .select({ id: employerTimesheetEntries.id })
      .from(employerTimesheetEntries)
      .where(and(
        eq(employerTimesheetEntries.organizationId, organizationId),
        eq(employerTimesheetEntries.batchId, batchId),
        isNull(employerTimesheetEntries.memberEmploymentId),
      ))
      .limit(1);

    if (!stillUnmapped) {
      const runIds = runs.map((r) => r.id);
      const resolved = await tx
        .update(employerExecutionComplianceEvents)
        .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: userId, updatedAt: new Date() })
        .where(and(
          eq(employerExecutionComplianceEvents.organizationId, organizationId),
          inArray(employerExecutionComplianceEvents.payrollRunId, runIds),
          eq(employerExecutionComplianceEvents.eventCode, "missing_employment_mapping"),
          eq(employerExecutionComplianceEvents.status, "open"),
        ))
        .returning({ id: employerExecutionComplianceEvents.id });
      resolvedEventCount = resolved.length;
    }
  }

  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: "employer_execution.timesheet_batch.resolve_employment_mapping",
    resourceType: "employer_timesheet_batches",
    resourceId: batchId,
    details: {
      mappingsSubmitted: mappings.length,
      entriesUpdated: results.reduce((sum, r) => sum + r.entriesUpdated, 0),
      resolvedEventCount,
    },
  });

  return { results, resolvedEventCount };
}
