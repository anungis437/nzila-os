import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext, type RLSTx } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { FINANCIAL_MEMBER_DATA_ROLES } from "@/lib/finance/financial-authority";
import { participantsFromRun, recordedRunAmounts } from "@/lib/employer-execution/run-duties";
import { PLATFORM_MODULES, requireEntitlement } from "@/services/platform-economics/entitlement-guard";
import {
  employerPayrollRuns,
  type EmployerPayrollRun,
  employerPayrollRunItems,
  employerExecutionComplianceEvents,
  employerExecutionArtifacts,
  employerExecutionEvidenceLinks,
  cbaRuleVersions,
  employerExecutionProfiles,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createEvidencePack, enforcePayrollLifecycleTransition, sha256, verifyEvidenceChainFromLinks } from "../../_lib";
import { enforceRunDuty } from "../../_guard";

const LEGACY_TARGET_ID_COLUMN = "entityId" as const;

const transitionSchema = z.object({
  action: z.enum(["approve", "seal"]),
  acknowledgedEventIds: z.array(z.string().uuid()).default([]),
});

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "employer_payroll_preview",
    openapi: { tags: ["Employer Execution"], summary: "Get payroll run detail" },
  },
  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const id = params?.id;
    if (typeof id !== "string") throw ApiError.badRequest("Payroll run id is required");

    const [run] = await db
      .select()
      .from(employerPayrollRuns)
      .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, id)))
      .limit(1);

    if (!run) throw ApiError.notFound("Payroll run not found");

    const items = await db
      .select()
      .from(employerPayrollRunItems)
      .where(and(eq(employerPayrollRunItems.organizationId, organizationId), eq(employerPayrollRunItems.payrollRunId, id)));

    const artifacts = await db
      .select()
      .from(employerExecutionArtifacts)
      .where(
        and(
          eq(employerExecutionArtifacts.organizationId, organizationId),
          eq(employerExecutionArtifacts.payrollRunId, id),
          eq(employerExecutionArtifacts.artifactType, "evidence_manifest"),
        ),
      );

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

type TransitionInput = { organizationId: string; userId: string; run: EmployerPayrollRun };

