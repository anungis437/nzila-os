export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { hasMinRole } from '@/lib/api-auth-guard';
import { requireOrganizationScope } from '@/lib/page-data/organization-scope';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { listRecognitionPrograms } from '@/actions/rewards-actions';
import { loadBudgetEnvelopes } from '@/lib/rewards/admin-reads';
import { BudgetsList } from '@/components/rewards/admin/budgets-list';
import { CreateBudgetDialog } from '@/components/rewards/admin/create-budget-dialog';

export const metadata: Metadata = {
  title: 'Budget Management | Admin',
  description: 'Manage budget envelopes and track allocations',
};

export default async function AdminBudgetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { organizationId } = await requireOrganizationScope();
  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const t = await getTranslations('rewards.admin.budgets');
  const format = await getFormatter();

  // A failed read is an error, not an empty list of budgets: nothing here catches it.
  const budgets = await loadBudgetEnvelopes(organizationId);
  const programsResult = await listRecognitionPrograms();
  if (!programsResult.success) {
    throw new Error(('error' in programsResult && programsResult.error) || 'The recognition programs could not be loaded');
  }
  const programs = (programsResult.data ?? [])
    .filter((program) => program.status !== 'archived')
    .map((program) => ({ id: program.id, name: program.name }));

  const running = budgets.filter((budget) => budget.isActive);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <Link
            href={`/${locale}/dashboard/admin/rewards`}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← {t('backToAdmin')}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{t('description')}</p>
        </div>
        <CreateBudgetDialog programs={programs} />
      </div>

      {/* Budgets running now */}
      <div className="grid gap-4 md:grid-cols-3">
        {running.map((budget) => {
          const usagePercent = budget.limit > 0 ? (budget.used / budget.limit) * 100 : 0;
          const remaining = budget.limit - budget.used;

          return (
            <Card key={budget.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">{budget.name}</CardTitle>
                <CardDescription className="text-xs">
                  {format.dateTime(new Date(budget.startsAt), { dateStyle: 'medium', timeZone: 'UTC' })} –{' '}
                  {format.dateTime(new Date(budget.endsAt), { dateStyle: 'medium', timeZone: 'UTC' })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('usage.used')}</span>
                    <span className="font-medium">
                      {format.number(budget.used)} / {format.number(budget.limit)}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        usagePercent >= 90 ? 'bg-destructive' : usagePercent >= 75 ? 'bg-yellow-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {format.number(usagePercent / 100, { style: 'percent', maximumFractionDigits: 1 })} {t('usage.utilized')}
                    </span>
                    <span>
                      {format.number(remaining)} {t('usage.remaining')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Budgets List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('list.title')}</CardTitle>
          <CardDescription>{t('list.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetsList budgets={budgets} />
        </CardContent>
      </Card>
    </div>
  );
}
