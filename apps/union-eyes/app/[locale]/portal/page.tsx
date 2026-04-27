/**
 * @deprecated Portal consolidated into dashboard (Phase 6 — Workflow Realignment).
 * All member self-service features are now in the unified dashboard.
 */
import { Metadata } from "next";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portalHomePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PortalPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/priorities`);
}