async function approveRun(
  tx: RLSTx,
  { organizationId, userId, run, acknowledgedEventIds }: TransitionInput & { acknowledgedEventIds: string[] },
) {
  const blockingCritical = await tx
    .select({ id: employerExecutionComplianceEvents.id })
    .from(employerExecutionComplianceEvents)
    .where(
      and(
        eq(employerExecutionComplianceEvents.organizationId, organizationId),
        eq(employerExecutionComplianceEvents.payrollRunId, run.id),
        eq(employerExecutionComplianceEvents.status, "open"),
        eq(employerExecutionComplianceEvents.blocking, "yes"),
        eq(employerExecutionComplianceEvents.severity, "critical"),
      ),
    );

  if (blockingCritical.length > 0) {
    throw ApiError.badRequest("Cannot approve official payroll run while critical compliance events are unresolved");
  }

  const openHighEvents = await tx
    .select({ id: employerExecutionComplianceEvents.id })
    .from(employerExecutionComplianceEvents)
    .where(
      and(
        eq(employerExecutionComplianceEvents.organizationId, organizationId),
        eq(employerExecutionComplianceEvents.payrollRunId, run.id),
        eq(employerExecutionComplianceEvents.status, "open"),
        eq(employerExecutionComplianceEvents.severity, "error"),
      ),
    );

  const openErrorIds = new Set(openHighEvents.map((event) => event.id));
  const acknowledgedIds = acknowledgedEventIds.filter((eventId) => openErrorIds.has(eventId));

  try {
    enforcePayrollLifecycleTransition({
      status: run.status as "draft" | "calculated" | "approved" | "posted",
      action: "approve",
      immutableSnapshotLocked: run.immutableSnapshotLocked,
      criticalOpenCount: blockingCritical.length,
      errorOpenCount: openHighEvents.length,
      acknowledgedErrorCount: acknowledgedIds.length,
    });
  } catch (error) {
    throw ApiError.badRequest(error instanceof Error ? error.message : "Invalid lifecycle transition");
  }

  const participants = participantsFromRun(run);
  enforceRunDuty("approve", userId, participants);

  const [ruleVersion] = run.cbaRuleVersionId
    ? await tx
        .select()
        .from(cbaRuleVersions)
        .where(and(eq(cbaRuleVersions.organizationId, organizationId), eq(cbaRuleVersions.id, run.cbaRuleVersionId)))
        .limit(1)
    : [];

  const [profile] = ruleVersion
    ? await tx
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

  const config = (profile?.configJson ?? {}) as Record<string, unknown>;
  const requireDualApproval = config.require_dual_approval === true;
  const snapshot = ((run.inputSnapshot ?? {}) as Record<string, unknown>) || {};
  const priorApprovers = participants.approvedBy ?? [];

  if (acknowledgedIds.length > 0) {
    await tx
      .update(employerExecutionComplianceEvents)
      .set({
        status: "acknowledged",
        resolvedAt: new Date(),
        resolvedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(employerExecutionComplianceEvents.organizationId, organizationId),
          eq(employerExecutionComplianceEvents.payrollRunId, run.id),
          inArray(employerExecutionComplianceEvents.id, acknowledgedIds),
        ),
      );
  }

  if (requireDualApproval && priorApprovers.length === 0) {
    const [recorded] = await tx
      .update(employerPayrollRuns)
      .set({
        inputSnapshot: {
          ...snapshot,
          approvals: [{ userId, at: new Date().toISOString() }],
        },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(employerPayrollRuns.organizationId, organizationId),
          eq(employerPayrollRuns.id, run.id),
          eq(employerPayrollRuns.status, "calculated"),
          eq(employerPayrollRuns.immutableSnapshotLocked, false),
          sql`jsonb_array_length(coalesce(${employerPayrollRuns.inputSnapshot}->'approvals', '[]'::jsonb)) = 0`,
        ),
      )
      .returning({ id: employerPayrollRuns.id });

    if (!recorded) throw ApiError.conflict("Payroll run changed state while the approval was being recorded");

    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: "employer_execution.payroll_run.approval_recorded",
      resourceType: "employer_payroll_runs",
      resourceId: run.id,
      details: {
        runCode: run.runCode,
        preparedBy: participants.preparedBy,
        firstApprover: userId,
        acknowledgedEventIds: acknowledgedIds,
        amounts: recordedRunAmounts(run),
      },
    });

    return {
      data: {
        runId: run.id,
        status: run.status,
        approvalPending: true,
        message: "First approval captured; a second distinct approver is required",
      },
    };
  }

  const approvedAt = new Date();
  const evidencePack = createEvidencePack({
    entityType: "payroll_run",
    runRefId: run.id,
    organizationId,
    createdBy: userId,
    metadata: {
      runCode: run.runCode,
      status: run.status,
      engineVersion: run.engineVersion,
      ruleVersionIds: run.cbaRuleVersionId ? [run.cbaRuleVersionId] : [],
      inputRefs: { sourceBatchId: run.sourceBatchId },
      timesheetBatchIds: run.sourceBatchId ? [run.sourceBatchId] : [],
      calcTraceSummaryHash: run.calcTraceHash,
      statusTimestamps: {
        approvedAt: approvedAt.toISOString(),
      },
      approvers: [...priorApprovers, userId].map((approver) => ({ userId: approver, at: approvedAt.toISOString() })),
      inputSnapshotHash: sha256(JSON.stringify(run.inputSnapshot ?? {})),
      parentLink: null,
    },
    artifacts: [
      {
        artifactType: "payroll_snapshot",
        artifactName: "payroll-input-snapshot.json",
        payload: (run.inputSnapshot ?? {}) as Record<string, unknown>,
      },
      {
        artifactType: "payroll_trace",
        artifactName: "payroll-calc-trace.json",
        payload: (run.calcTrace ?? {}) as Record<string, unknown>,
      },
      {
        artifactType: "summary",
        artifactName: "payroll-summary.json",
        payload: recordedRunAmounts(run),
      },
    ],
  });

  const [updatedRun] = await tx
    .update(employerPayrollRuns)
    .set({
      status: "approved",
      immutableSnapshotLocked: true,
      approvedBy: userId,
      approvedAt,
      updatedAt: approvedAt,
    })
    .where(
      and(
        eq(employerPayrollRuns.organizationId, organizationId),
        eq(employerPayrollRuns.id, run.id),
        eq(employerPayrollRuns.status, "calculated"),
        eq(employerPayrollRuns.immutableSnapshotLocked, false),
      ),
    )
    .returning();

  if (!updatedRun) throw ApiError.conflict("Payroll run changed state while it was being approved");

  await tx.insert(employerExecutionArtifacts).values([
    {
      organizationId,
      payrollRunId: run.id,
      artifactType: "evidence_manifest",
      artifactName: "evidence-manifest.json",
      storageRef: `inline://employer-execution/${run.id}/evidence-manifest`,
      artifactHash: evidencePack.manifestHash,
      manifestJson: {
        ...evidencePack.manifest,
        chainLink: evidencePack.chainLink,
      },
      createdBy: userId,
    },
    {
      organizationId,
      payrollRunId: run.id,
      artifactType: "evidence_seal",
      artifactName: "evidence-seal.sig",
      storageRef: `inline://employer-execution/${run.id}/evidence-seal`,
      artifactHash: evidencePack.seal,
      manifestJson: {
        algorithm: "sha256",
        manifestHash: evidencePack.manifestHash,
        chainLink: evidencePack.chainLink,
      },
      createdBy: userId,
    },
  ]);

  await tx.insert(employerExecutionEvidenceLinks).values({
    organizationId,
    entityType: "payroll_run",
    [LEGACY_TARGET_ID_COLUMN]: run.id,
    parentLinkId: null,
    parentSealHash: null,
    manifestHash: evidencePack.manifestHash,
    sealHash: evidencePack.seal,
    chainDepth: "1",
    metadataJson: {
      runCode: run.runCode,
      status: "approved",
      evidenceLinkId: evidencePack.chainLink.linkId,
    },
    createdBy: userId,
  });

  const approvalEvent = createEvidencePack({
    entityType: "approval",
    runRefId: run.id,
    organizationId,
    createdBy: userId,
    metadata: {
      action: "approve",
      parentLink: {
        linkId: evidencePack.chainLink.linkId,
        sealHash: evidencePack.chainLink.sealHash,
        chainDepth: evidencePack.chainLink.chainDepth,
      },
    },
    artifacts: [
      {
        artifactType: "summary",
        artifactName: "approval-event-summary.json",
        payload: { payrollRunId: run.id, approvedBy: userId, approvedAt: approvedAt.toISOString() },
      },
    ],
  });

  await tx.insert(employerExecutionEvidenceLinks).values({
    organizationId,
    entityType: "approval",
    [LEGACY_TARGET_ID_COLUMN]: run.id,
    parentLinkId: evidencePack.chainLink.linkId,
    parentSealHash: evidencePack.chainLink.sealHash,
    manifestHash: approvalEvent.manifestHash,
    sealHash: approvalEvent.seal,
    chainDepth: String(approvalEvent.chainLink.chainDepth),
    metadataJson: {
      event: "approve",
      parent: evidencePack.chainLink.linkId,
    },
    createdBy: userId,
  });

  await tx.insert(employerExecutionComplianceEvents).values({
    organizationId,
    payrollRunId: run.id,
    eventCode: "official_run_approved",
    severity: "info",
    status: "resolved",
    summary: "Official payroll run approved and evidence sealed",
    details: {
      approvedBy: userId,
      preparedBy: participants.preparedBy,
      evidenceManifestHash: evidencePack.manifestHash,
      evidenceSeal: evidencePack.seal,
    },
    blocking: "no",
  });

  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: "employer_execution.payroll_run.approve",
    resourceType: "employer_payroll_runs",
    resourceId: run.id,
    details: {
      runCode: run.runCode,
      preparedBy: participants.preparedBy,
      approvers: [...priorApprovers, userId],
      dualApproval: requireDualApproval,
      acknowledgedEventIds: acknowledgedIds,
      amounts: recordedRunAmounts(updatedRun),
      evidenceManifestHash: evidencePack.manifestHash,
      evidenceSeal: evidencePack.seal,
    },
  });

  return { data: { run: updatedRun } };
}

