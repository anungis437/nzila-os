export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PrioritiesConsole } from '@/components/priorities/priorities-console';
import { requireUser } from '@/lib/api-auth-guard';
import { getUserRole } from '@/lib/auth/rbac-server';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'prioritiesPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function PrioritiesPage() {
  const user = await requireUser();
  const role = await getUserRole(user.userId, user.organizationId);
  // Auth enforced by dashboard layout; PrioritiesConsole's API calls also gate access.
  return (
    <Suspense fallback={null}>
      <PrioritiesConsole role={role} />
    </Suspense>
  );
}
