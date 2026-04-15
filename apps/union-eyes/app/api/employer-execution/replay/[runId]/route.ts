import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { employerPayrollRuns, employerExecutionReplays, employerExecutionArtifacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { sha256 } from "../../_lib";

const replaySchema = z.object({
  replayRunId: z.string().uuid(),
  mode: z.enum(["exact", "simulated"]).default("exact"),
  sourceEngineVersion: z.string().default("employer-execution-v1"),
  replayEngineVersion: z.string().default("employer-execution-v1"),
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

    const [replayRun] = await db
      .select()
      .from(employerPayrollRuns)
      .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, body.replayRunId)))
      .limit(1);

    if (!sourceRun || !replayRun) throw ApiError.notFound("Source or replay run not found");

    const fieldsChanged: Array<{ field: string; before: unknown; after: unknown }> = [];
    const compare = [
      "totalGross",
      "totalNet",
      "totalDues",
      "totalBenefits",
      "totalPension",
      "calcTraceHash",
    ] as const;

    for (const field of compare) {
      if (sourceRun[field] !== replayRun[field]) {
        fieldsChanged.push({
          field,
          before: sourceRun[field],
          after: replayRun[field],
        });
      }
    }

    const diff = {
      changed: fieldsChanged.length > 0,
      fieldsChanged,
      summary:
        fieldsChanged.length > 0
          ? `Changed ${fieldsChanged.length} field(s): ${fieldsChanged.map((f) => f.field).join(", ")}`
          : "Replay matched original run",
    };

    const [replay] = await db
      .insert(employerExecutionReplays)
      .values({
        organizationId,
        sourcePayrollRunId: sourceRun.id,
        replayPayrollRunId: replayRun.id,
        mode: body.mode,
        sourceEngineVersion: body.sourceEngineVersion,
        replayEngineVersion: body.replayEngineVersion,
        diffJson: diff,
        diffSummary: diff.summary,
        diffHash: sha256(JSON.stringify(diff)),
        createdBy: userId ?? undefined,
      })
      .returning();

    await withRLSContext(async (tx) =>
      tx.insert(employerExecutionArtifacts).values({
        organizationId,
        payrollRunId: sourceRun.id,
        artifactType: "replay_diff",
        artifactName: `replay-${replay.id}.json`,
        storageRef: `inline://employer-execution/replays/${replay.id}`,
        artifactHash: sha256(JSON.stringify(diff)),
        manifestJson: diff,
        createdBy: userId ?? undefined,
      }),
    );

    return { data: { replay, diff } };
  },
);
