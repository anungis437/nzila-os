import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { PLATFORM_MODULES, requireEntitlement } from "@/services/platform-economics/entitlement-guard";
import {
  employerTimesheetEntries,
  employerTimesheetBatches,
  employerPayrollRuns,
  employerPayrollRunItems,
  employerExecutionComplianceEvents,
  cbaRuleVersions,
  cbaRuleSetItems,
} from "@/db/schema";
import { and, asc, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { calculatePayroll, resolvePayrollRules, sha256 } from "../_lib";

const createSchema = z.object({
  timesheetBatchId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  runType: z.enum(["preview", "official"]),
  engineVersion: z.string().default("employer-execution-v1"),
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

    if (body.runType === "official") {
      await requireEntitlement(organizationId, PLATFORM_MODULES.EMPLOYER_PAYROLL_OFFICIAL, userId ?? undefined);
    }

    const [sourceBatch] = await db
      .select()
      .from(employerTimesheetBatches)
      .where(
        and(
          eq(employerTimesheetBatches.organizationId, organizationId),
          eq(employerTimesheetBatches.id, body.timesheetBatchId),
        ),
      )
      .limit(1);

    if (!sourceBatch) throw ApiError.notFound("Timesheet batch not found");

    if (body.runType === "official") {
      const [existingApproved] = await db
        .select({ id: employerPayrollRuns.id })
        .from(employerPayrollRuns)
        .where(
          and(
            eq(employerPayrollRuns.organizationId, organizationId),
            eq(employerPayrollRuns.sourceBatchId, body.timesheetBatchId),
            eq(employerPayrollRuns.runType, "official"),
            eq(employerPayrollRuns.status, "approved"),
          ),
        )
        .limit(1);

      if (existingApproved) {
        throw ApiError.badRequest("Official run already approved for this batch; create an adjustment run instead");
      }
    }

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

    const workDate = String(timesheetEntries[0]?.shiftDate ?? body.periodEnd);

    const worksiteScope = sourceBatch.worksiteId
      ? or(eq(cbaRuleVersions.worksiteId, sourceBatch.worksiteId), isNull(cbaRuleVersions.worksiteId))
      : isNull(cbaRuleVersions.worksiteId);
    const bargainingScope = sourceBatch.bargainingUnitId
      ? or(eq(cbaRuleVersions.bargainingUnitId, sourceBatch.bargainingUnitId), isNull(cbaRuleVersions.bargainingUnitId))
      : isNull(cbaRuleVersions.bargainingUnitId);

    const [activeRuleVersion] = await db
      .select()
      .from(cbaRuleVersions)
      .where(
        and(
          eq(cbaRuleVersions.organizationId, organizationId),
          eq(cbaRuleVersions.status, "active"),
          lte(cbaRuleVersions.effectiveFrom, workDate),
          or(gte(cbaRuleVersions.effectiveTo, workDate), isNull(cbaRuleVersions.effectiveTo)),
          or(eq(cbaRuleVersions.employerId, sourceBatch.employerId), isNull(cbaRuleVersions.employerId)),
          worksiteScope,
          bargainingScope,
        ),
      )
      .orderBy(desc(cbaRuleVersions.effectiveFrom))
      .limit(1);

    if (!activeRuleVersion) {
      throw ApiError.badRequest("No active CBA rule version found for payroll period");
    }

    const ruleItems = await db
      .select()
      .from(cbaRuleSetItems)
      .where(
        and(
          eq(cbaRuleSetItems.organizationId, organizationId),
          eq(cbaRuleSetItems.cbaRuleVersionId, activeRuleVersion.id),
        ),
      )
      .orderBy(asc(cbaRuleSetItems.precedence));

    const resolvedRules = resolvePayrollRules({
      ruleVersionId: activeRuleVersion.id,
      ruleVersionCode: activeRuleVersion.ruleVersionCode,
      sourceHash: activeRuleVersion.sourceHash,
      rulesJson: activeRuleVersion.rulesJson,
      ruleItems,
      workDate,
    });

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
      resolvedRules,
      {
        engineVersion: body.engineVersion,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      },
    );

    const missingClassificationCount = timesheetEntries.filter((entry) => !entry.jobClassificationId).length;
    const missingEmploymentMappingCount = timesheetEntries.filter((entry) => !entry.memberEmploymentId).length;

    const run = await withRLSContext(async (tx) => {
      const [createdRun] = await tx
        .insert(employerPayrollRuns)
        .values({
          organizationId,
          runCode: `pr-${Date.now()}`,
          runType: body.runType,
          status: "calculated",
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          sourceBatchId: body.timesheetBatchId,
          cbaRuleVersionId: activeRuleVersion.id,
          engineVersion: body.engineVersion,
          inputSnapshot: {
            request: body,
            sourceBatchId: body.timesheetBatchId,
            sourceFileHash: sourceBatch.sourceFileHash,
            creatorUserId: userId,
            snapshotHash: calc.snapshotHash,
          },
          calcTrace: calc.calcTrace,
          calcTraceHash: calc.calcTraceHash,
          totalGross: calc.totals.gross.toString(),
          totalNet: calc.totals.net.toString(),
          totalDues: calc.totals.dues.toString(),
          totalBenefits: calc.totals.benefits.toString(),
          totalPension: calc.totals.pension.toString(),
          immutableSnapshotLocked: false,
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
          remittanceGroupKey: item.remittanceGroupKey ?? 'default',
          traceJson: item.trace,
          traceHash: item.traceHash,
        })),
      );

      if (missingClassificationCount > 0) {
        await tx.insert(employerExecutionComplianceEvents).values({
          organizationId,
          payrollRunId: createdRun.id,
          eventCode: "missing_classification",
          severity: "error",
          status: "open",
          summary: "Payroll includes entries without classification mapping",
          details: { count: missingClassificationCount },
          blocking: "no",
        });
      }

      if (missingEmploymentMappingCount > 0) {
        await tx.insert(employerExecutionComplianceEvents).values({
          organizationId,
          payrollRunId: createdRun.id,
          eventCode: "missing_employment_mapping",
          severity: "critical",
          status: "open",
          summary: "Payroll includes entries without member employment mapping",
          details: { count: missingEmploymentMappingCount },
          blocking: "yes",
        });
      }

      if (body.runType === "official") {
        await tx.insert(employerExecutionComplianceEvents).values({
          organizationId,
          payrollRunId: createdRun.id,
          eventCode: "official_run_pending_approval",
          severity: "warning",
          status: "open",
          summary: "Official payroll run calculated and awaiting approval",
          details: {
            requestedBy: userId,
            calcTraceHash: calc.calcTraceHash,
            snapshotHash: sha256(JSON.stringify(body)),
            cbaRuleVersionId: activeRuleVersion.id,
          },
          blocking: "no",
        });
      }

      return createdRun;
    });

    return { data: { run, totals: calc.totals } };
  },
);
