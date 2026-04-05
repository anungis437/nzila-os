import { AuthProvider } from "@nzila/platform-auth/entra/client";
import type { Metadata } from "next";
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: "NACP Exams — National Examination Management",
  description: "Secure, auditable national examination management. Session scheduling, candidate tracking, integrity verification, and result compilation — powered by Nzila.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.className} suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
