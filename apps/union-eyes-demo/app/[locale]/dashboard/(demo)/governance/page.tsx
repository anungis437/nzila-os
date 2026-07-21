export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { Cupe4373GovernancePage } from "@/components/demo/cupe4373-governance-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "governancePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function GovernancePage({ params }: PageProps) {
  const { locale } = await params;
  try {
    await requireUser();
  } catch {
    redirect(`/${locale}/login`);
  }

  // Demo build: every authenticated user sees the demo governance page.
  // Operational Bylaws/Policy/Signatory managers live in the operational
  // app and are intentionally NOT reachable from the demo — see Wave 0 §2.
  return <Cupe4373GovernancePage />;
}
