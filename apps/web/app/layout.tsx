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

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nzilaventures.com"),
  title: {
    default: "Nzila Ventures | Human-Centered Institutional Software",
    template: "%s | Nzila Ventures",
  },
  description: "Nzila Ventures develops human-centered software that preserves institutional knowledge and keeps decisions accountable. Explore Union Eyes, CIVIC and Nzila OS.",
  keywords: ["organizational continuity", "operational memory", "governance infrastructure", "trust infrastructure", "Union Eyes", "Nzila OS", "auditability", "data sovereignty", "explainable AI", "Nzila Ventures"],
  authors: [{ name: "Nzila Ventures" }],
  creator: "Nzila Ventures",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: "Nzila Ventures",
    title: "Nzila Ventures | Human-Centered Institutional Software",
    description: "Software for institutional continuity and accountable operations. Explore Union Eyes, CIVIC and the wider Nzila Ventures portfolio.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Nzila Ventures — Build continuity. Preserve accountability.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nzila Ventures | Human-Centered Institutional Software",
    description: "Explore governed software for institutional continuity: Union Eyes, CIVIC, and Nzila OS.",
    images: ["/opengraph-image"],
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
      <html lang={locale} data-scroll-behavior="smooth">
        <head>
          <JsonLd />
        </head>
        <body className={poppins.className}>
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
