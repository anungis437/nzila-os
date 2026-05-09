import { notFound, redirect } from 'next/navigation';
import { locales } from '@/i18n/config';

type MarketingCatchAllPageProps = {
  params: Promise<{ slug: string[] }>;
};

export const dynamic = 'force-dynamic';

export default async function MarketingCatchAllPage({ params }: MarketingCatchAllPageProps) {
  const { slug } = await params;

  // Avoid recursive locale-prefix redirects for already-localized unknown paths,
  // e.g. /en-CA/dashboard/workflow-builder.
  if (slug.length > 0 && locales.includes(slug[0] as (typeof locales)[number])) {
    notFound();
  }

  redirect(`/en-CA/${slug.join('/')}`);
}