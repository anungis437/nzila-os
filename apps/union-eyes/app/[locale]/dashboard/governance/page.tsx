import { PageHeading } from '@/components/dashboard/page-heading';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from "next";
import Link from 'next/link';
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Governance Continuity | UnionEyes",
  description: "Governance continuity workspace for stewardship, oversight, and review workflows.",
};

export default async function GovernanceOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  // Governance surfaces require officer-level access (level 60+).
  // Officer is the minimum governance experience role.
  const hasAccess = await hasMinRole("officer");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  const { locale } = await params;
  const french = (await getLocale()) === 'fr-CA';
  const t = await getTranslations({ locale, namespace: 'reviewIntake' });
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeading
        eyebrow={french ? 'Gouvernance' : 'Governance'}
        title={french ? 'Aperçu de la continuité de la gouvernance' : 'Governance Continuity Overview'}
        description={french
          ? 'Aperçu des domaines de surveillance, de continuité des politiques et de revue. Cette page est une introduction; elle ne présente pas de résultats opérationnels.'
          : 'An overview of oversight, policy continuity and review areas. This page is an introduction; it does not present operational results.'} />
      <p>
        <Link href={`/${locale}/dashboard/governance/reviews`} className="text-sm font-medium underline">
          {t('openOversight')}
        </Link>
      </p>
    </div>
  );
}
