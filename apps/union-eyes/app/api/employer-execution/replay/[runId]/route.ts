import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import {
  employerPayrollRuns,
  employerPayrollRunItems,
  employerTimesheetEntries,
  employerExecutionReplays,
  employerExecutionArtifacts,
  employerExecutionComplianceEvents,
  cbaRuleVersions,
  cbaRuleSetItems,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { buildReplayDiff, calculatePayroll, resolvePayrollRules, sha256 } from "../../_lib";

const replaySchema = z.object({
  mode: z.enum(["exact", "new_engine", "new_rule"]).default("exact"),
  replayEngineVersion: z.string().optional(),
  replayRuleVersionId: z.string().uuid().optional(),
});

export const POST = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "employer_execution_replay",
    body: replaySchema,
    successStatus: 201,
    openapi: { tags: ["Employer Execution"], summary: "Replay payroll run and diff results" },
  },
  async ({ organizationId, params, body, userId }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const runId = params?.runId;
    if (typeof runId !== "string") throw ApiError.badRequest("Source payroll run id is required");

    const [sourceRun] = await db
      .select()
      .from(employerPayrollRuns)
      .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, runId)))
      .limit(1);

    if (!sourceRun) throw ApiError.notFound("Source payroll run not found");
    if (!sourceRun.sourceBatchId) throw ApiError.badRequest("Source payroll run is missing source batch reference");
    if (!sourceRun.cbaRuleVersionId) throw ApiError.badRequest("Source payroll run is missing CBA rule version reference");

    const sourceItems = await db
      .select()
      .from(employerPayrollRunItems)
      .where(
        and(
          eq(employerPayrollRunItems.organizationId, organizationId),
          eq(employerPayrollRunItems.payrollRunId, sourceRun.id),
        ),
      );

    const timesheetEntries = await db
      .select()
      .from(employerTimesheetEntries)
      .where(
        and(
          eq(employerTimesheetEntries.organizationId, organizationId),
          eq(employerTimesheetEntries.batchId, sourceRun.sourceBatchId),
          eq(employerTimesheetEntries.status, "valid"),
        ),
      );

    if (timesheetEntries.length === 0) {
      throw ApiError.badRequest("No valid source timesheet entries found for replay");
    }

    const effectiveRuleVersionId =
      body.mode === "new_rule" ? body.replayRuleVersionId : sourceRun.cbaRuleVersionId;
    if (!effectiveRuleVersionId) {
      throw ApiError.badRequest("Replay rule version id is required for new_rule mode");
    }

    const [ruleVersion] = await db
      .select()
      .from(cbaRuleVersions)
      .where(
        and(
          eq(cbaRuleVersions.organizationId, organizationId),
          eq(cbaRuleVersions.id, effectiveRuleVersionId),
        ),
      )
      .limit(1);

    if (!ruleVersion) throw ApiError.badRequest("Replay rule version not found");

    const ruleItems = await db
      .select()
      .from(cbaRuleSetItems)
      .where(
        and(
          eq(cbaRuleSetItems.organizationId, organizationId),
          eq(cbaRuleSetItems.cbaRuleVersionId, ruleVersion.id),
        ),
      )
      .orderBy(asc(cbaRuleSetItems.precedence));

    const resolvedRules = resolvePayrollRules({
      ruleVersionId: ruleVersion.id,
      ruleVersionCode: ruleVersion.ruleVersionCode,
      sourceHash: ruleVersion.sourceHash,
      rulesJson: ruleVersion.rulesJson,
      ruleItems,
      workDate: String(sourceRun.periodEnd),
    });

    const replayEngineVersion = body.replayEngineVersion ?? sourceRun.engineVersion;
    const replayCalc = calculatePayroll(
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
        engineVersion: replayEngineVersion,
        periodStart: String(sourceRun.periodStart),
        periodEnd: String(sourceRun.periodEnd),
      },
    );

    const originalTotals = {
      totalGross: Number(sourceRun.totalGross),
      totalNet: Number(sourceRun.totalNet),
      totalDues: Number(sourceRun.totalDues),
      totalBenefits: Number(sourceRun.totalBenefits),
      totalPension: Number(sourceRun.totalPension),
      calcTraceHash: sourceRun.calcTraceHash,
      itemTraceHashes: sourceItems.map((item) => item.traceHash).sort(),
    };

    const replayedTotals = {
      totalGross: replayCalc.totals.gross,
      totalNet: replayCalc.totals.net,
      totalDues: replayCalc.totals.dues,
      totalBenefits: replayCalc.totals.benefits,
      totalPension: replayCalc.totals.pension,
      calcTraceHash: replayCalc.calcTraceHash,
      itemTraceHashes: replayCalc.items.map((item) => item.traceHash).sort(),
    };

    const reasonByMode =
      body.mode === "new_rule"
        ? "rule change: rule version override"
        : body.mode === "new_engine"
          ? "engine change: replay engine version override"
          : "input change: exact replay mismatch";

    const baseDiff = buildReplayDiff(originalTotals, replayedTotals, reasonByMode, {
      scope: "run",
      subjectId: sourceRun.id,
      originalRulePath: ["payroll_run", sourceRun.id, "calcTraceHash"],
      replayRulePath: ["payroll_run", sourceRun.id, "replayCalcTraceHash"],
    });

    const sourceByEmployee = new Map(sourceItems.map((item) => [item.employeeExternalId, item]));
    const employeeDiffs = replayCalc.items.flatMap((item) => {
      const source = sourceByEmployee.get(item.employeeExternalId);
      const replayRulePath =
        ((item.trace as { calc_trace?: { applied_rule_path?: Record<string, unknown> } } | undefined)?.calc_trace
          ?.applied_rule_path as string[] | undefined) ?? [];
      const sourceRulePath =
        ((source?.traceJson as { calc_trace?: { applied_rule_path?: Record<string, unknown> } } | undefined)?.calc_trace
          ?.applied_rule_path as string[] | undefined) ?? [];

      if (!source) {
        return [
          {
            scope: "employee_item" as const,
            subjectId: item.employeeExternalId,
            field: "presence",
            originalValue: null,
            replayValue: "present",
            causeType: "derived_change" as const,
            causeDetail: reasonByMode,
            originalRulePath: sourceRulePath,
            replayRulePath,
          },
        ];
      }

      const output: Array<{
        scope: "employee_item";
        subjectId: string;
        field: string;
        originalValue: unknown;
        replayValue: unknown;
        causeType: "input_change" | "rule_change" | "engine_change" | "derived_change";
        causeDetail: string;
        originalRulePath?: string[];
        replayRulePath?: string[];
      }> = [];
      const pairs: Array<[string, number, number]> = [
        ["gross_pay", Number(source.grossPay), item.grossPay],
        ["net_pay", Number(source.netPay), item.netPay],
        ["dues_amount", Number(source.duesAmount), item.duesAmount],
        ["benefit_amount", Number(source.benefitAmount), item.benefitAmount],
        ["pension_amount", Number(source.pensionAmount), item.pensionAmount],
      ];

      const causeType =
        body.mode === "new_rule"
          ? "rule_change"
          : body.mode === "new_engine"
            ? "engine_change"
            : "input_change";

      for (const [fieldName, originalValue, replayValue] of pairs) {
        if (originalValue !== replayValue) {
          output.push({
            scope: "employee_item",
            subjectId: item.employeeExternalId,
            field: fieldName,
            originalValue,
            replayValue,
            causeType,
            causeDetail: reasonByMode,
            originalRulePath: sourceRulePath,
            replayRulePath,
          });
        }
      }
      return output;
    });

    const diff = {
      differences: [...baseDiff.differences, ...employeeDiffs],
      changed: baseDiff.changed || employeeDiffs.length > 0,
      summary:
        baseDiff.changed || employeeDiffs.length > 0
          ? `Replay changed ${baseDiff.differences.length + employeeDiffs.length} field(s)`
          : "Replay matched original run",
    };

    const [replay] = await withRLSContext(async (tx) => {
      const [createdReplay] = await tx
        .insert(employerExecutionReplays)
        .values({
          organizationId,
          sourcePayrollRunId: sourceRun.id,
          replayPayrollRunId: null,
          mode: body.mode === "new_rule" ? "simulated" : "exact",
          sourceEngineVersion: sourceRun.engineVersion,
          replayEngineVersion,
          diffJson: diff,
          diffSummary: diff.summary,
          diffHash: sha256(JSON.stringify(diff)),
          createdBy: userId ?? undefined,
        })
        .returning();

      await tx.insert(employerExecutionArtifacts).values({
        organizationId,
        payrollRunId: sourceRun.id,
        artifactType: "replay_diff",
        artifactName: `replay-${createdReplay.id}.json`,
        storageRef: `inline://employer-execution/replays/${createdReplay.id}`,
        artifactHash: sha256(JSON.stringify(diff)),
        manifestJson: {
          ...diff,
          replayEngineVersion,
          replayRuleVersionId: ruleVersion.id,
          sourceRuleVersionId: sourceRun.cbaRuleVersionId,
        },
        createdBy: userId ?? undefined,
      });

      if (diff.changed) {
        await tx.insert(employerExecutionComplianceEvents).values({
          organizationId,
          payrollRunId: sourceRun.id,
          eventCode: "inconsistent_replay_results",
          severity: "error",
          status: "open",
          summary: "Replay produced variance against source payroll run",
          details: {
            replayId: createdReplay.id,
            differenceCount: diff.differences.length,
            mode: body.mode,
          },
          blocking: "no",
        });
      }

      return [createdReplay];
    });

    return {
      data: {
        replay,
        diff,
        replayTotals: replayedTotals,
      },
    };
  },
);
