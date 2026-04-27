/**
 * /dashboard/outcomes — Results, finances, and voting.
 *
 * Reflective surface: "What has been accomplished?"
 * Aggregates voting results, dues status, pension, and financial summaries.
 *
 * Auth: member+ (all union members can review their outcomes).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser, isCongressOrg } from "@/lib/api-auth-guard";
import { OutcomesConsole } from "@/components/outcomes/outcomes-console";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "outcomesPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function OutcomesPage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");

  // Congress orgs have their own CLC dashboard — no outcomes view
  if (await isCongressOrg(user.organizationId)) {
    redirect("/dashboard/clc");
  }

  return <OutcomesConsole />;
}
