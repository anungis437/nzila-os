export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password | Union Eyes',
  description: 'Reset your Union Eyes password.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout
      appName="Union Eyes"
      tagline="A Decision System for Labour Leadership"
      subtitle="Don't worry — we'll send you a link to reset your password."
    >
      <ForgotPasswordForm />
    </AuthPageLayout>
  );
}
