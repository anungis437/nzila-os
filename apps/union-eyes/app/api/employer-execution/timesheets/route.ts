import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { employerTimesheetBatches, employerTimesheetEntries } from "@/db/schema";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { desc, eq } from "drizzle-orm";
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
    if (!organizationId) throw ApiError.badRequest("Organization context required");

    const normalized = normalizeCsv(body.csvContent);

    const batch = await withRLSContext(async (tx) => {
      const [createdBatch] = await tx
        .insert(employerTimesheetBatches)
        .values({
          organizationId,
          employerId: body.employerId,
          worksiteId: body.worksiteId,
          bargainingUnitId: body.bargainingUnitId,
          batchCode: `ts-${Date.now()}`,
          sourceFileName: body.sourceFileName,
          sourceFileHash: sha256(body.csvContent),
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          status: normalized.summary.invalid > 0 ? "rejected" : "validated",
          validationSummary: normalized.summary,
          uploadedBy: userId ?? undefined,
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
