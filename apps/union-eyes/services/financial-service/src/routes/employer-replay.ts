import { Router, Request, Response } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { replayDiff, hashReplayDiff } from "../services/employer-execution";

const router = Router();

const replaySchema = z.object({
  sourceRunId: z.string().uuid(),
  replayRunId: z.string().uuid(),
  mode: z.enum(["exact", "simulated"]).default("exact"),
  sourceEngineVersion: z.string(),
  replayEngineVersion: z.string(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const user = (req as { user?: Record<string, string> }).user ?? {};
    const organizationId = user.organizationId || user.tenantId;
    if (!organizationId) {
      return res.status(400).json({ success: false, error: "Organization context required" });
    }

    const body = replaySchema.parse(req.body);

    const [sourceRun] = (await db.execute(sql`
      select total_gross, total_net, total_dues, total_benefits, total_pension
      from employer_payroll_runs
      where organization_id = ${organizationId} and id = ${body.sourceRunId}
      limit 1
    `)) as Array<Record<string, unknown>>;

    const [replayRun] = (await db.execute(sql`
      select total_gross, total_net, total_dues, total_benefits, total_pension
      from employer_payroll_runs
      where organization_id = ${organizationId} and id = ${body.replayRunId}
      limit 1
    `)) as Array<Record<string, unknown>>;

    if (!sourceRun || !replayRun) {
      return res.status(404).json({ success: false, error: "Source or replay run not found" });
    }

    const diff = replayDiff(sourceRun, replayRun);
    const diffHash = hashReplayDiff(diff);

    const insertReplay = await db.execute(sql`
      insert into employer_execution_replays (
        organization_id, source_payroll_run_id, replay_payroll_run_id,
        mode, source_engine_version, replay_engine_version,
        diff_json, diff_summary, diff_hash, created_by
      ) values (
        ${organizationId}, ${body.sourceRunId}, ${body.replayRunId},
        ${body.mode}, ${body.sourceEngineVersion}, ${body.replayEngineVersion},
        ${JSON.stringify(diff)}::jsonb, ${diff.summary}, ${diffHash}, ${user.id ?? null}
      ) returning id
    `);

    const replayId = (insertReplay as Array<{ id: string }>)[0]?.id;

    return res.status(201).json({ success: true, data: { replayId, diff, diffHash } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Unexpected failure" });
  }
});

export default router;
