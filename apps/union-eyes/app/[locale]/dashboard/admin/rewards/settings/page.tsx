export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Edit } from 'lucide-react';
import { listRecognitionPrograms } from '@/actions/rewards-actions';
import { CreateProgramDialog } from '@/components/rewards/admin/create-program-dialog';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Program Settings | Rewards Admin',
  description: 'Configure recognition programs and system settings',
};

export default async function RewardsSettingsPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  // Check admin role
  const member = await db.query.organizationMembers.findFirst({
    where: (members, { eq, and }) =>
      and(eq(members.userId, userId), eq(members.organizationId, orgId)),
  });

  if (!member || !['admin', 'owner'].includes(member.role)) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin.settings');

  const programsResult = await listRecognitionPrograms();
  const programs = programsResult.success ? programsResult.data : [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('description')}</p>
        </div>
      </div>

      {/* Programs Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('programs.title')}</CardTitle>
              <CardDescription>{t('programs.description')}</CardDescription>
            </div>
            <CreateProgramDialog />
          </div>
        </CardHeader>
        <CardContent>
          {!programs || programs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('programs.empty')}
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {programs.map((program: any) => (
                <div
                  key={program.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{program.name}</h3>
                      <Badge
                        variant={
                          program.status === 'active'
                            ? 'default'
                            : program.status === 'draft'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {program.status}
                      </Badge>
                    </div>
                    {program.description && (
                      <p className="text-sm text-muted-foreground">{program.description}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <Link
                        href={`/dashboard/admin/rewards/awards?program=${program.id}`}
                        className="hover:text-foreground"
                      >
                        View Awards
                      </Link>
                      <Link
                        href={`/dashboard/admin/rewards/budgets?program=${program.id}`}
                        className="hover:text-foreground"
                      >
                        Manage Budgets
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('system.title')}</CardTitle>
          <CardDescription>{t('system.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Credit Expiration */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">{t('system.creditExpiration.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('system.creditExpiration.description')}
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>

          {/* Approval Workflow */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">{t('system.approvalWorkflow.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('system.approvalWorkflow.description')}
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">{t('system.notifications.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('system.notifications.description')}
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>

          {/* Automated Awards */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">{t('system.automatedAwards.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('system.automatedAwards.description')}
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>

          {/* Shopify Integration */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">{t('system.shopify.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('system.shopify.description')}
              </p>
            </div>
            <Link href="/dashboard/admin/rewards/shopify">
              <Button variant="outline" size="sm">
                Manage
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">{t('dangerZone.title')}</CardTitle>
          <CardDescription>{t('dangerZone.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
            <div>
              <h3 className="font-semibold">{t('dangerZone.reset.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('dangerZone.reset.description')}
              </p>
            </div>
            <Button variant="destructive" size="sm">
              {t('dangerZone.reset.action')}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
            <div>
              <h3 className="font-semibold">{t('dangerZone.archive.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('dangerZone.archive.description')}
              </p>
            </div>
            <Button variant="outline" size="sm" className="border-red-200 text-red-600">
              {t('dangerZone.archive.action')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
