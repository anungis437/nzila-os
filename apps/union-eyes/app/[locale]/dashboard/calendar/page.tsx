/**
 * Dashboard Calendar Page
 * Wraps the standalone calendar page within the dashboard layout shell.
 */
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import CalendarPage from '@/app/[locale]/calendar/page';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboardCalendarPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function DashboardCalendarPage() {
  return (
    <div className="h-full overflow-hidden">
      <CalendarPage />
    </div>
  );
}
