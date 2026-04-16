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
  return {
    title: "Union Claims Platform",
    description: "A comprehensive platform for union case management and tracking.",
    // Next.js will automatically use app/icon.tsx for favicon and icon
    other: {
      ...await Sentry.getTraceData()
    }
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Note: Profile creation/claiming is now handled in protected routes
  // to avoid calling auth() in the root layout which causes middleware detection issues
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={poppins.className} suppressHydrationWarning>
        <AuthProvider>
          <NzilaAppShell moduleId="union-eyes">
            <Providers
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
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

