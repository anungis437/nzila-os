export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password | Zonga',
  description: 'Set a new password for your Zonga account.',
};

const stats = [
  { value: '50K+', label: 'Creators' },
  { value: '2M+', label: 'Tracks' },
  { value: '85%', label: 'Revenue Share' },
];

export default function ResetPasswordPage() {
  return (
    <AuthPageLayout
      appName="Zonga"
      appAbbrev="Z"
      tagline="Your Music, Your Revenue"
      subtitle="Choose a new password for your account."
      stats={stats}
      heroImage="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&q=80"
      heroAlt="African musician performing — representing the creative spirit Zonga empowers"
      trustBadges={[
        { label: '85% Revenue Share', color: 'emerald' },
        { label: 'Instant Payouts', color: 'gold' },
        { label: 'Own Your Masters', color: 'muted' },
      ]}
    >
      <ResetPasswordForm />
    </AuthPageLayout>
  );
}
