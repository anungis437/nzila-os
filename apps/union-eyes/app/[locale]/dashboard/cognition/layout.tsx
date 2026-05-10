import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { SovereigntyPostureBanner } from "@/components/sovereignty/sovereignty-posture-banner";

export default async function CognitionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser();
  if (!(await hasMinRole("system_admin"))) redirect("/dashboard");
  const t = await getTranslations({ locale, namespace: "sovereignty" });
  const ts = await getTranslations({ locale, namespace: "sovereignty.surfaces.cognition" });
  return (
    <>
      <SovereigntyPostureBanner
        surface={ts("name")}
        minRole="system_admin"
        posture={ts("posture")}
        layerLabel={t("layerLabel")}
        roleLabel={t("roleLabels.system_admin")}
        accessNote={t("accessNote")}
      />
      {children}
    </>
  );
}
