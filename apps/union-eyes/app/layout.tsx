import { PaymentStatusAlert } from "@/components/payment/payment-status-alert";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/utilities/providers";
import LayoutWrapper from "@/components/layout-wrapper";
import { AuthProvider } from '@nzila/platform-auth/entra/client';
import { NzilaAppShell } from '@nzila/platform-shell';
import * as Sentry from '@sentry/nextjs';
import type { Metadata } from "next";
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

export async function generateMetadata(): Promise<Metadata> {
  const site = getUnionEyesSiteTopology();

  return {
    title: {
      default: `Union Eyes | Modern Operating System for Unions${site.titleSuffix}`,
      template: `%s | Union Eyes${site.titleSuffix}`,
    },
    description:
      'Grievances, governance, member communications, elections, intelligence, and defensible operations for modern unions.',
    metadataBase: new URL(site.marketingUrl),
    openGraph: {
      type: 'website',
      siteName: 'Union Eyes',
      title: `Union Eyes | Modern Operating System for Unions${site.titleSuffix}`,
      description:
        'Grievances, governance, member communications, elections, intelligence, and defensible operations for modern unions.',
      images: [
        {
          url: '/images/og-default.png',
          width: 1200,
          height: 630,
          alt: 'Union Eyes — Modern Operating System for Unions',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Union Eyes | Modern Operating System for Unions${site.titleSuffix}`,
      description:
        'Grievances, governance, member communications, elections, intelligence, and defensible operations for modern unions.',
      images: ['/images/og-default.png'],
    },
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      apple: '/apple-touch-icon.png',
    },
    manifest: '/manifest.json',
    themeColor: '#1e3a5f',
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

  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={poppins.className} suppressHydrationWarning>
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

