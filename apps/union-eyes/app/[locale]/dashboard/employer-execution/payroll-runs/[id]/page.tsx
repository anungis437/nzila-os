import { requireOrganizationScope } from "@/lib/page-data/organization-scope";
import { loadPayrollRunDetail } from "@/lib/employer-execution/page-reads";
import { PayrollRunTracePanel, ReplayDiffViewer } from "@/components/employer-execution";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function EmployerExecutionPayrollRunDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "employerPayrollRunDetailPage" });

  const { organizationId } = await requireOrganizationScope();

  const detail = await loadPayrollRunDetail(organizationId, id);
  if (!detail) {
    return <div className="p-6 text-sm text-muted-foreground">{t("notFound")}</div>;
  }
  const { run, items, latestReplay, complianceEvents, artifacts } = detail;

  const chainLinks = artifacts
    .map((artifact) => ((artifact.manifestJson as Record<string, unknown>)?.chainLink ?? null) as Record<string, unknown> | null)
    .filter((value): value is Record<string, unknown> => value !== null);

  const chainDepth = chainLinks.reduce((max, link) => Math.max(max, Number(link.chainDepth ?? 0)), 0);
  const fallbackValue = t("fallback.na");
  const currentSeal = String(chainLinks[0]?.sealHash ?? fallbackValue);
  const parentLink = String(chainLinks[0]?.parentLinkId ?? fallbackValue);
  const verificationStatus = chainLinks.length > 0 ? t("verification.verified") : t("verification.unverified");

  const calcTrace = (run.calcTrace ?? {}) as {
    ruleVersionId?: string;
    sourceHash?: string;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title", { runCode: run.runCode })}</h1>
        <p className="text-sm text-muted-foreground">{t("status", { status: run.status })}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-4 text-sm">
          <h2 className="font-medium">{t("sourceSnapshot.title")}</h2>
          <p className="mt-1 text-muted-foreground">{t("sourceSnapshot.batch", { value: String(run.sourceBatchId ?? fallbackValue) })}</p>
          <p className="text-muted-foreground">{t("sourceSnapshot.period", { start: String(run.periodStart), end: String(run.periodEnd) })}</p>
          <p className="text-muted-foreground">{t("sourceSnapshot.engine", { value: run.engineVersion })}</p>
          <p className="text-muted-foreground">{t("sourceSnapshot.ruleVersion", { value: String(calcTrace.ruleVersionId ?? run.cbaRuleVersionId ?? fallbackValue) })}</p>
          <p className="text-muted-foreground">{t("sourceSnapshot.ruleSourceHash", { value: String(calcTrace.sourceHash ?? fallbackValue) })}</p>
        </div>
        <div className="rounded-md border p-4 text-sm">
          <h2 className="font-medium">{t("evidence.title")}</h2>
          <p className="mt-1 text-muted-foreground">{t("evidence.artifacts", { value: artifacts.length })}</p>
          <p className="text-muted-foreground">{t("evidence.verification", { value: verificationStatus })}</p>
          <p className="text-muted-foreground">{t("evidence.chainDepth", { value: chainDepth })}</p>
          <p className="text-muted-foreground">{t("evidence.parentLink", { value: parentLink })}</p>
          <p className="text-muted-foreground">{t("evidence.currentSeal", { value: currentSeal })}</p>
          {artifacts.slice(0, 4).map((artifact) => (
            <p key={artifact.id} className="text-muted-foreground">
              {t("evidence.artifactRow", { type: artifact.artifactType, hash: artifact.artifactHash })}
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
              originalValue: any;
              replayValue: any;
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
        <h2 className="font-medium">{t("compliance.title")}</h2>
        {complianceEvents.length === 0 ? <p className="mt-1 text-muted-foreground">{t("compliance.none")}</p> : null}
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
              <th className="px-3 py-2">{t("table.employee")}</th>
              <th className="px-3 py-2">{t("table.gross")}</th>
              <th className="px-3 py-2">{t("table.net")}</th>
              <th className="px-3 py-2">{t("table.dues")}</th>
              <th className="px-3 py-2">{t("table.benefits")}</th>
              <th className="px-3 py-2">{t("table.pension")}</th>
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
