import type { Metadata } from "next";
import { AuthProvider } from "@nzila/platform-auth/entra/client";
import { NzilaAppShell } from "@nzila/platform-shell";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Nzila OS — Control Plane",
  description:
    "Executive visibility into platform health, governance, intelligence, anomalies, and procurement readiness.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <AuthProvider>
      <html lang={locale} suppressHydrationWarning>
        <body className={poppins.className} suppressHydrationWarning>
          <NzilaAppShell moduleId="control-plane">
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              disableTransitionOnChange
            >
              <NextIntlClientProvider locale={locale} messages={messages}>
                {children}
              </NextIntlClientProvider>
            </ThemeProvider>
          </NzilaAppShell>
        </body>
      </html>
    </AuthProvider>
  );
}
