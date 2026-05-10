/**
 * /platform/operational-coherence — Wave 6 ontology collapse.
 * Canonical: /platform#priorities (operational cadence pillar).
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
    alternates: buildLocaleAlternates(locale, '/platform/operational-coherence'),
  };
}

export default async function OperationalCoherenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#priorities`);
}
