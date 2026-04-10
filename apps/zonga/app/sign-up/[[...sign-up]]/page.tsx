export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { SignupForm } from '@/components/auth/signup-form';

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
      <SignupForm />
    </AuthPageLayout>
  );
}
