/**
 * @deprecated Portal consolidated into dashboard (Phase 6 — Workflow Realignment).
 */
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portalNewClaimPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PortalNewClaimPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/claims/new`);
}
