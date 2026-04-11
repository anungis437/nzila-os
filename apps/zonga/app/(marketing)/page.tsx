/**
 * Zonga — Marketing Landing Page
 * ───────────────────────────────
 * Server component that exports metadata and delegates to a client component
 * for translatable content via next-intl / NextIntlClientProvider.
 */

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { loadBrandingFlags } from '@/lib/branding/feature-flags';
import { getClientBrand, getPartnerBrand } from '@/lib/branding/brand-config';
import MarketingPageContent from '@/components/public/marketing-page-content';

export const metadata: Metadata = {
  title: 'Zonga — Music Without Borders',
  description: 'The fair-share African music platform — for artists, labels, listeners, and event organizers. Transparent royalties, instant payouts, and a vibrant music ecosystem.',
  openGraph: {
    title: 'Zonga — Music Without Borders',
    description: 'The fair-share African music platform for artists, labels, listeners, and event organizers.',
    images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'African musician performing — Zonga music platform' }],
  },
};

export default function HomePage() {
  const flags = loadBrandingFlags();
  const client = getClientBrand();
  const partner = getPartnerBrand();

  return (
    <MarketingPageContent flags={flags} client={client} partner={partner} />
  );
}