async function executeRun(tx: RLSTx, { organizationId, userId, run }: TransitionInput) {
  try {
    enforcePayrollLifecycleTransition({
      status: run.status as "draft" | "calculated" | "approved" | "posted",
      action: "seal",
      immutableSnapshotLocked: run.immutableSnapshotLocked,
      criticalOpenCount: 0,
      errorOpenCount: 0,
      acknowledgedErrorCount: 0,
    });
  } catch (error) {
    throw ApiError.badRequest(error instanceof Error ? error.message : "Invalid lifecycle transition");
  }

  const participants = participantsFromRun(run);
  enforceRunDuty("execute", userId, participants);

  const [sealedRun] = await tx
    .update(employerPayrollRuns)
    .set({
      status: "posted",
      immutableSnapshotLocked: true,
      executedBy: userId,
      executedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(employerPayrollRuns.organizationId, organizationId),
        eq(employerPayrollRuns.id, run.id),
        eq(employerPayrollRuns.status, "approved"),
      ),
    )
    .returning();

  if (!sealedRun) throw ApiError.conflict("Payroll run is no longer in the approved state; it was already executed or changed");

  // The executor is a column on the run (platform 0021) and is also recorded here and in the audit entry.
  await tx.insert(employerExecutionComplianceEvents).values({
    organizationId,
    payrollRunId: run.id,
    eventCode: "official_run_posted",
    severity: "info",
    status: "resolved",
    summary: "Official payroll run executed (posted)",
    details: {
      executedBy: userId,
      preparedBy: participants.preparedBy,
      approvers: participants.approvedBy,
      amounts: recordedRunAmounts(sealedRun),
    },
    blocking: "no",
  });

  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: "employer_execution.payroll_run.execute",
    resourceType: "employer_payroll_runs",
    resourceId: run.id,
    details: {
      runCode: run.runCode,
      preparedBy: participants.preparedBy,
      approvers: participants.approvedBy,
      executedBy: userId,
      amounts: recordedRunAmounts(sealedRun),
    },
  });

  return { data: { run: sealedRun } };
}
