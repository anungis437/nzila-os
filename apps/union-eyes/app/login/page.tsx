export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Log In | UnionEyes',
  description: 'Log in to UnionEyes — a decision system for labour leadership.',
};

export default function LoginPage() {
  return (
    <AuthPageLayout
      appName="UnionEyes"
      tagline="A Decision System for Labour Leadership"
      subtitle="From intake to outcome — casework, intelligence, and member services in one system."
    >
      <LoginForm />
    </AuthPageLayout>
  );
}
