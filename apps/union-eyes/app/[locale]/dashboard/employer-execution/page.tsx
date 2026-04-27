import { requireUser } from "@/lib/api-auth-guard";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmployerExecutionDashboard } from "@/components/employer-execution";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "employerExecutionPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function EmployerExecutionPage() {
  await requireUser();
  return <EmployerExecutionDashboard />;
}
