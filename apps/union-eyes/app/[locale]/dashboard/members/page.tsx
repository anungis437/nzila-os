export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import MembersConsole from "@/components/members/members-console";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "members" });
  return {
    title: t("directory"),
    description: t("directoryDescription"),
  };
}

export default async function MembersDirectoryPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return <MembersConsole />;
}
