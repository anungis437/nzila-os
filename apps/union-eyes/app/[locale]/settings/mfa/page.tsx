import { MfaSettings } from '@/components/auth/mfa-settings';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function MfaSettingsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'mfaPage' });
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">{t('title')}</h1>
      <p className="text-sm text-gray-600 mb-8">
        {t('description')}
      </p>
      <MfaSettings />
    </div>
  );
}
