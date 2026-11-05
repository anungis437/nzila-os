export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata: Metadata = {
  title: 'Sign Up | UnionEyes',
  description: 'Create your UnionEyes account — a decision system for labour leadership.',
};

export default function SignupPage() {
  return (
    <AuthPageLayout
      appName="UnionEyes"
      tagline="A Decision System for Labour Leadership"
      subtitle="From intake to outcome — casework, intelligence, and member services in one system."
      isSignUp
    >
      <SignupForm />
    </AuthPageLayout>
  );
}
