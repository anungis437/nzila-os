import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { SovereigntyPostureBanner } from "@/components/sovereignty/sovereignty-posture-banner";

export default async function OperationsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser();
  if (!(await hasMinRole("officer"))) redirect("/dashboard");
  const t = await getTranslations({ locale, namespace: "sovereignty" });
  const ts = await getTranslations({ locale, namespace: "sovereignty.surfaces.operations" });
  return (
    <>
      <SovereigntyPostureBanner
        surface={ts("name")}
        minRole="officer"
        posture={ts("posture")}
        layerLabel={t("layerLabel")}
        roleLabel={t("roleLabels.officer")}
        accessNote={t("accessNote")}
      />
      {children}
    </>
  );
}
