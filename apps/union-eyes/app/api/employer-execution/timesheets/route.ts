import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { employerTimesheetBatches, employerTimesheetEntries, employers, worksites, bargainingUnits } from "@/db/schema";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { and, desc, eq, ne } from "drizzle-orm";
import { normalizeCsv, sha256 } from "../_lib";

const createSchema = z.object({
  employerId: z.string().uuid(),
  worksiteId: z.string().uuid().optional(),
  bargainingUnitId: z.string().uuid().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  sourceFileName: z.string(),
  csvContent: z.string(),
});

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "employer_timesheet_ingest",
    openapi: { tags: ["Employer Execution"], summary: "List timesheet batches" },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const rows = await db
      .select()
      .from(employerTimesheetBatches)
      .where(eq(employerTimesheetBatches.organizationId, organizationId))
      .orderBy(desc(employerTimesheetBatches.createdAt));
    return { data: rows };
  },
);

export const POST = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "employer_timesheet_ingest",
    body: createSchema,
    openapi: { tags: ["Employer Execution"], summary: "Upload and normalize timesheet CSV" },
    successStatus: 201,
  },
  async ({ organizationId, userId, body }) => {
    if (!organizationId || !userId) throw ApiError.badRequest("Organization context required");

    const normalized = normalizeCsv(body.csvContent);
    const sourceFileHash = sha256(body.csvContent);

    const batch = await withRLSContext({ organizationId }, async (tx) => {
      // Every structural reference must belong to this organization.
      const [employer] = await tx
        .select({ id: employers.id })
        .from(employers)
        .where(and(eq(employers.organizationId, organizationId), eq(employers.id, body.employerId)))
        .limit(1);
      if (!employer) throw ApiError.notFound("Employer not found");

      if (body.worksiteId) {
        const [worksite] = await tx
          .select({ id: worksites.id })
          .from(worksites)
          .where(and(eq(worksites.organizationId, organizationId), eq(worksites.id, body.worksiteId)))
          .limit(1);
        if (!worksite) throw ApiError.notFound("Worksite not found");
      }

      if (body.bargainingUnitId) {
        const [unit] = await tx
          .select({ id: bargainingUnits.id })
          .from(bargainingUnits)
          .where(and(eq(bargainingUnits.organizationId, organizationId), eq(bargainingUnits.id, body.bargainingUnitId)))
          .limit(1);
        if (!unit) throw ApiError.notFound("Bargaining unit not found");
      }

      // The same file for the same employer and period must not feed two payroll runs.
      const [duplicate] = await tx
        .select({ id: employerTimesheetBatches.id })
        .from(employerTimesheetBatches)
        .where(
          and(
            eq(employerTimesheetBatches.organizationId, organizationId),
            eq(employerTimesheetBatches.employerId, body.employerId),
            eq(employerTimesheetBatches.sourceFileHash, sourceFileHash),
            eq(employerTimesheetBatches.periodStart, body.periodStart),
            eq(employerTimesheetBatches.periodEnd, body.periodEnd),
            ne(employerTimesheetBatches.status, "rejected"),
          ),
        )
        .limit(1);
      if (duplicate) {
        throw ApiError.conflict("This timesheet file was already ingested for the employer and period", {
          batchId: duplicate.id,
        });
      }

      const [createdBatch] = await tx
        .insert(employerTimesheetBatches)
        .values({
          organizationId,
          employerId: body.employerId,
          worksiteId: body.worksiteId,
          bargainingUnitId: body.bargainingUnitId,
          batchCode: `ts-${Date.now()}`,
          sourceFileName: body.sourceFileName,
          sourceFileHash,
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          status: normalized.summary.invalid > 0 ? "rejected" : "validated",
          validationSummary: normalized.summary,
          uploadedBy: userId,
        })
        .returning();

      if (!createdBatch) throw ApiError.internal("Failed to create timesheet batch");

      if (normalized.entries.length > 0) {
        await tx.insert(employerTimesheetEntries).values(
          normalized.entries.map((entry) => ({
            organizationId,
            batchId: createdBatch.id,
            employeeExternalId: entry.employeeExternalId,
            shiftDate: entry.shiftDate,
            regularHours: entry.regularHours.toString(),
            overtimeHours: entry.overtimeHours.toString(),
            doubletimeHours: entry.doubletimeHours.toString(),
            travelHours: entry.travelHours.toString(),
            premiumCode: entry.premiumCode,
            rowNumber: entry.rowNumber,
            sourceRowHash: sha256(`${entry.rowNumber}|${entry.employeeExternalId}|${entry.shiftDate}`),
            validationErrors: entry.validationErrors,
            status: entry.validationErrors.length > 0 ? ("invalid" as const) : ("valid" as const),
          })),
        );
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: "employer_execution.timesheet_batch.ingest",
        resourceType: "employer_timesheet_batches",
        resourceId: createdBatch.id,
        details: {
          batchCode: createdBatch.batchCode,
          employerId: body.employerId,
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          sourceFileName: body.sourceFileName,
          sourceFileHash,
          status: createdBatch.status,
          summary: normalized.summary,
        },
      });

      return createdBatch;
    });

    return {
      data: {
        batch,
        summary: normalized.summary,
      },
    };
  },
);
