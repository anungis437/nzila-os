export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password | Union Eyes',
  description: 'Set a new password for your Union Eyes account.',
};

export default function ResetPasswordPage() {
  return (
    <AuthPageLayout
      appName="Union Eyes"
      tagline="A Decision System for Labour Leadership"
      subtitle="Choose a new password for your account."
    >
      <ResetPasswordForm />
    </AuthPageLayout>
  );
}
