export const dynamic = 'force-dynamic';

import { SignUp } from '@nzila/platform-auth/entra/client';
import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';

export const metadata: Metadata = {
  title: 'Sign Up | Zonga',
  description: 'Create your Zonga account — join the fair-share music platform for African creators.',
};

const stats = [
  { value: '50K+', label: 'Creators' },
  { value: '2M+', label: 'Tracks' },
  { value: '85%', label: 'Revenue Share' },
];

export default function SignUpPage() {
  return (
    <AuthPageLayout
      appName="Zonga"
      appAbbrev="Z"
      tagline="Your Music, Your Revenue"
      subtitle="The fair-share music platform — transparent royalties, instant payouts, and full creative ownership for African artists and creators."
      stats={stats}
      heroImage="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&q=80"
      heroAlt="African musician performing — representing the creative spirit Zonga empowers"
      isSignUp
      trustBadges={[
        { label: '85% Revenue Share', color: 'emerald' },
        { label: 'Instant Payouts', color: 'gold' },
        { label: 'Own Your Masters', color: 'muted' },
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
