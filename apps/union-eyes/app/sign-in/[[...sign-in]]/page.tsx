export const dynamic = 'force-dynamic';

import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';

export const metadata: Metadata = {
  title: 'Sign In | Union Eyes',
  description: 'Sign in to your Union Eyes account — AI-powered union management, grievance tracking, and member engagement.',
};

const stats = [
  { value: '4,773', label: 'Union Entities' },
  { value: '56%', label: 'Time Saved' },
  { value: '99.9%', label: 'Uptime' },
];

export default function SignInPage() {
  return (
    <AuthPageLayout
      appName="Union Eyes"
      tagline="Empowering Unions with Intelligent Tools"
      subtitle="AI-powered grievance management, claims processing, and member engagement — built with unions, not for unions."
      stats={stats}
      heroImage="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920&q=80"
      heroAlt="Workers gathered in a professional labor meeting — representing organized solidarity"
    >
      <SignIn
        forceRedirectUrl="/en-CA/dashboard"
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none border-0 w-full',
            headerTitle: 'text-2xl font-bold text-navy',
            headerSubtitle: 'text-gray-500',
            socialButtonsBlockButton: 'border border-gray-200 hover:bg-gray-50 transition-colors rounded-xl',
            formFieldInput: 'rounded-xl border-gray-200 focus:border-electric focus:ring-electric/20',
            formButtonPrimary: 'bg-electric hover:bg-blue-700 rounded-xl shadow-lg shadow-electric/25 transition-all',
            footerActionLink: 'text-electric hover:text-blue-700',
            dividerLine: 'bg-gray-200',
            dividerText: 'text-gray-400',
          },
        }}
      />
    </AuthPageLayout>
  );
}
