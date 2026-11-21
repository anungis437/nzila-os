export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserRoleInOrganization } from '@/lib/organization-utils';

export const metadata: Metadata = {
  title: 'CLC Staff Dashboard | UnionEyes',
  description: 'CLC staff release scope',
};

async function checkCLCStaffAccess(userId: string, orgId: string): Promise<boolean> {
  try {
    const userRole = await getUserRoleInOrganization(userId, orgId);
    return ['clc_staff', 'clc_executive', 'system_admin'].includes(userRole || '');
  } catch {
    return false;
  }
}

export default async function CLCStaffDashboardPage() {
  const user = await requireUser();
  const hasAccess = await checkCLCStaffAccess(user.userId, user.organizationId!);
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('clc.staff');
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">
        {t('dashboard.title', { defaultValue: 'CLC Staff Dashboard' })}
      </h1>
      <Card role="status">
        <CardHeader>
          <CardTitle>{t('releaseScope.title', { defaultValue: 'Release scope' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            {t('releaseScope.description', {
              defaultValue: 'CLC remittances and national sync reporting are not included in this release.',
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
