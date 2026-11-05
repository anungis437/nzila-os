import { withApi, ApiError, z } from "@/lib/api/framework";
import { FINANCIAL_MEMBER_DATA_ROLES } from "@/lib/finance/financial-authority";
import { requireLiveFinancialMandate } from "@/lib/finance/require-live-financial-mandate";
import { rowsVisibleToGrant } from "@/lib/finance/principal-financial-authority";
import { employerTimesheetBatches, employerTimesheetEntries, employers, worksites, bargainingUnits } from "@/db/schema";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { and, desc, eq, ne } from "drizzle-orm";
import { normalizeCsv, sha256 } from "../_lib";

const MAX_CSV_CHARACTERS = 2_000_000;

const createSchema = z.object({
  employerId: z.guid(),
  worksiteId: z.guid().optional(),
  bargainingUnitId: z.guid().optional(),
  // Dates are calendar dates, the file name is a bounded label and the CSV is capped: an uncapped string was hashed, parsed and stored whole.
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'periodStart must be YYYY-MM-DD'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'periodEnd must be YYYY-MM-DD'),
  sourceFileName: z.string().trim().min(1).max(255),
  csvContent: z.string().min(1).max(MAX_CSV_CHARACTERS),
}).refine((value) => value.periodStart <= value.periodEnd, { message: 'periodStart must not be after periodEnd', path: ['periodEnd'] });

export const GET = withApi(
  {
    // A batch names the employer's workers and their hours: a financial reader's data, not a member's.
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: "employer_timesheet_ingest",
    openapi: { tags: ["Employer Execution"], summary: "List timesheet batches" },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest("Organization context required");
    const rows = await withRLSContext({ organizationId, userId }, async (tx) => {
      const grant = await requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:view" });
      return tx
        .select()
        .from(employerTimesheetBatches)
        .where(rowsVisibleToGrant(grant, organizationId, employerTimesheetBatches.organizationId, employerTimesheetBatches.employerId))
        .orderBy(desc(employerTimesheetBatches.createdAt))
        .limit(200);
    });
    return { data: rows };
  },
);

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: "employer_timesheet_ingest",
    body: createSchema,
    openapi: { tags: ["Employer Execution"], summary: "Upload and normalize timesheet CSV" },
    successStatus: 201,
  },
  async ({ organizationId, userId, body }) => {
    if (!organizationId || !userId) throw ApiError.badRequest("Organization context required");

    const normalized = normalizeCsv(body.csvContent);
    const sourceFileHash = sha256(body.csvContent);

    const batch = await withRLSContext({ organizationId, userId }, async (tx) => {
      // Require the authenticated principal's live prepare duty for this employer
      // before reading registry records or creating a timesheet batch.
      await requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:prepare", employerId: body.employerId });
      // Every structural reference must belong to this organization.
      const [employer] = await tx
        .select({ id: employers.id, status: employers.status })
        .from(employers)
        .where(and(eq(employers.organizationId, organizationId), eq(employers.id, body.employerId)))
        .limit(1);
      if (!employer) throw ApiError.notFound("Employer not found");
      // An archived employer is out of the registry: it takes no further payroll input.
      if (employer.status === "archived") throw ApiError.conflict("The employer is archived and takes no timesheet input");

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
