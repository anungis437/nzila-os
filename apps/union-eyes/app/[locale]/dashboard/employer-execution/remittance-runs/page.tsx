import Link from "next/link";
import { Metadata } from "next";
import { requireUser } from "@/lib/api-auth-guard";
import { db } from "@/db";
import { employerRemittanceRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { RemittanceRunTable } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "employerRemittanceRunsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function EmployerExecutionRemittanceRunsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "employerRemittanceRunsPage" });
  const context = await requireUser();
  const organizationId = context.organizationId;

  const runs = await db
    .select()
    .from(employerRemittanceRuns)
    .where(eq(employerRemittanceRuns.organizationId, organizationId))
    .orderBy(desc(employerRemittanceRuns.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <RemittanceRunTable
        rows={runs.map((run) => ({
          id: run.id,
          runCode: run.runCode,
          status: run.status,
          dueDate: String(run.dueDate),
          totalDue: String(run.totalDue),
        }))}
      />
      <div className="space-y-2 text-sm">
        {runs.map((run) => (
          <Link key={run.id} className="block text-blue-700 hover:underline" href={`/dashboard/employer-execution/remittance-runs/${run.id}`}>
            {t("openRun", { runCode: run.runCode })}
          </Link>
        ))}
      </div>
    </div>
  );
}
