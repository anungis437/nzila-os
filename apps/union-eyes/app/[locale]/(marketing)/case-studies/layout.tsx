import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: 'Case Studies | Union Eyes',
    description:
      'Real labour-organization outcomes using governance-safe intelligence, institutional memory, and operational coherence.',
    alternates: buildLocaleAlternates(locale, '/case-studies'),
  };
}

export default function CaseStudiesLayout({ children }: { children: ReactNode }) {
  return children;
}
