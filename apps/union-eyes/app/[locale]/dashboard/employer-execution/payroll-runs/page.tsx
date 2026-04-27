import Link from "next/link";
import { requireUser } from "@/lib/api-auth-guard";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { employerPayrollRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { PayrollRunWizard } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function EmployerExecutionPayrollRunsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "employerExecutionPayrollRunsPage" });
  const context = await requireUser();
  const organizationId = context.organizationId;

  const runs = await db
    .select()
    .from(employerPayrollRuns)
    .where(eq(employerPayrollRuns.organizationId, organizationId))
    .orderBy(desc(employerPayrollRuns.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <PayrollRunWizard />
      <div className="rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">{t("columns.run")}</th>
              <th className="px-3 py-2">{t("columns.type")}</th>
              <th className="px-3 py-2">{t("columns.status")}</th>
              <th className="px-3 py-2">{t("columns.totalGross")}</th>
              <th className="px-3 py-2">{t("columns.trace")}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t">
                <td className="px-3 py-2">{run.runCode}</td>
                <td className="px-3 py-2">{run.runType}</td>
                <td className="px-3 py-2">{run.status}</td>
                <td className="px-3 py-2">{run.totalGross}</td>
                <td className="px-3 py-2">
                  <Link className="text-blue-700 hover:underline" href={`/dashboard/employer-execution/payroll-runs/${run.id}`}>
                    {t("view")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
