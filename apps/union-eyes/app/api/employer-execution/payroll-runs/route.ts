import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import {
  employerTimesheetEntries,
  employerPayrollRuns,
  employerPayrollRunItems,
  employerExecutionComplianceEvents,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { calculatePayroll, sha256 } from "../_lib";

const createSchema = z.object({
  timesheetBatchId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  runType: z.enum(["preview", "official"]),
  engineVersion: z.string().default("employer-execution-v1"),
  baseRate: z.number().positive().default(52),
  duesRate: z.number().min(0).max(1).default(0.02),
  benefitRate: z.number().min(0).max(1).default(0.03),
  pensionRate: z.number().min(0).max(1).default(0.04),
});

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "employer_payroll_preview",
    openapi: { tags: ["Employer Execution"], summary: "List payroll runs" },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const rows = await db
      .select()
      .from(employerPayrollRuns)
      .where(eq(employerPayrollRuns.organizationId, organizationId))
      .orderBy(desc(employerPayrollRuns.createdAt));
    return { data: rows };
  },
);

export const POST = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "employer_payroll_preview",
    body: createSchema,
    successStatus: 201,
    openapi: { tags: ["Employer Execution"], summary: "Create deterministic payroll run" },
  },
  async ({ organizationId, userId, body }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");

    const timesheetEntries = await db
      .select()
      .from(employerTimesheetEntries)
      .where(
        and(
          eq(employerTimesheetEntries.organizationId, organizationId),
          eq(employerTimesheetEntries.batchId, body.timesheetBatchId),
          eq(employerTimesheetEntries.status, "valid"),
        ),
      );

    if (!timesheetEntries.length) throw ApiError.badRequest("No valid timesheet entries found");

    const calc = calculatePayroll(
      timesheetEntries.map((entry) => ({
        rowNumber: entry.rowNumber,
        employeeExternalId: entry.employeeExternalId,
        shiftDate: String(entry.shiftDate),
        regularHours: Number(entry.regularHours),
        overtimeHours: Number(entry.overtimeHours),
        doubletimeHours: Number(entry.doubletimeHours),
        travelHours: Number(entry.travelHours),
        premiumCode: entry.premiumCode ?? undefined,
        validationErrors: [],
      })),
      body.baseRate,
      body.duesRate,
      body.benefitRate,
      body.pensionRate,
    );

    const run = await withRLSContext(async (tx) => {
      const [createdRun] = await tx
        .insert(employerPayrollRuns)
        .values({
          organizationId,
          runCode: `pr-${Date.now()}`,
          runType: body.runType,
          status: body.runType === "official" ? "approved" : "calculated",
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          sourceBatchId: body.timesheetBatchId,
          engineVersion: body.engineVersion,
          inputSnapshot: { body },
          calcTrace: calc.calcTrace,
          calcTraceHash: calc.calcTraceHash,
          totalGross: calc.totals.gross.toString(),
          totalNet: calc.totals.net.toString(),
          totalDues: calc.totals.dues.toString(),
          totalBenefits: calc.totals.benefits.toString(),
          totalPension: calc.totals.pension.toString(),
          immutableSnapshotLocked: body.runType === "official",
          approvedBy: body.runType === "official" ? userId ?? undefined : undefined,
          approvedAt: body.runType === "official" ? new Date() : undefined,
        })
        .returning();

      if (!createdRun) throw ApiError.internal("Failed to create payroll run");

      await tx.insert(employerPayrollRunItems).values(
        calc.items.map((item) => ({
          organizationId,
          payrollRunId: createdRun.id,
          employeeExternalId: item.employeeExternalId,
          grossPay: item.grossPay.toString(),
          netPay: item.netPay.toString(),
          duesAmount: item.duesAmount.toString(),
          benefitAmount: item.benefitAmount.toString(),
          pensionAmount: item.pensionAmount.toString(),
          remittanceGroupKey: item.remittanceGroupKey,
          traceJson: item.trace,
          traceHash: item.traceHash,
        })),
      );

      if (body.runType === "official") {
        await tx.insert(employerExecutionComplianceEvents).values({
          organizationId,
          payrollRunId: createdRun.id,
          eventCode: "official_run_approved",
          severity: "info",
          status: "open",
          summary: "Official payroll run approved",
          details: {
            approvedBy: userId,
            calcTraceHash: calc.calcTraceHash,
            snapshotHash: sha256(JSON.stringify(body)),
          },
          blocking: "no",
        });
      }

      return createdRun;
    });

    return { data: { run, totals: calc.totals } };
  },
);
