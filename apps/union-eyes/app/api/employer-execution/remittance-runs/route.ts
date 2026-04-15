import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import {
  employerPayrollRuns,
  employerPayrollRunItems,
  employerRemittanceRuns,
  employerRemittanceRunItems,
  employerExecutionArtifacts,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { sha256 } from "../_lib";

const createSchema = z.object({
  payrollRunId: z.string().uuid(),
});

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "employer_remittance_generation",
    openapi: { tags: ["Employer Execution"], summary: "List remittance runs" },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const rows = await db
      .select()
      .from(employerRemittanceRuns)
      .where(eq(employerRemittanceRuns.organizationId, organizationId))
      .orderBy(desc(employerRemittanceRuns.createdAt));
    return { data: rows };
  },
);

export const POST = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "employer_remittance_generation",
    body: createSchema,
    successStatus: 201,
    openapi: { tags: ["Employer Execution"], summary: "Generate remittance package from approved run" },
  },
  async ({ organizationId, userId, body }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");

    const [payrollRun] = await db
      .select()
      .from(employerPayrollRuns)
      .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, body.payrollRunId)))
      .limit(1);

    if (!payrollRun) throw ApiError.notFound("Payroll run not found");
    if (payrollRun.status !== "approved") throw ApiError.badRequest("Only approved payroll runs can generate remittance");

    const items = await db
      .select()
      .from(employerPayrollRunItems)
      .where(and(eq(employerPayrollRunItems.organizationId, organizationId), eq(employerPayrollRunItems.payrollRunId, body.payrollRunId)));

    const dueDate = new Date(String(payrollRun.periodEnd));
    dueDate.setDate(dueDate.getDate() + 15);
    const dueDateIso = dueDate.toISOString().slice(0, 10);

    const totals = items.reduce(
      (acc, item) => {
        acc.dues += Number(item.duesAmount);
        acc.benefits += Number(item.benefitAmount);
        acc.pension += Number(item.pensionAmount);
        return acc;
      },
      { dues: 0, benefits: 0, pension: 0 },
    );

    const remittanceRun = await withRLSContext(async (tx) => {
      const [createdRun] = await tx
        .insert(employerRemittanceRuns)
        .values({
          organizationId,
          payrollRunId: payrollRun.id,
          runCode: `rr-${Date.now()}`,
          status: "generated",
          periodStart: payrollRun.periodStart,
          periodEnd: payrollRun.periodEnd,
          dueDate: dueDateIso,
          totalDue: (totals.dues + totals.benefits + totals.pension).toString(),
          packageSummary: {
            dues: totals.dues,
            benefits: totals.benefits,
            pension: totals.pension,
            itemCount: items.length,
          },
          outputFormats: ["csv", "json"],
          immutableSnapshotLocked: true,
          generatedBy: userId ?? undefined,
          generatedAt: new Date(),
        })
        .returning();

      await tx.insert(employerRemittanceRunItems).values(
        [
          { groupKey: "dues", contributionType: "dues", amount: totals.dues },
          { groupKey: "benefits", contributionType: "benefits", amount: totals.benefits },
          { groupKey: "pension", contributionType: "pension", amount: totals.pension },
        ].map((item) => ({
          organizationId,
          remittanceRunId: createdRun.id,
          groupKey: item.groupKey,
          contributionType: item.contributionType,
          amount: item.amount.toString(),
          memberCount: items.length.toString(),
          traceJson: { sourcePayrollRunId: payrollRun.id },
        })),
      );

      return createdRun;
    });

    const summary = {
      runCode: remittanceRun.runCode,
      dueDate: remittanceRun.dueDate,
      totals,
      itemCount: items.length,
    };

    await withRLSContext(async (tx) => tx.insert(employerExecutionArtifacts).values([
      {
        organizationId,
        remittanceRunId: remittanceRun.id,
        artifactType: "summary",
        artifactName: "remittance-summary.json",
        storageRef: `inline://employer-execution/${remittanceRun.id}/summary`,
        artifactHash: sha256(JSON.stringify(summary)),
        manifestJson: summary,
        createdBy: userId ?? undefined,
      },
      {
        organizationId,
        remittanceRunId: remittanceRun.id,
        artifactType: "evidence_manifest",
        artifactName: "evidence-manifest.json",
        storageRef: `inline://employer-execution/${remittanceRun.id}/manifest`,
        artifactHash: sha256(JSON.stringify({ remittanceRunId: remittanceRun.id, summary })),
        manifestJson: { remittanceRunId: remittanceRun.id, summary },
        createdBy: userId ?? undefined,
      },
      {
        organizationId,
        remittanceRunId: remittanceRun.id,
        artifactType: "evidence_seal",
        artifactName: "evidence-seal.sig",
        storageRef: `inline://employer-execution/${remittanceRun.id}/seal`,
        artifactHash: sha256(`${remittanceRun.id}:${sha256(JSON.stringify(summary))}`),
        manifestJson: { sealAlgorithm: "sha256" },
        createdBy: userId ?? undefined,
      },
    ]));

    return { data: { remittanceRun } };
  },
);
