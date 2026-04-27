import { requireUser } from "@/lib/api-auth-guard";
import { Metadata } from "next";
import { db } from "@/db";
import { employerTimesheetBatches, employerTimesheetEntries } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
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
  const context = await requireUser();
  const organizationId = context.organizationId;

  const batches = await db
    .select()
    .from(employerTimesheetBatches)
    .where(eq(employerTimesheetBatches.organizationId, organizationId))
    .orderBy(desc(employerTimesheetBatches.createdAt))
    .limit(1);

  const latestBatch = batches[0];
  const entries = latestBatch
    ? await db
        .select()
        .from(employerTimesheetEntries)
        .where(
          and(
            eq(employerTimesheetEntries.organizationId, organizationId),
            eq(employerTimesheetEntries.batchId, latestBatch.id),
          ),
        )
        .limit(100)
    : [];

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
