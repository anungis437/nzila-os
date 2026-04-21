import { AuthProvider } from "@nzila/platform-auth/entra/client";
import { NzilaAppShell } from "@nzila/platform-shell";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WeekOne | Founder Operating System",
  description:
    "The founder operating system for startups with 1–25 people. Cash runway, pipeline, priorities, and risk — all in one place.",
  metadataBase: new URL("https://weekone.nzilaventures.com"),
  openGraph: {
    title: "WeekOne | Founder Operating System",
    description:
      "Run your startup with clarity. Track cash, pipeline, and priorities — built for founders, not finance teams.",
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
      <html lang="en" suppressHydrationWarning className={inter.variable}>
        <body className="font-inter antialiased">
          <NzilaAppShell moduleId="weekone">{children}</NzilaAppShell>
        </body>
      </html>
    </AuthProvider>
  );
}
