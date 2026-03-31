import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Poppins } from 'next/font/google';
import './globals.css';

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={poppins.className} suppressHydrationWarning>
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/en-CA/dashboard"
          signUpFallbackRedirectUrl="/en-CA/dashboard"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
