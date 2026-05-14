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
    title: 'Request a Pilot | UnionEyes',
    description:
      'Start a structured pilot to validate UnionEyes for labour-safe, explainable executive intelligence.',
    alternates: buildLocaleAlternates(locale, '/pilot-request'),
  };
}

export default function PilotRequestLayout({ children }: { children: ReactNode }) {
  return children;
}
