/**
 * /dashboard/knowledge-base — Union Documents Library
 * Server component with auth guard, delegates to client component
 */
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/api-auth-guard";
import KnowledgeBaseBrowser from "@/components/knowledge/knowledge-base-browser";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "knowledgeBasePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function KnowledgeBaseServerPage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");

  return <KnowledgeBaseBrowser />;
}
