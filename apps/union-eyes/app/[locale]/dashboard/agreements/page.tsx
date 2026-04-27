/**
 * /dashboard/agreements — Collective agreements page
 * Server component with auth guard, delegates to client component
 */
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/api-auth-guard";
import { getTranslations } from "next-intl/server";
import AgreementsPage from "./agreements-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agreementsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AgreementsServerPage() {
  const user = await requireUser();
  if (!user) redirect("/sign-in");

  return <AgreementsPage />;
}
