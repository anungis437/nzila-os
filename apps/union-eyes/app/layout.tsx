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
    'Institutional governance and continuity infrastructure for unions and democratic organizations — bylaw-aligned procedural cadence, institutional memory preservation, representational coordination, and audit-grade transparency. Canadian-hosted, bilingual-first, sovereignty-conscious.';
  const institutionalTitle = `UnionEyes | Institutional Governance & Continuity Infrastructure for Unions${site.titleSuffix}`;

  return {
    title: {
      default: institutionalTitle,
      template: `%s | UnionEyes${site.titleSuffix}`,
    },
    description: organizationalDescription,
    metadataBase: new URL(site.marketingUrl),
    openGraph: {
      type: 'website',
      siteName: 'UnionEyes',
      title: institutionalTitle,
      description: organizationalDescription,
      images: [
        {
          url: '/images/og-default.png',
          width: 1200,
          height: 630,
          alt: 'UnionEyes — Institutional Governance & Continuity Infrastructure for Unions',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: institutionalTitle,
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
    alternateName: 'UnionEyes Institutional Continuity Infrastructure',
    url: site.marketingUrl,
    logo: `${site.marketingUrl}/icon.svg`,
    description:
      'Institutional governance and continuity infrastructure for unions and democratic organizations — procedural coordination, institutional memory preservation, representational workflow, and audit-grade transparency. Canadian-hosted, bilingual-first.',
    slogan: 'Institutional governance, continuity, and representational coordination for democratic organizations.',
    knowsAbout: [
      'institutional governance',
      'institutional continuity',
      'institutional memory preservation',
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
      'Institutional governance and continuity infrastructure for unions — procedural coordination, institutional memory, and audit-grade transparency.',
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

