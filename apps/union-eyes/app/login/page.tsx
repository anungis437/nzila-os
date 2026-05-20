export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { LoginForm } from '@/components/auth/login-form';
import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience';

export const metadata: Metadata = {
  title: 'Log In | UnionEyes',
  description: 'Log in to UnionEyes — a decision system for labour leadership.',
};

const stats = [
  { value: '200+', label: 'Locals' },
  { value: '50K+', label: 'Members' },
  { value: '99.9%', label: 'Uptime' },
];

export default function LoginPage() {
  const postLoginPath = isCupe4373DemoRuntime() ? '/en-CA/dashboard' : undefined;

  return (
    <AuthPageLayout
      appName="UnionEyes"
      tagline="A Decision System for Labour Leadership"
      subtitle="From intake to outcome — casework, intelligence, and member services in one system."
      stats={stats}
    >
      <LoginForm postLoginPath={postLoginPath} />
    </AuthPageLayout>
  );
}
