import { requireOrganizationScope } from "@/lib/page-data/organization-scope";
import { Metadata } from "next";
import { loadLatestTimesheetBatch } from "@/lib/employer-execution/page-reads";
import { getTranslations } from "next-intl/server";
import { TimesheetBatchUploader, TimesheetValidationTable } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "employerTimesheetsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function EmployerExecutionTimesheetsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "employerTimesheetsPage" });
  const { organizationId } = await requireOrganizationScope();

  const { entries } = await loadLatestTimesheetBatch(organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <TimesheetBatchUploader />
      <TimesheetValidationTable
        rows={entries.map((entry) => ({
          rowNumber: entry.rowNumber,
          employeeExternalId: entry.employeeExternalId,
          shiftDate: String(entry.shiftDate),
          regularHours: String(entry.regularHours),
          overtimeHours: String(entry.overtimeHours),
          status: entry.status,
          validationErrors: entry.validationErrors,
        }))}
      />
    </div>
  );
}
