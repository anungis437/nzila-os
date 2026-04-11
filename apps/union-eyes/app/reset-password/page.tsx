export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password | UnionEyes',
  description: 'Set a new password for your UnionEyes account.',
};

export default function ResetPasswordPage() {
  return (
    <AuthPageLayout
      appName="UnionEyes"
      tagline="A Decision System for Labour Leadership"
      subtitle="Choose a new password for your account."
    >
      <ResetPasswordForm />
    </AuthPageLayout>
  );
}
