/**
 * /platform/organizational-memory — Wave 6 ontology collapse.
 * Canonical: /platform#institutional-memory (eight-pillar overview).
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
    alternates: buildLocaleAlternates(locale, '/platform/organizational-memory'),
  };
}

export default async function OrganizationalMemoryRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#institutional-memory`);
}
