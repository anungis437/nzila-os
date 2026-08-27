import { AuthProvider } from "@nzila/platform-auth/entra/client";
import { NzilaAppShell } from "@nzila/platform-shell";
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
  title: "CourtLens | Access-to-justice and legal matter intelligence",
  description:
    "Governed access-to-justice and legal matter-intelligence platform that converts intake into triaged, evidence-backed, human-reviewed matters and referral-ready outputs.",
  metadataBase: new URL("https://abr.nzilaventures.com"),
  openGraph: {
    title: "CourtLens | Access-to-justice and legal matter intelligence",
    description:
      "Triaged matters, evidence-backed review packets, and referral-ready outputs for legal aid, community clinics, and public-interest counsel.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <html lang="en" className={poppins.variable}>
        <body className="font-poppins antialiased">
          <NzilaAppShell moduleId="abr">{children}</NzilaAppShell>
        </body>
      </html>
    </AuthProvider>
  );
}
