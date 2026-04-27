export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SmsConsole } from '@/components/communications/sms-console';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'smsPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function SmsPage() {
  return <SmsConsole />;
}

