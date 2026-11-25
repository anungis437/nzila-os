export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { preferredLocale } from '@/lib/locales';

async function recoveryTranslations() {
  const requestHeaders = await headers();
  const locale = preferredLocale(requestHeaders.get('cookie'), requestHeaders.get('accept-language'));
  return getTranslations({ locale, namespace: 'passwordRecovery' });
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await recoveryTranslations();
  return { title: t('forgotMetaTitle'), description: t('forgotMetaDescription') };
}

export default async function ForgotPasswordPage() {
  const t = await recoveryTranslations();
  return (
    <AuthPageLayout appName={t('appName')} tagline={t('tagline')} subtitle={t('forgotSubtitle')}>
      <ForgotPasswordForm />
    </AuthPageLayout>
  );
}
