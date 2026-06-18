import { Router, Request, Response } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { normalizeTimesheetCsv } from "../services/employer-execution";

const router = Router();

const uploadSchema = z.object({
  employerId: z.string().uuid(),
  worksiteId: z.string().uuid().optional(),
  bargainingUnitId: z.string().uuid().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  fileName: z.string().min(1),
  csvContent: z.string().min(1),
});

router.post("/upload", async (req: Request, res: Response) => {
  try {
    const user = (req as { user?: Record<string, string> }).user ?? {};
    const organizationId = user.organizationId || user.tenantId;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: "Organization context required" });
    }

    const body = uploadSchema.parse(req.body);
    const normalized = normalizeTimesheetCsv(body.csvContent);

    const insertBatch = await db.execute(sql`
      insert into employer_timesheet_batches (
        organization_id, employer_id, worksite_id, bargaining_unit_id,
        batch_code, source_file_name, source_file_hash,
        period_start, period_end, status, validation_summary, uploaded_by
      )
      values (
        ${organizationId}, ${body.employerId}, ${body.worksiteId ?? null}, ${body.bargainingUnitId ?? null},
        ${`ts-${Date.now()}`}, ${body.fileName}, ${"pending_hash"},
        ${body.periodStart}::date, ${body.periodEnd}::date,
        ${normalized.summary.invalid > 0 ? "rejected" : "validated"}, ${JSON.stringify(normalized.summary)}::jsonb, ${user.id ?? null}
      )
      returning id
    `);

    const batchId = (insertBatch as any as Array<{ id: string }>)[0]?.id;

    for (const entry of normalized.entries) {
      await db.execute(sql`
        insert into employer_timesheet_entries (
          organization_id, batch_id, employee_external_id, shift_date,
          regular_hours, overtime_hours, doubletime_hours, travel_hours,
          premium_code, row_number, source_row_hash, validation_errors, status
        )
        values (
          ${organizationId}, ${batchId}, ${entry.employeeExternalId}, ${entry.shiftDate}::date,
          ${entry.regularHours}, ${entry.overtimeHours}, ${entry.doubletimeHours}, ${entry.travelHours},
          ${entry.premiumCode ?? null}, ${entry.rowNumber}, ${`${entry.rowNumber}-${entry.employeeExternalId}`},
          ${JSON.stringify(entry.validationErrors)}::jsonb,
          ${entry.validationErrors.length ? "invalid" : "valid"}
        )
      `);
    }

    return res.status(201).json({
      success: true,
      data: {
        batchId,
        summary: normalized.summary,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected failure",
    });
  }
});

router.get("/", async (req: Request, res: Response) => {
  const user = (req as { user?: Record<string, string> }).user ?? {};
  const organizationId = user.organizationId || user.tenantId;
  if (!organizationId) {
    return res.status(400).json({ success: false, error: "Organization context required" });
  }

  const rows = await db.execute(sql`
    select id, batch_code, source_file_name, period_start, period_end, status, validation_summary, created_at
    from employer_timesheet_batches
    where organization_id = ${organizationId}
    order by created_at desc
    limit 100
  `);

  return res.json({ success: true, data: rows });
});

router.get("/:id", async (req: Request, res: Response) => {
  const user = (req as { user?: Record<string, string> }).user ?? {};
  const organizationId = user.organizationId || user.tenantId;
  if (!organizationId) {
    return res.status(400).json({ success: false, error: "Organization context required" });
  }

  const { id } = req.params;
  const [batch] = await db.execute(sql`
    select * from employer_timesheet_batches
    where organization_id = ${organizationId} and id = ${id}
    limit 1
  `);

  if (!batch) {
    return res.status(404).json({ success: false, error: "Timesheet batch not found" });
  }

  const entries = await db.execute(sql`
    select * from employer_timesheet_entries
    where organization_id = ${organizationId} and batch_id = ${id}
    order by row_number asc
  `);

  return res.json({ success: true, data: { batch, entries } });
});

export default router;
