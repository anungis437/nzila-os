export const dynamic = 'force-dynamic';

import { SignUp } from '@nzila/platform-auth/entra/client';
import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';

export const metadata: Metadata = {
  title: 'Sign Up | NACP Exams',
  description: 'Create your NACP Exams account — join the most secure national examination management platform.',
};

const stats = [
  { value: '500K+', label: 'Candidates' },
  { value: '1,200+', label: 'Centers' },
  { value: '99.97%', label: 'Integrity' },
];

export default function SignUpPage() {
  return (
    <AuthPageLayout
      appName="NACP Exams"
      appAbbrev="NE"
      tagline="Secure Exams, Trusted Results"
      subtitle="End-to-end examination lifecycle management — from session scheduling to result compilation — with cryptographic integrity at every step."
      stats={stats}
      heroImage="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1920&q=80"
      heroAlt="Students taking a national examination"
      isSignUp
      trustBadges={[
        { label: 'SHA-256 Verified', color: 'emerald' },
        { label: 'Audit-Grade', color: 'gold' },
        { label: 'End-to-End Encrypted', color: 'muted' },
      ]}
    >
      <SignUp
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
