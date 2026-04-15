import { withApi, ApiError, z } from "@/lib/api/framework";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { PLATFORM_MODULES, requireEntitlement } from "@/services/platform-economics/entitlement-guard";
import {
  employerPayrollRuns,
  employerPayrollRunItems,
  employerExecutionComplianceEvents,
  employerExecutionArtifacts,
  cbaRuleVersions,
  employerExecutionProfiles,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { createEvidencePack, enforcePayrollLifecycleTransition, sha256 } from "../../_lib";

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

    return { data: { run, items } };
  },
);

export const PATCH = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "employer_payroll_official",
    body: transitionSchema,
    openapi: { tags: ["Employer Execution"], summary: "Transition official payroll run lifecycle" },
  },
  async ({ organizationId, params, body, userId }) => {
    if (!organizationId) throw ApiError.badRequest("Organization context required");
    const id = params?.id;
    if (typeof id !== "string") throw ApiError.badRequest("Payroll run id is required");

    await requireEntitlement(organizationId, PLATFORM_MODULES.EMPLOYER_PAYROLL_OFFICIAL, userId ?? undefined);

    const [run] = await db
      .select()
      .from(employerPayrollRuns)
      .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, id)))
      .limit(1);

    if (!run) throw ApiError.notFound("Payroll run not found");
    if (run.runType !== "official") throw ApiError.badRequest("Lifecycle transitions are only allowed for official runs");

    if (body.action === "approve") {
      const blockingCritical = await db
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

      const openHighEvents = await db
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
      const acknowledgedIds = body.acknowledgedEventIds.filter((eventId) => openErrorIds.has(eventId));

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

      if (acknowledgedIds.length > 0) {
        await withRLSContext(async (tx) =>
          tx
            .update(employerExecutionComplianceEvents)
            .set({
              status: "acknowledged",
              resolvedAt: new Date(),
              resolvedBy: userId ?? undefined,
            })
            .where(
              and(
                eq(employerExecutionComplianceEvents.organizationId, organizationId),
                inArray(employerExecutionComplianceEvents.id, acknowledgedIds),
              ),
            ),
        );
      }

      const [ruleVersion] = run.cbaRuleVersionId
        ? await db
            .select()
            .from(cbaRuleVersions)
            .where(
              and(
                eq(cbaRuleVersions.organizationId, organizationId),
                eq(cbaRuleVersions.id, run.cbaRuleVersionId),
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

      const config = (profile?.configJson ?? {}) as Record<string, unknown>;
      const requireDualApproval = config.require_dual_approval === true;
      const snapshot = ((run.inputSnapshot ?? {}) as Record<string, unknown>) || {};
      const approvals = Array.isArray(snapshot.approvals)
        ? (snapshot.approvals as Array<{ userId?: string; at?: string }>)
        : [];

      if (requireDualApproval) {
        if (approvals.length === 0) {
          await withRLSContext(async (tx) =>
            tx
              .update(employerPayrollRuns)
              .set({
                inputSnapshot: {
                  ...snapshot,
                  approvals: [{ userId, at: new Date().toISOString() }],
                },
              })
              .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, run.id))),
          );

          return {
            data: {
              runId: run.id,
              status: run.status,
              approvalPending: true,
              message: "First approval captured; a second distinct approver is required",
            },
          };
        }

        const firstApproverId = String(approvals[0]?.userId ?? "");
        if (!userId || firstApproverId === userId) {
          throw ApiError.badRequest("Dual approval requires a second distinct approver");
        }
      }

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
            approvedAt: new Date().toISOString(),
          },
          approvers: userId ? [{ userId, at: new Date().toISOString() }] : [],
          inputSnapshotHash: sha256(JSON.stringify(run.inputSnapshot ?? {})),
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
            payload: {
              totalGross: run.totalGross,
              totalNet: run.totalNet,
              totalDues: run.totalDues,
              totalBenefits: run.totalBenefits,
              totalPension: run.totalPension,
            },
          },
        ],
      });

      const [updatedRun] = await withRLSContext(async (tx) => {
        const [nextRun] = await tx
          .update(employerPayrollRuns)
          .set({
            status: "approved",
            immutableSnapshotLocked: true,
            approvedBy: userId ?? undefined,
            approvedAt: new Date(),
          })
          .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, run.id)))
          .returning();

        await tx.insert(employerExecutionArtifacts).values([
          {
            organizationId,
            payrollRunId: run.id,
            artifactType: "evidence_manifest",
            artifactName: "evidence-manifest.json",
            storageRef: `inline://employer-execution/${run.id}/evidence-manifest`,
            artifactHash: evidencePack.manifestHash,
            manifestJson: evidencePack.manifest,
            createdBy: userId ?? undefined,
          },
          {
            organizationId,
            payrollRunId: run.id,
            artifactType: "evidence_seal",
            artifactName: "evidence-seal.sig",
            storageRef: `inline://employer-execution/${run.id}/evidence-seal`,
            artifactHash: evidencePack.seal,
            manifestJson: { algorithm: "sha256", manifestHash: evidencePack.manifestHash },
            createdBy: userId ?? undefined,
          },
        ]);

        await tx.insert(employerExecutionComplianceEvents).values({
          organizationId,
          payrollRunId: run.id,
          eventCode: "official_run_approved",
          severity: "info",
          status: "resolved",
          summary: "Official payroll run approved and evidence sealed",
          details: {
            approvedBy: userId,
            evidenceManifestHash: evidencePack.manifestHash,
            evidenceSeal: evidencePack.seal,
          },
          blocking: "no",
        });

        return [nextRun];
      });

      return { data: { run: updatedRun } };
    }

    if (body.action === "seal") {
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

      const [sealedRun] = await withRLSContext(async (tx) =>
        tx
          .update(employerPayrollRuns)
          .set({
            status: "posted",
            immutableSnapshotLocked: true,
          })
          .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, run.id)))
          .returning(),
      );

      return { data: { run: sealedRun } };
    }

    throw ApiError.badRequest("Unsupported transition action");
  },
);
