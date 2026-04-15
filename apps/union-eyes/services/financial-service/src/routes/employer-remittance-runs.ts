import { Router, Request, Response } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { generateRemittancePackage } from "../services/employer-execution";

const router = Router();

const createSchema = z.object({
  payrollRunId: z.string().uuid(),
  periodEnd: z.string(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const user = (req as { user?: Record<string, string> }).user ?? {};
    const organizationId = user.organizationId || user.tenantId;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: "Organization context required" });
    }

    const body = createSchema.parse(req.body);

    const items = (await db.execute(sql`
      select employee_external_id, gross_pay, net_pay, dues_amount, benefit_amount, pension_amount
      from employer_payroll_run_items
      where organization_id = ${organizationId} and payroll_run_id = ${body.payrollRunId}
      order by created_at asc
    `)) as Array<{
      employee_external_id: string;
      gross_pay: string;
      net_pay: string;
      dues_amount: string;
      benefit_amount: string;
      pension_amount: string;
    }>;

    if (items.length === 0) {
      return res.status(400).json({ success: false, error: "Payroll run has no items" });
    }

    const payrollResult = {
      totals: items.reduce(
        (acc, item) => {
          acc.gross += Number(item.gross_pay);
          acc.net += Number(item.net_pay);
          acc.dues += Number(item.dues_amount);
          acc.benefits += Number(item.benefit_amount);
          acc.pension += Number(item.pension_amount);
          return acc;
        },
        { gross: 0, net: 0, dues: 0, benefits: 0, pension: 0 },
      ),
      items: items.map((item) => ({
        employeeExternalId: item.employee_external_id,
        grossPay: Number(item.gross_pay),
        netPay: Number(item.net_pay),
        duesAmount: Number(item.dues_amount),
        benefitAmount: Number(item.benefit_amount),
        pensionAmount: Number(item.pension_amount),
        trace: {},
      })),
      trace: {},
      traceHash: "derived",
      snapshotHash: "derived",
    };

    const pkg = generateRemittancePackage(payrollResult, body.periodEnd);

    const insertRun = await db.execute(sql`
      insert into employer_remittance_runs (
        organization_id, payroll_run_id, run_code, status,
        period_start, period_end, due_date, total_due,
        package_summary, output_formats, immutable_snapshot_locked,
        generated_by, generated_at
      ) values (
        ${organizationId}, ${body.payrollRunId}, ${`rr-${Date.now()}`}, ${"generated"},
        ${body.periodEnd}::date - interval '13 days', ${body.periodEnd}::date,
        ${pkg.dueDate}::date, ${pkg.totalDue},
        ${JSON.stringify(pkg.summary)}::jsonb, ${JSON.stringify(["csv", "json"])}::jsonb,
        ${true}, ${user.id ?? null}, now()
      ) returning id
    `);

    const remittanceRunId = (insertRun as Array<{ id: string }>)[0]?.id;

    await db.execute(sql`
      insert into employer_execution_artifacts (
        organization_id, remittance_run_id, artifact_type, artifact_name,
        storage_ref, artifact_hash, manifest_json, created_by
      ) values
      (${organizationId}, ${remittanceRunId}, ${"remittance_csv"}, ${"remittance.csv"}, ${`inline://remittance/${remittanceRunId}/csv`}, ${pkg.hashes.csvHash}, ${JSON.stringify({ dueDate: pkg.dueDate })}::jsonb, ${user.id ?? null}),
      (${organizationId}, ${remittanceRunId}, ${"remittance_json"}, ${"remittance.json"}, ${`inline://remittance/${remittanceRunId}/json`}, ${pkg.hashes.jsonHash}, ${JSON.stringify({ dueDate: pkg.dueDate })}::jsonb, ${user.id ?? null}),
      (${organizationId}, ${remittanceRunId}, ${"summary"}, ${"summary.json"}, ${`inline://remittance/${remittanceRunId}/summary`}, ${pkg.hashes.summaryHash}, ${JSON.stringify(pkg.summary)}::jsonb, ${user.id ?? null})
    `);

    return res.status(201).json({ success: true, data: { remittanceRunId, package: pkg } });
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
    select id, run_code, status, due_date, total_due, created_at
    from employer_remittance_runs
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

  const [run] = await db.execute(sql`
    select * from employer_remittance_runs
    where organization_id = ${organizationId} and id = ${req.params.id}
    limit 1
  `);
  if (!run) {
    return res.status(404).json({ success: false, error: "Remittance run not found" });
  }

  const artifacts = await db.execute(sql`
    select * from employer_execution_artifacts
    where organization_id = ${organizationId} and remittance_run_id = ${req.params.id}
    order by created_at asc
  `);

  return res.json({ success: true, data: { run, artifacts } });
});

export default router;
