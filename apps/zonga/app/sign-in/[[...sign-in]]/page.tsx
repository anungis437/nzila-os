export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import SignInPageContent from '@/components/auth/sign-in-page-content';

export const metadata: Metadata = {
  title: 'Sign In | Zonga',
  description: 'Sign in to your Zonga account — the fair-share music platform for African creators.',
};

export default function SignInPage() {
  return <SignInPageContent />;
}
