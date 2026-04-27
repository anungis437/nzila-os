import { AuthPolicyForm } from '@/components/admin/auth-policy-form';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AuthPolicyPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'authPolicyPage' });
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">{t('title')}</h1>
      <p className="text-sm text-gray-600 mb-8">
        {t('description')}
      </p>
      <AuthPolicyForm />
    </div>
  );
}
