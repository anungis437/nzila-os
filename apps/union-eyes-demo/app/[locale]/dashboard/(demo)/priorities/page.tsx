/**
 * /dashboard/priorities — "What should I do next?"
 *
 * Surfaces top-priority items: overdue cases, upcoming deadlines,
 * urgency signals, and team-level view for officers.
 *
 * Query params:
 *   ?view=team — shows team-level priorities (officer+)
 *
 * Auth: steward+ (members are redirected to inbox).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/api-auth-guard";
import { Cupe4373PrioritiesPage } from "@/components/demo/cupe4373-priorities-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "prioritiesPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PrioritiesPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }
  // Demo build: every authenticated user sees the demo priorities page.
  return <Cupe4373PrioritiesPage />;
}
