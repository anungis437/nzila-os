import { withApi, ApiError, z } from "@/lib/api/framework";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { FINANCIAL_MEMBER_DATA_ROLES } from "@/lib/finance/financial-authority";
import { requireLiveFinancialMandate } from "@/lib/finance/require-live-financial-mandate";
import { PLATFORM_MODULES, requireEntitlement } from "@/services/platform-economics/entitlement-guard";
import { employerPayrollRuns, employerPayrollRunItems, employerExecutionArtifacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyEvidenceChainFromLinks } from "../../_lib";
import { approveRun, executeRun } from "@/lib/employer-execution/payroll-run-transitions";

const LEGACY_TARGET_ID_COLUMN = "entityId" as const;

const transitionSchema = z.object({
  action: z.enum(["approve", "seal"]),
  acknowledgedEventIds: z.array(z.guid()).default([]),
});

export const GET = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: "employer_payroll_preview",
    openapi: { tags: ["Employer Execution"], summary: "Get payroll run detail" },
  },
  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const id = params?.id;
    if (typeof id !== "string") throw ApiError.badRequest("Payroll run id is required");

    const loaded = await withRLSContext({ organizationId }, async (tx) => {
      await requireLiveFinancialMandate(tx, organizationId);
      const [run] = await tx
        .select()
        .from(employerPayrollRuns)
        .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, id)))
        .limit(1);
      if (!run) throw ApiError.notFound("Payroll run not found");
      const items = await tx
        .select()
        .from(employerPayrollRunItems)
        .where(and(eq(employerPayrollRunItems.organizationId, organizationId), eq(employerPayrollRunItems.payrollRunId, id)));
      const artifacts = await tx
        .select()
        .from(employerExecutionArtifacts)
      .where(
        and(
          eq(employerExecutionArtifacts.organizationId, organizationId),
          eq(employerExecutionArtifacts.payrollRunId, id),
          eq(employerExecutionArtifacts.artifactType, "evidence_manifest"),
        ),
      );

      return { run, items, artifacts };
    });
    const { run, items, artifacts } = loaded;

    const chainLinks = artifacts
      .map((artifact) => ((artifact.manifestJson as Record<string, unknown>)?.chainLink ?? null) as Record<string, unknown> | null)
      .filter((value): value is Record<string, unknown> => value !== null)
      .map((value) => ({
        linkId: String(value.linkId ?? ""),
        organizationId: String(value.organizationId ?? organizationId),
        entityType: (value.entityType ?? "payroll_run") as
          | "payroll_run"
          | "remittance_run"
          | "replay"
          | "approval"
          | "adjustment_run",
        targetEntityId: String(value.targetEntityId ?? value[LEGACY_TARGET_ID_COLUMN] ?? id),
        parentLinkId: value.parentLinkId ? String(value.parentLinkId) : null,
        parentSealHash: value.parentSealHash ? String(value.parentSealHash) : null,
        manifestHash: String(value.manifestHash ?? ""),
        sealHash: String(value.sealHash ?? ""),
        chainDepth: Number(value.chainDepth ?? 0),
        createdAt: String(value.createdAt ?? new Date().toISOString()),
      }));

    const chainVerification = verifyEvidenceChainFromLinks(chainLinks);

    return { data: { run, items, chainLinks, chainVerification } };
  },
);

export const PATCH = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: "employer_payroll_official",
    body: transitionSchema,
    openapi: { tags: ["Employer Execution"], summary: "Transition official payroll run lifecycle" },
  },
  async ({ organizationId, params, body, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest("Organization context required");
    const id = params?.id;
    if (typeof id !== "string") throw ApiError.badRequest("Payroll run id is required");

    await requireEntitlement(organizationId, PLATFORM_MODULES.EMPLOYER_PAYROLL_OFFICIAL, userId);

    // The run is read under a row lock so two concurrent transitions are serialised; the status predicate on each
    // UPDATE below is the second line of defence. The change, its evidence and its audit record commit together.
    return withRLSContext({ organizationId }, async (tx) => {
      await requireLiveFinancialMandate(tx, organizationId);
      const [run] = await tx
        .select()
        .from(employerPayrollRuns)
        .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, id)))
        .limit(1)
        .for("update");

      if (!run) throw ApiError.notFound("Payroll run not found");
      if (run.runType !== "official") throw ApiError.badRequest("Lifecycle transitions are only allowed for official runs");

      if (body.action === "approve") {
        return approveRun(tx, { organizationId, userId, run, acknowledgedEventIds: body.acknowledgedEventIds });
      }
      if (body.action === "seal") {
        return executeRun(tx, { organizationId, userId, run });
      }
      throw ApiError.badRequest("Unsupported transition action");
    });
  },
);
