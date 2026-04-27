/**
 * Phase 5B: Shared Clause Library Page (server wrapper)
 * Auth-gated — delegates to ClauseLibraryConsole client component
 */

import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ClauseLibraryConsole } from "@/components/clause-library/clause-library-console";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clauseLibraryPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ClauseLibraryPage({ searchParams }: Props) {
  await requireUser();
  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  return <ClauseLibraryConsole initialQuery={initialQuery} />;
}
