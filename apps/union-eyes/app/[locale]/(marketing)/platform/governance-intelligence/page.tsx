/**
 * /platform/governance-intelligence — Wave 6 ontology collapse.
 * Canonical: /platform#governance (eight-pillar overview).
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Redirecting | Union Eyes Platform',
    description: 'This route redirects to the canonical platform section.',
    robots: {
      index: false,
      follow: false,
    },
    alternates: buildLocaleAlternates(locale, '/platform/governance-intelligence'),
  };
}

export default async function GovernanceIntelligenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#governance`);
}
