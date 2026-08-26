/**
 * /dashboard/agreements — Collective agreements page
 * Server component with auth guard, delegates to client component
 */
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { getTranslations } from "next-intl/server";
import { isCupe4373DemoRuntime } from "@/lib/dashboard/role-experience";
import AgreementsPage from "./agreements-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agreementsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AgreementsServerPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { q } = await searchParams;

  try {
    await requireUser();
  } catch {
    redirect(`/${locale}/login`);
  }

  const hasAccess = !isCupe4373DemoRuntime() ? await hasMinRole("steward") : true;
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }

  return <AgreementsPage initialQuery={q ?? ""} />;
}
