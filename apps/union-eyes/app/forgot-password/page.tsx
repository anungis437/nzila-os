export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password | UnionEyes',
  description: 'Reset your UnionEyes password.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout
      appName="UnionEyes"
      tagline="A Decision System for Labour Leadership"
      subtitle="Don't worry — we'll send you a link to reset your password."
    >
      <ForgotPasswordForm />
    </AuthPageLayout>
  );
}
