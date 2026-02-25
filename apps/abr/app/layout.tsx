import { ClerkProvider } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ABR Insights | AI-Powered Legal Intelligence",
  description:
    "Advanced legal research and case analysis platform powered by AI. Analyze case law, track precedents, and generate compliance reports.",
  metadataBase: new URL("https://abr.nzilaventures.com"),
  openGraph: {
    title: "ABR Insights | AI-Powered Legal Intelligence",
    description:
      "Analyze case law, track precedents, and generate compliance reports with unmatched accuracy.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/en-CA/dashboard"
      signUpFallbackRedirectUrl="/en-CA/dashboard"
    >
      <html lang="en" className={poppins.variable}>
        <body className="font-poppins antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
