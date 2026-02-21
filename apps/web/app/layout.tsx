import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
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
    default: "Nzila Ventures | The APEX of AI in Social Impact",
    template: "%s | Nzila Ventures",
  },
  description: "Venture studio building 15 AI-powered platforms across 10+ verticals — healthcare, finance, agriculture, labor rights, and justice. $100B+ Total Addressable Market.",
  keywords: ["AI", "venture studio", "social impact", "fintech", "healthtech", "agrotech", "legaltech", "edtech", "ethical AI", "machine learning", "Nzila Ventures"],
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
    title: "Nzila Ventures | The APEX of AI in Social Impact",
    description: "15 AI-powered platforms across 10+ verticals. One unified Backbone. Series A ready.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop&q=80",
        width: 1200,
        height: 630,
        alt: "Earth at night showing illuminated cities and global connectivity — representing Nzila Ventures AI infrastructure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nzila Ventures | The APEX of AI in Social Impact",
    description: "15 AI-powered platforms across 10+ verticals. One unified Backbone.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <JsonLd />
        </head>
        <body className={`${poppins.className} custom-scrollbar`}>
          <Navigation />
          <PageTransition>
            {children}
          </PageTransition>
          <Footer />
          <BackToTop />
        </body>
      </html>
    </ClerkProvider>
  );
}
