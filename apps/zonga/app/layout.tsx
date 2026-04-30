import { AuthProvider } from "@nzila/platform-auth/entra/client";
import { NzilaAppShell } from "@nzila/platform-shell";
import type { Metadata } from "next";
import { Poppins } from 'next/font/google';
import { initializeBrands } from '@/lib/branding/brand-config';
import { ServiceWorkerRegister } from './sw-register';
import './globals.css';

// Register deployment brands (idempotent — safe across concurrent requests)
initializeBrands();

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: "Zonga — Music Without Borders",
  description: "The fair-share music platform — transparent royalties, instant payouts, and full creative ownership for African artists and creators. Powered by Nzila.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark theme-dark" suppressHydrationWarning data-product="zonga">
      <body className={poppins.className} suppressHydrationWarning>
        <AuthProvider>
          <ServiceWorkerRegister />
          <NzilaAppShell moduleId="zonga">
            {children}
          </NzilaAppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
