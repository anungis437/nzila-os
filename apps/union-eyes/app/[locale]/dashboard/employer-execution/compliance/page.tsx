import { requireOrganizationScope } from "@/lib/page-data/organization-scope";
import { getTranslations } from "next-intl/server";
import { listComplianceEvents } from "@/lib/employer-execution/page-reads";
import { ComplianceIssuesPanel } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function EmployerExecutionCompliancePage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "employerExecutionCompliancePage" });
  const { organizationId } = await requireOrganizationScope();

  const events = await listComplianceEvents(organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ComplianceIssuesPanel
        events={events.map((event) => ({
          id: event.id,
          eventCode: event.eventCode,
          severity: event.severity as "info" | "warning" | "error" | "critical",
          blocking: event.blocking,
          status: event.status,
          payrollRunId: event.payrollRunId,
          remittanceRunId: event.remittanceRunId,
          summary: event.summary,
          detectedAt: String(event.detectedAt),
        }))}
      />
    </div>
  );
}
