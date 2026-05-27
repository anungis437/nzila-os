import { PaymentStatusAlert } from "@/components/payment/payment-status-alert";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/utilities/providers";
import LayoutWrapper from "@/components/layout-wrapper";
import { AuthProvider } from '@nzila/platform-auth/entra/client';
import { NzilaAppShell } from '@nzila/platform-shell';
import * as Sentry from '@sentry/nextjs';
import type { Metadata, Viewport } from "next";
import { OrganizationProvider } from "@/contexts/organization-context";
import { CookieConsentProvider } from "@/components/gdpr/cookie-consent-provider";
import { DemoModeOverlay } from "@/components/pilot/demo-mode-overlay";
import { getUnionEyesSiteTopology } from '@/lib/site-topology';
import { Poppins } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import './globals.css';

export const dynamic = 'force-dynamic'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins'
});

export const viewport: Viewport = {
  themeColor: '#1e3a5f',
};

export async function generateMetadata(): Promise<Metadata> {
  const site = getUnionEyesSiteTopology();
  const organizationalDescription =
    'UnionEyes helps unions and democratic organizations keep decisions, procedures, and organizational knowledge clear and traceable. Canadian-hosted, bilingual-first, and built for accountable operations.';
  const organizationalTitle = `UnionEyes | Organizational Governance & Continuity Infrastructure for Unions${site.titleSuffix}`;

  return {
    title: {
      default: organizationalTitle,
      template: `%s | UnionEyes${site.titleSuffix}`,
    },
    description: organizationalDescription,
    metadataBase: new URL(site.marketingUrl),
    openGraph: {
      type: 'website',
      siteName: 'UnionEyes',
      title: organizationalTitle,
      description: organizationalDescription,
      images: [
        {
          url: '/images/og-default.png',
          width: 1200,
          height: 630,
          alt: 'UnionEyes — Organizational Governance & Continuity Infrastructure for Unions',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: organizationalTitle,
      description: organizationalDescription,
      images: ['/images/og-default.png'],
    },
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      apple: '/apple-touch-icon.png',
    },
    manifest: '/manifest.json',
    // Next.js will automatically use app/icon.tsx for favicon and icon
    other: {
      ...(site.isStaging ? { 'x-robots-tag': 'noindex, nofollow' } : {}),
      ...await Sentry.getTraceData()
    }
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Note: Profile creation/claiming is now handled in protected routes
  // to avoid calling auth() in the root layout which causes middleware detection issues
  const locale = await getLocale();
  const site = getUnionEyesSiteTopology();
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'UnionEyes',
    alternateName: 'UnionEyes Organizational Continuity Infrastructure',
    url: site.marketingUrl,
    logo: `${site.marketingUrl}/icon.svg`,
    description:
      'UnionEyes helps unions and democratic organizations keep procedures, decisions, and organizational knowledge clear and traceable. Canadian-hosted and bilingual-first.',
    slogan: 'Organizational governance, continuity, and representational coordination for democratic organizations.',
    knowsAbout: [
      'organizational governance',
      'organizational continuity',
      'organizational memory preservation',
      'procedural cadence',
      'bylaw-aligned compliance',
      'representational coordination',
      'case management workflow',
      'audit-grade transparency',
      'explainable assistive intelligence',
      'Canadian sovereignty-conscious infrastructure',
    ],
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'UnionEyes',
    url: site.marketingUrl,
    inLanguage: locale,
    description:
      'UnionEyes helps unions keep procedures, decisions, and organizational knowledge clear and traceable.',
    publisher: {
      '@type': 'Organization',
      name: 'UnionEyes',
      url: site.marketingUrl,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${site.marketingUrl}/${locale}/insights?query={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'UnionEyes',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Organizational Governance & Continuity Infrastructure',
    operatingSystem: 'Web',
    url: site.marketingUrl,
    description:
      'Operational infrastructure for organizational governance, continuity, and representational coordination — explainable, auditable, Canadian-hosted, bilingual-first.',
    inLanguage: ['en-CA', 'fr-CA'],
    featureList: [
      'Procedural cadence aligned to bylaws',
      'Organizational memory preservation across leadership transitions',
      'Explainable assistive intelligence with full audit trails',
      'Anti-surveillance posture — no individual worker monitoring',
      'Canadian data residency — no cross-border egress',
      'Bilingual-by-architecture (English + French)',
    ],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'CAD',
      lowPrice: '12000',
      highPrice: '120000',
      offerCount: 4,
      url: `${site.marketingUrl}/${locale}/pricing`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'UnionEyes',
      url: site.marketingUrl,
    },
  };

  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth" data-product="union-eyes">
      <body className={poppins.className} suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        {site.isStaging ? (
          <div className="sticky top-0 z-100 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950">
            Staging environment. Pre-production data and behavior may change without notice.
          </div>
        ) : null}
        <AuthProvider>
          <NzilaAppShell moduleId="union-eyes">
            <Providers>
            <OrganizationProvider>
              <LayoutWrapper>
                <PaymentStatusAlert />
                <DemoModeOverlay />
                {children}
              </LayoutWrapper>
              <CookieConsentProvider />
              <Toaster />
            </OrganizationProvider>
            </Providers>
          </NzilaAppShell>
        </AuthProvider>
      </body>
    </html>
  );
}

