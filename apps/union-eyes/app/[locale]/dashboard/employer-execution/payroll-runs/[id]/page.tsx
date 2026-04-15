import { requireUser } from "@/lib/api-auth-guard";
import { db } from "@/db";
import {
  employerPayrollRuns,
  employerPayrollRunItems,
  employerExecutionReplays,
  employerExecutionComplianceEvents,
  employerExecutionArtifacts,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { PayrollRunTracePanel, ReplayDiffViewer } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

export default async function EmployerExecutionPayrollRunDetailPage({ params }: { params: { id: string } }) {
  const context = await requireUser();
  const organizationId = context.organizationId;

  const [run] = await db
    .select()
    .from(employerPayrollRuns)
    .where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, params.id)))
    .limit(1);

  if (!run) {
    return <div className="p-6 text-sm text-muted-foreground">Payroll run not found.</div>;
  }

  const items = await db
    .select()
    .from(employerPayrollRunItems)
    .where(and(eq(employerPayrollRunItems.organizationId, organizationId), eq(employerPayrollRunItems.payrollRunId, run.id)));

  const [latestReplay] = await db
    .select()
    .from(employerExecutionReplays)
    .where(
      and(
        eq(employerExecutionReplays.organizationId, organizationId),
        eq(employerExecutionReplays.sourcePayrollRunId, run.id),
      ),
    )
    .orderBy(desc(employerExecutionReplays.createdAt))
    .limit(1);

  const complianceEvents = await db
    .select()
    .from(employerExecutionComplianceEvents)
    .where(
      and(
        eq(employerExecutionComplianceEvents.organizationId, organizationId),
        eq(employerExecutionComplianceEvents.payrollRunId, run.id),
      ),
    )
    .orderBy(desc(employerExecutionComplianceEvents.detectedAt));

  const artifacts = await db
    .select()
    .from(employerExecutionArtifacts)
    .where(
      and(
        eq(employerExecutionArtifacts.organizationId, organizationId),
        eq(employerExecutionArtifacts.payrollRunId, run.id),
      ),
    )
    .orderBy(desc(employerExecutionArtifacts.createdAt));

  const chainLinks = artifacts
    .map((artifact) => ((artifact.manifestJson as Record<string, unknown>)?.chainLink ?? null) as Record<string, unknown> | null)
    .filter((value): value is Record<string, unknown> => value !== null);

  const chainDepth = chainLinks.reduce((max, link) => Math.max(max, Number(link.chainDepth ?? 0)), 0);
  const currentSeal = String(chainLinks[0]?.sealHash ?? "n/a");
  const parentLink = String(chainLinks[0]?.parentLinkId ?? "n/a");
  const verificationStatus = chainLinks.length > 0 ? "verified" : "unverified";

  const calcTrace = (run.calcTrace ?? {}) as {
    ruleVersionId?: string;
    sourceHash?: string;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll Run {run.runCode}</h1>
        <p className="text-sm text-muted-foreground">Status: {run.status}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-4 text-sm">
          <h2 className="font-medium">Source Snapshot</h2>
          <p className="mt-1 text-muted-foreground">Batch: {String(run.sourceBatchId ?? "n/a")}</p>
          <p className="text-muted-foreground">Period: {String(run.periodStart)} to {String(run.periodEnd)}</p>
          <p className="text-muted-foreground">Engine: {run.engineVersion}</p>
          <p className="text-muted-foreground">Rule Version: {String(calcTrace.ruleVersionId ?? run.cbaRuleVersionId ?? "n/a")}</p>
          <p className="text-muted-foreground">Rule Source Hash: {String(calcTrace.sourceHash ?? "n/a")}</p>
        </div>
        <div className="rounded-md border p-4 text-sm">
          <h2 className="font-medium">Evidence / Seal</h2>
          <p className="mt-1 text-muted-foreground">Artifacts: {artifacts.length}</p>
          <p className="text-muted-foreground">Verification: {verificationStatus}</p>
          <p className="text-muted-foreground">Chain depth: {chainDepth}</p>
          <p className="text-muted-foreground">Parent link: {parentLink}</p>
          <p className="text-muted-foreground">Current seal: {currentSeal}</p>
          {artifacts.slice(0, 4).map((artifact) => (
            <p key={artifact.id} className="text-muted-foreground">
              {artifact.artifactType}: {artifact.artifactHash}
            </p>
          ))}
        </div>
      </div>

      <PayrollRunTracePanel trace={run.calcTrace as Record<string, unknown>} />

      <ReplayDiffViewer
        diff={
          (latestReplay?.diffJson as {
            changed: boolean;
            summary: string;
            differences: Array<{
              scope: "run" | "employee_item" | "remittance_item";
              subjectId: string;
              field: string;
              originalValue: unknown;
              replayValue: unknown;
              causeType: "input_change" | "rule_change" | "engine_change" | "derived_change";
              causeDetail: string;
              originalRulePath?: string[];
              replayRulePath?: string[];
            }>;
            graphDifferences?: Array<{
              employeeExternalId: string;
              nodeId?: string;
              changeType:
                | "node_added"
                | "node_removed"
                | "condition_changed"
                | "decision_changed"
                | "supersession_changed"
                | "applied_path_changed"
                | "value_changed";
              original?: Record<string, unknown>;
              replay?: Record<string, unknown>;
              causeType: "input_change" | "rule_change" | "engine_change" | "derived_change";
              causeDetail: string;
            }>;
          }) ?? null
        }
      />

      <div className="rounded-md border p-4 text-sm">
        <h2 className="font-medium">Open Compliance Events</h2>
        {complianceEvents.length === 0 ? <p className="mt-1 text-muted-foreground">No compliance events.</p> : null}
        {complianceEvents.map((event) => (
          <p key={event.id} className="mt-1 text-muted-foreground">
            {event.severity} | {event.status} | {event.summary}
          </p>
        ))}
      </div>

      <div className="rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Gross</th>
              <th className="px-3 py-2">Net</th>
              <th className="px-3 py-2">Dues</th>
              <th className="px-3 py-2">Benefits</th>
              <th className="px-3 py-2">Pension</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{item.employeeExternalId}</td>
                <td className="px-3 py-2">{item.grossPay}</td>
                <td className="px-3 py-2">{item.netPay}</td>
                <td className="px-3 py-2">{item.duesAmount}</td>
                <td className="px-3 py-2">{item.benefitAmount}</td>
                <td className="px-3 py-2">{item.pensionAmount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
