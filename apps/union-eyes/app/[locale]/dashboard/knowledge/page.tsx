/**
 * /dashboard/knowledge — Reference, learning, and agreements.
 *
 * Search-first reference hub: agreements, education, clause library,
 * precedents, and calendar.
 *
 * Auth: member+ (all union members can access knowledge).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/api-auth-guard";
import { KnowledgeConsole } from "@/components/knowledge/knowledge-console";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "knowledgePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function KnowledgePage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");

  return <KnowledgeConsole />;
}
