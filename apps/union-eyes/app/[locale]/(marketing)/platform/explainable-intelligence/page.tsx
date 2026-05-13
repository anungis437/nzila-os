/**
 * /platform/explainable-intelligence — Wave 6 ontology collapse.
 * Canonical: /platform#trust (audit/explainability pillar).
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Redirecting | UnionEyes Platform',
    description: 'This route redirects to the canonical platform section.',
    robots: {
      index: false,
      follow: false,
    },
    alternates: buildLocaleAlternates(locale, '/platform/explainable-intelligence'),
  };
}

export default async function ExplainableIntelligenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#trust`);
}
