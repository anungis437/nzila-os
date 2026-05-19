import type { Metadata } from "next";
import { AuthProvider } from "@nzila/platform-auth/entra/client";
import { Poppins } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import "./globals.css";
import Navigation from "@/components/public/Navigation";
import Footer from "@/components/public/Footer";
import BackToTop from "@/components/public/BackToTop";
import PageTransition from "@/components/public/PageTransition";
import JsonLd from "@/components/public/JsonLd";
import { MARKETING_FACTS, governedCoverageLabel, platformCoverageLabel } from "@/lib/marketing-facts";

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nzilaventures.com"),
  title: {
    default: "Nzila Ventures | Institutional Continuity Infrastructure",
    template: "%s | Nzila Ventures",
  },
  description: `Nzila Ventures builds ${platformCoverageLabel()}, ${governedCoverageLabel()}, and Nzila OS for organizations where governance, continuity, evidence, and trust matter.`,
  keywords: ["institutional continuity", "operational memory", "governance infrastructure", "trust infrastructure", "Union Eyes", "Nzila OS", "auditability", "data sovereignty", "explainable AI", "Nzila Ventures"],
  authors: [{ name: "Nzila Ventures" }],
  creator: "Nzila Ventures",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Nzila Ventures",
    title: "Nzila Ventures | Institutional Continuity Infrastructure",
    description: `Continuity infrastructure for trust-sensitive institutions, delivered through Nzila OS, Union Eyes, and ${MARKETING_FACTS.governedApplications} governed operational applications.`,
    images: [
      {
        url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop&q=80",
        width: 1200,
        height: 630,
        alt: "Earth at night showing illuminated cities and global connectivity - representing Nzila Ventures continuity infrastructure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nzila Ventures | Institutional Continuity Infrastructure",
    description: "Nzila builds governed operational infrastructure that preserves continuity, operational memory, evidence, and institutional trust.",
    images: ["https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop&q=80"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <AuthProvider>
      <html lang={locale}>
        <head>
          <JsonLd />
        </head>
        <body className={`${poppins.className} custom-scrollbar`}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-navy"
            >
              Skip to main content
            </a>
            <Navigation />
            <PageTransition>
              <div id="main-content">
                {children}
              </div>
            </PageTransition>
            <Footer />
            <BackToTop />
          </NextIntlClientProvider>
        </body>
      </html>
    </AuthProvider>
  );
}
