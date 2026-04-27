export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { CorrespondenceDashboard } from "./correspondence-dashboard";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "correspondencePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function CorrespondencePage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "correspondencePage" });
  const user = await requireUser();
  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) redirect("/dashboard");

  const canSign = await hasMinRole("officer");
  const organizationId = user.organizationId || "default";

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("subtitle")}
        </p>
      </div>

      <CorrespondenceDashboard
        organizationId={organizationId}
        userId={user.userId}
        userRole={user.roles?.[0] ?? "member"}
        canSign={canSign}
      />
    </div>
  );
}
