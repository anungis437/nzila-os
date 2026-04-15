import { Router, Request, Response } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { runEmployerExecutionComplianceChecks } from "../services/employer-execution";

const router = Router();

const runSchema = z.object({
  missingClassificationCount: z.number().int().nonnegative().default(0),
  missingEmploymentLinkageCount: z.number().int().nonnegative().default(0),
  hasActiveRuleVersion: z.boolean().default(true),
  remittanceGenerated: z.boolean().default(false),
  officialApprovalAttempted: z.boolean().default(false),
  replayMismatchCount: z.number().int().nonnegative().default(0),
  payrollRunId: z.string().uuid().optional(),
  remittanceRunId: z.string().uuid().optional(),
});

router.post("/run", async (req: Request, res: Response) => {
  try {
    const user = (req as { user?: Record<string, string> }).user ?? {};
    const organizationId = user.organizationId || user.tenantId;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: "Organization context required" });
    }

    const body = runSchema.parse(req.body);
    const events = runEmployerExecutionComplianceChecks(body);

    for (const event of events) {
      await db.execute(sql`
        insert into employer_execution_compliance_events (
          organization_id, payroll_run_id, remittance_run_id,
          event_code, severity, status, summary, details, blocking, detected_at
        ) values (
          ${organizationId}, ${body.payrollRunId ?? null}, ${body.remittanceRunId ?? null},
          ${event.eventCode}, ${event.severity}, ${"open"}, ${event.summary},
          ${JSON.stringify(event.details ?? {})}::jsonb,
          ${event.blocking ? "yes" : "no"}, now()
        )
      `);
    }

    return res.json({ success: true, data: { events } });
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

  const events = await db.execute(sql`
    select * from employer_execution_compliance_events
    where organization_id = ${organizationId}
    order by detected_at desc
    limit 200
  `);

  return res.json({ success: true, data: events });
});

export default router;
