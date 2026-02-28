import { PaymentStatusAlert } from "@/components/payment/payment-status-alert";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/utilities/providers";
import LayoutWrapper from "@/components/layout-wrapper";
import { ClerkProvider } from "@clerk/nextjs";
import * as Sentry from '@sentry/nextjs';
import type { Metadata } from "next";
import { OrganizationProvider } from "@/contexts/organization-context";
import { CookieConsentProvider } from "@/components/gdpr/cookie-consent-provider";
import { Poppins } from 'next/font/google';
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
    description: "A comprehensive platform for union claims and grievance management.",
    // Next.js will automatically use app/icon.tsx for favicon and icon
    other: {
      ...await Sentry.getTraceData()
    }
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Note: Profile creation/claiming is now handled in protected routes
  // to avoid calling auth() in the root layout which causes middleware detection issues

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.className} suppressHydrationWarning>
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/en-CA/dashboard"
          signUpFallbackRedirectUrl="/en-CA/dashboard"
        >
          <Providers
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
            <OrganizationProvider>
              <LayoutWrapper>
                <PaymentStatusAlert />
                {children}
              </LayoutWrapper>
              <CookieConsentProvider />
              <Toaster />
            </OrganizationProvider>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}

