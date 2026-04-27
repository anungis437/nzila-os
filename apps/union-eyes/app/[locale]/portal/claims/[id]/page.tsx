/**
 * @deprecated Portal consolidated into dashboard (Phase 6 — Workflow Realignment).
 */
import { Metadata } from "next";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portalClaimDetailPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PortalClaimDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  redirect(`/${locale}/dashboard/claims/${id}`);
}
