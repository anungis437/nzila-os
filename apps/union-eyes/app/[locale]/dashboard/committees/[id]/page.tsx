export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CommitteeWorkspace } from "./committee-workspace";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "committeeDetailPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Page({
  params,
}: PageProps) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const hasAccess = await hasMinRole("steward");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  const { id } = await params;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <CommitteeWorkspace
        committeeId={id}
        organizationId={user.organizationId || "default"}
        userId={user.userId}
        userRole={user.role ?? "member"}
      />
    </div>
  );
}
