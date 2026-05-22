import { Router, Request, Response } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { calculatePayrollRun } from "../services/employer-execution";

const router = Router();

const createSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  runType: z.enum(["preview", "official"]).default("preview"),
  engineVersion: z.string().default("employer-execution-v1"),
  baseRate: z.number().positive().default(52),
  duesRate: z.number().min(0).max(1).default(0.02),
  benefitRate: z.number().min(0).max(1).default(0.03),
  pensionRate: z.number().min(0).max(1).default(0.04),
  entries: z.array(
    z.object({
      rowNumber: z.number(),
      employeeExternalId: z.string(),
      shiftDate: z.string(),
      regularHours: z.number(),
      overtimeHours: z.number(),
      doubletimeHours: z.number(),
      travelHours: z.number(),
    }),
  ),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const user = (req as { user?: Record<string, string> }).user ?? {};
    const organizationId = user.organizationId || user.tenantId;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: "Organization context required" });
    }

    const body = createSchema.parse(req.body);
    const run = calculatePayrollRun({
      engineVersion: body.engineVersion,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      entries: body.entries.map((entry) => ({
        ...entry,
        premiumCode: undefined,
        validationErrors: [],
      })),
      resolvedRules: {
        ruleVersionId: "service-inline",
        ruleVersionCode: "service-inline",
        sourceHash: "service-inline",
        executableRules: [
          {
            kind: "base_rate",
            strategy: "hourly",
            amount: body.baseRate,
            sourceRuleId: "service-inline",
            ruleCode: "base_rate_inline",
            precedence: 10,
            compositionMode: "replace",
            scope: {},
            action: { amount: body.baseRate },
            path: ["request", "baseRate"],
          },
          {
            kind: "dues",
            strategy: "percent_gross",
            amount: body.duesRate,
            sourceRuleId: "service-inline",
            ruleCode: "dues_inline",
            precedence: 20,
            compositionMode: "replace",
            scope: {},
            action: { amount: body.duesRate },
            path: ["request", "duesRate"],
          },
          {
            kind: "benefits",
            strategy: "percent_gross",
            amount: body.benefitRate,
            sourceRuleId: "service-inline",
            ruleCode: "benefits_inline",
            precedence: 30,
            compositionMode: "replace",
            scope: {},
            action: { amount: body.benefitRate },
            path: ["request", "benefitRate"],
          },
          {
            kind: "pension",
            strategy: "percent_gross",
            amount: body.pensionRate,
            sourceRuleId: "service-inline",
            ruleCode: "pension_inline",
            precedence: 40,
            compositionMode: "replace",
            scope: {},
            action: { amount: body.pensionRate },
            path: ["request", "pensionRate"],
          },
          {
            kind: "overtime",
            strategy: "daily_threshold",
            thresholdHours: 8,
            multiplier: 1.5,
            sourceRuleId: "service-inline",
            ruleCode: "overtime_inline",
            precedence: 50,
            compositionMode: "replace",
            scope: {},
            action: { thresholdHours: 8, multiplier: 1.5 },
            path: ["request", "defaults"],
          },
          {
            kind: "double_time",
            strategy: "after_threshold",
            thresholdHours: 12,
            multiplier: 2,
            sourceRuleId: "service-inline",
            ruleCode: "double_time_inline",
            precedence: 60,
            compositionMode: "replace",
            scope: {},
            action: { thresholdHours: 12, multiplier: 2 },
            path: ["request", "defaults"],
          },
        ],
        values: {
          baseRate: body.baseRate,
          overtimeMultiplier: 1.5,
          doubleTimeMultiplier: 2,
          shiftPremiumRate: 0,
          travelPremiumRate: 0,
          duesRate: body.duesRate,
          benefitRate: body.benefitRate,
          pensionRate: body.pensionRate,
          statutoryHolidayMultiplier: 1,
          regionalOverride: 1,
          classificationOverride: 1,
        },
        ruleResolution: [{ source: "inline_financial_service_route" }],
        appliedRules: [],
      },
    });

    const insertRun = await db.execute(sql`
      insert into employer_payroll_runs (
        organization_id, run_code, run_type, status, period_start, period_end,
        engine_version, input_snapshot, calc_trace, calc_trace_hash,
        total_gross, total_net, total_dues, total_benefits, total_pension,
        immutable_snapshot_locked
      ) values (
        ${organizationId}, ${`pr-${Date.now()}`}, ${body.runType}, ${body.runType === "official" ? "approved" : "calculated"},
        ${body.periodStart}::date, ${body.periodEnd}::date,
        ${body.engineVersion}, ${JSON.stringify(body)}::jsonb,
        ${JSON.stringify(run.trace)}::jsonb, ${run.traceHash},
        ${run.totals.gross}, ${run.totals.net}, ${run.totals.dues}, ${run.totals.benefits}, ${run.totals.pension},
        ${body.runType === "official"}
      ) returning id
    `);

    const payrollRunId = (insertRun as unknown as Array<{ id: string }>)[0]?.id;

    for (const item of run.items) {
      await db.execute(sql`
        insert into employer_payroll_run_items (
          organization_id, payroll_run_id, employee_external_id,
          gross_pay, net_pay, dues_amount, benefit_amount, pension_amount,
          remittance_group_key, trace_json, trace_hash
        ) values (
          ${organizationId}, ${payrollRunId}, ${item.employeeExternalId},
          ${item.grossPay}, ${item.netPay}, ${item.duesAmount}, ${item.benefitAmount}, ${item.pensionAmount},
          ${"default"}, ${JSON.stringify(item.trace)}::jsonb,
          ${run.traceHash}
        )
      `);
    }

    return res.status(201).json({ success: true, data: { payrollRunId, ...run } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unexpected failure" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  const user = (req as { user?: Record<string, string> }).user ?? {};
  const organizationId = user.organizationId || user.tenantId;
  if (!organizationId) {
    return res.status(400).json({ success: false, error: "Organization context required" });
  }

  const runs = await db.execute(sql`
    select id, run_code, run_type, status, period_start, period_end, total_gross, total_net, created_at
    from employer_payroll_runs
    where organization_id = ${organizationId}
    order by created_at desc
    limit 100
  `);

  return res.json({ success: true, data: runs });
});

router.get("/:id", async (req: Request, res: Response) => {
  const user = (req as { user?: Record<string, string> }).user ?? {};
  const organizationId = user.organizationId || user.tenantId;
  if (!organizationId) {
    return res.status(400).json({ success: false, error: "Organization context required" });
  }

  const { id } = req.params;
  const [run] = await db.execute(sql`
    select * from employer_payroll_runs
    where organization_id = ${organizationId} and id = ${id}
    limit 1
  `);

  if (!run) {
    return res.status(404).json({ success: false, error: "Payroll run not found" });
  }

  const items = await db.execute(sql`
    select * from employer_payroll_run_items
    where organization_id = ${organizationId} and payroll_run_id = ${id}
  `);

  return res.json({ success: true, data: { run, items } });
});

export default router;
