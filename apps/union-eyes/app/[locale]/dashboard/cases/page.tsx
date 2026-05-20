export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { CasesConsole } from '@/components/cases/cases-console';
import { Cupe4373CasesConsole } from '@/components/demo/cupe4373-cases-console';
import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience';
import { getDemoCasesFromDb } from '@/lib/demo/server/cupe4373-cases-repo';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'casesPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function CasesPage() {
  try {
    await requireUser();
  } catch {
    redirect('/login');
  }

  const hasAccess = !isCupe4373DemoRuntime() ? await hasMinRole('steward') : true;
  if (!hasAccess) {
    redirect('/dashboard');
  }

  if (isCupe4373DemoRuntime()) {
    const cases = await getDemoCasesFromDb();
    const usingDb =
      process.env.UE_DEMO_DATA_SOURCE === 'db' ||
      (process.env.DATABASE_URL?.includes('demo-db') ?? false);
    return <Cupe4373CasesConsole cases={cases} dataSource={usingDb ? 'db' : 'static'} />;
  }

  return <CasesConsole />;
}
