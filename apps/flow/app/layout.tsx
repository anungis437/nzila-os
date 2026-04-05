import type { Metadata } from "next";
import { AuthProvider } from "@nzila/platform-auth/entra/client";
import { Poppins } from "next/font/google";
import "./globals.css";

export const dynamic = "force-dynamic";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flow — NzilaOS Commerce",
  description:
    "Professional quoting & proposal tool with AI-powered pricing, tax compliance, and evidence-first audit trail.",
  openGraph: {
    title: "Flow — NzilaOS Commerce",
    description:
      "Professional quoting & proposal tool with AI-powered pricing, tax compliance, and evidence-first audit trail.",
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
        <body className="font-sans antialiased">{children}</body>
      </html>
    </AuthProvider>
  );
}
