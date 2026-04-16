import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import {
  employerPayrollRuns,
  employerPayrollRunItems,
  employerRemittanceRuns,
  employerRemittanceRunItems,
  employerExecutionArtifacts,
  employerExecutionEvidenceLinks,
  cbaRuleVersions,
  employerExecutionProfiles,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { createEvidencePack, sha256 } from "../_lib";

const LEGACY_TARGET_ID_COLUMN = "entityId" as const;

type RemittanceFormatter = {
  formatCode: string;
  buildCsv: (rows: Array<{ employeeExternalId: string; dues: number; benefits: number; pension: number; gross: number; net: number }>) => string;
  buildJson: (summary: Record<string, unknown>, rows: Array<Record<string, unknown>>) => string;
};

const defaultFormatter: RemittanceFormatter = {
  formatCode: "default",
  buildCsv(rows) {
    const header = "employee_external_id,gross_pay,dues_amount,benefit_amount,pension_amount,net_pay";
    const body = rows.map((row) =>
      [
        row.employeeExternalId,
        row.gross.toFixed(2),
        row.dues.toFixed(2),
        row.benefits.toFixed(2),
        row.pension.toFixed(2),
        row.net.toFixed(2),
      ].join(","),
    );
    return [header, ...body].join("\n");
  },
  buildJson(summary, rows) {
    return JSON.stringify({ summary, rows }, null, 2);
  },
};

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

    const [payrollEvidenceManifest] = await db
      .select()
      .from(employerExecutionArtifacts)
      .where(
        and(
          eq(employerExecutionArtifacts.organizationId, organizationId),
          eq(employerExecutionArtifacts.payrollRunId, payrollRun.id),
          eq(employerExecutionArtifacts.artifactType, "evidence_manifest"),
        ),
      )
      .orderBy(desc(employerExecutionArtifacts.createdAt))
      .limit(1);

    const parentLink =
      ((payrollEvidenceManifest?.manifestJson as Record<string, unknown> | undefined)?.chainLink as
        | { linkId?: string; sealHash?: string; chainDepth?: number }
        | undefined) ?? undefined;

    const items = await db
      .select()
      .from(employerPayrollRunItems)
      .where(and(eq(employerPayrollRunItems.organizationId, organizationId), eq(employerPayrollRunItems.payrollRunId, body.payrollRunId)));

    const [ruleVersion] = payrollRun.cbaRuleVersionId
      ? await db
          .select()
          .from(cbaRuleVersions)
          .where(
            and(
              eq(cbaRuleVersions.organizationId, organizationId),
              eq(cbaRuleVersions.id, payrollRun.cbaRuleVersionId),
            ),
          )
          .limit(1)
      : [];

    const [profile] = ruleVersion
      ? await db
          .select()
          .from(employerExecutionProfiles)
          .where(
            and(
              eq(employerExecutionProfiles.organizationId, organizationId),
              eq(employerExecutionProfiles.id, ruleVersion.profileId),
            ),
          )
          .limit(1)
      : [];

    const profileConfig = (profile?.configJson ?? {}) as Record<string, unknown>;
    const dueDaysValue = Number(profileConfig.remittance_due_days ?? 15);
    const dueDays = Number.isFinite(dueDaysValue) && dueDaysValue > 0 ? dueDaysValue : 15;

    const dueDate = new Date(String(payrollRun.periodEnd));
    dueDate.setDate(dueDate.getDate() + dueDays);
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

    const mappedRows = items.map((item) => ({
      employeeExternalId: item.employeeExternalId,
      dues: Number(item.duesAmount),
      benefits: Number(item.benefitAmount),
      pension: Number(item.pensionAmount),
      gross: Number(item.grossPay),
      net: Number(item.netPay),
    }));

    const summary = {
      runCode: payrollRun.runCode,
      payrollRunId: payrollRun.id,
      dueDate: dueDateIso,
      totals,
      itemCount: items.length,
      formatter: defaultFormatter.formatCode,
      generatedAt: new Date().toISOString(),
    };

    const csvOutput = defaultFormatter.buildCsv(mappedRows);
    const jsonOutput = defaultFormatter.buildJson(summary, mappedRows);
    const summaryHash = sha256(JSON.stringify(summary));
    const csvHash = sha256(csvOutput);
    const jsonHash = sha256(jsonOutput);

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
            summaryHash,
            csvHash,
            jsonHash,
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

    const evidencePack = createEvidencePack({
      entityType: "remittance_run",
      runRefId: remittanceRun.id,
      organizationId,
      createdBy: userId,
      metadata: {
        runCode: remittanceRun.runCode,
        status: remittanceRun.status,
        engineVersion: payrollRun.engineVersion,
        ruleVersionIds: payrollRun.cbaRuleVersionId ? [payrollRun.cbaRuleVersionId] : [],
        inputRefs: { payrollRunId: payrollRun.id, sourceBatchId: payrollRun.sourceBatchId },
        timesheetBatchIds: payrollRun.sourceBatchId ? [payrollRun.sourceBatchId] : [],
        approvers: payrollRun.approvedBy ? [{ userId: payrollRun.approvedBy, at: payrollRun.approvedAt }] : [],
        statusTimestamps: {
          generatedAt: remittanceRun.generatedAt,
          payrollApprovedAt: payrollRun.approvedAt,
        },
        calcTraceSummaryHash: payrollRun.calcTraceHash,
        parentLink:
          parentLink && parentLink.linkId && parentLink.sealHash
            ? {
                linkId: parentLink.linkId,
                sealHash: parentLink.sealHash,
                chainDepth: Number(parentLink.chainDepth ?? 1),
              }
            : null,
      },
      artifacts: [
        {
          artifactType: "remittance_csv",
          artifactName: "remittance.csv",
          payload: { hash: csvHash },
        },
        {
          artifactType: "remittance_json",
          artifactName: "remittance.json",
          payload: { hash: jsonHash },
        },
        {
          artifactType: "summary",
          artifactName: "remittance-summary.json",
          payload: summary,
        },
      ],
    });

    await withRLSContext(async (tx) => tx.insert(employerExecutionArtifacts).values([
      {
        organizationId,
        remittanceRunId: remittanceRun.id,
        artifactType: "remittance_csv",
        artifactName: "remittance.csv",
        storageRef: `inline://employer-execution/${remittanceRun.id}/remittance.csv`,
        artifactHash: csvHash,
        manifestJson: { format: "csv", content: csvOutput, generatedAt: summary.generatedAt },
        createdBy: userId ?? undefined,
      },
      {
        organizationId,
        remittanceRunId: remittanceRun.id,
        artifactType: "remittance_json",
        artifactName: "remittance.json",
        storageRef: `inline://employer-execution/${remittanceRun.id}/remittance.json`,
        artifactHash: jsonHash,
        manifestJson: { format: "json", content: jsonOutput, generatedAt: summary.generatedAt },
        createdBy: userId ?? undefined,
      },
      {
        organizationId,
        remittanceRunId: remittanceRun.id,
        artifactType: "summary",
        artifactName: "remittance-summary.json",
        storageRef: `inline://employer-execution/${remittanceRun.id}/summary`,
        artifactHash: summaryHash,
        manifestJson: summary,
        createdBy: userId ?? undefined,
      },
      {
        organizationId,
        remittanceRunId: remittanceRun.id,
        artifactType: "evidence_manifest",
        artifactName: "evidence-manifest.json",
        storageRef: `inline://employer-execution/${remittanceRun.id}/manifest`,
        artifactHash: evidencePack.manifestHash,
        manifestJson: {
          ...evidencePack.manifest,
          chainLink: evidencePack.chainLink,
        },
        createdBy: userId ?? undefined,
      },
      {
        organizationId,
        remittanceRunId: remittanceRun.id,
        artifactType: "evidence_seal",
        artifactName: "evidence-seal.sig",
        storageRef: `inline://employer-execution/${remittanceRun.id}/seal`,
        artifactHash: evidencePack.seal,
        manifestJson: {
          sealAlgorithm: "sha256",
          manifestHash: evidencePack.manifestHash,
          chainLink: evidencePack.chainLink,
        },
        createdBy: userId ?? undefined,
      },
    ]));

    await withRLSContext(async (tx) =>
      tx.insert(employerExecutionEvidenceLinks).values({
        organizationId,
        entityType: "remittance_run",
        [LEGACY_TARGET_ID_COLUMN]: remittanceRun.id,
        parentLinkId: evidencePack.chainLink.parentLinkId,
        parentSealHash: evidencePack.chainLink.parentSealHash,
        manifestHash: evidencePack.manifestHash,
        sealHash: evidencePack.seal,
        chainDepth: String(evidencePack.chainLink.chainDepth),
        metadataJson: {
          payrollRunId: payrollRun.id,
          runCode: remittanceRun.runCode,
        },
        createdBy: userId ?? undefined,
      }),
    );

    return { data: { remittanceRun } };
  },
);
