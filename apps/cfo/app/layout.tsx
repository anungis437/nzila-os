import { AuthProvider } from "@nzila/platform-auth/entra/client";
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
  title: "LedgerIQ | AI-Powered Virtual CFO Platform",
  description:
    "Enterprise virtual CFO platform for advisory firms. AI-driven financial analysis, automated compliance, and real-time client insights.",
  metadataBase: new URL("https://cfo.nzilaventures.com"),
  openGraph: {
    title: "LedgerIQ | AI-Powered Virtual CFO Platform",
    description:
      "Empower your advisory firm with AI-driven financial analysis, automated compliance, and real-time client insights.",
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
      <html lang="en-CA" suppressHydrationWarning className={poppins.variable}>
        <body className="font-poppins antialiased">{children}</body>
      </html>
    </AuthProvider>
  );
}
