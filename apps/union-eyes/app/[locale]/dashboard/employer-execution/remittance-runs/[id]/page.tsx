import { requireOrganizationScope } from "@/lib/page-data/organization-scope";
import { Metadata } from "next";
import { loadRemittanceRunDetail } from "@/lib/employer-execution/page-reads";
import { getTranslations } from "next-intl/server";
import { RemittanceArtifactCard } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "employerRemittanceRunDetailPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function EmployerExecutionRemittanceRunDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "employerRemittanceRunDetailPage" });
  const { organizationId } = await requireOrganizationScope();

  const detail = await loadRemittanceRunDetail(organizationId, id);
  if (!detail) {
    return <div className="p-6 text-sm text-muted-foreground">{t("notFound")}</div>;
  }
  const { run, artifacts, complianceEvents } = detail;

  const chainLinks = artifacts
    .map((artifact) => ((artifact.manifestJson as Record<string, unknown>)?.chainLink ?? null) as Record<string, unknown> | null)
    .filter((value): value is Record<string, unknown> => value !== null);

  const chainDepth = chainLinks.reduce((max, link) => Math.max(max, Number(link.chainDepth ?? 0)), 0);
  const verificationStatus = chainLinks.length > 0 ? "verified" : "unverified";
  const parentLink = String(chainLinks[0]?.parentLinkId ?? "n/a");
  const sealHash = String(chainLinks[0]?.sealHash ?? "n/a");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title", { runCode: run.runCode })}</h1>
        <p className="text-sm text-muted-foreground">{t("status", { status: run.status })}</p>
      </div>

      <div className="rounded-md border p-4 text-sm">
        <h2 className="font-medium">{t("runSummary.title")}</h2>
        <p className="mt-1 text-muted-foreground">{t("runSummary.payrollRun", { value: String(run.payrollRunId) })}</p>
        <p className="text-muted-foreground">{t("runSummary.dueDate", { value: String(run.dueDate) })}</p>
        <p className="text-muted-foreground">{t("runSummary.totalDue", { value: String(run.totalDue) })}</p>
        <p className="text-muted-foreground">{t("runSummary.generatedAt", { value: String(run.generatedAt ?? "n/a") })}</p>
        <p className="text-muted-foreground">{t("runSummary.verification", { value: verificationStatus })}</p>
        <p className="text-muted-foreground">{t("runSummary.chainDepth", { value: chainDepth })}</p>
        <p className="text-muted-foreground">{t("runSummary.parentLink", { value: parentLink })}</p>
        <p className="text-muted-foreground">{t("runSummary.currentSeal", { value: sealHash })}</p>
      </div>

      <div className="rounded-md border p-4 text-sm">
        <h2 className="font-medium">{t("compliance.title")}</h2>
        {complianceEvents.length === 0 ? <p className="mt-1 text-muted-foreground">{t("compliance.none")}</p> : null}
        {complianceEvents.map((event) => (
          <p key={event.id} className="mt-1 text-muted-foreground">
            {event.severity} | {event.status} | {event.summary}
          </p>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {artifacts.map((artifact) => (
          <RemittanceArtifactCard
            key={artifact.id}
            artifact={{
              id: artifact.id,
              artifactType: artifact.artifactType,
              artifactName: artifact.artifactName,
              artifactHash: artifact.artifactHash,
              storageRef: artifact.storageRef,
            }}
          />
        ))}
      </div>
    </div>
  );
}
