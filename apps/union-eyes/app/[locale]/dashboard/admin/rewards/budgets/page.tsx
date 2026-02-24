export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { listBudgetEnvelopes, getBudgetUsageSummary } from '@/actions/rewards-actions';
import { BudgetsList } from '@/components/rewards/admin/budgets-list';
import { CreateBudgetDialog } from '@/components/rewards/admin/create-budget-dialog';

export const metadata: Metadata = {
  title: 'Budget Management | Admin',
  description: 'Manage budget envelopes and track allocations',
};

export default async function AdminBudgetsPage() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/sign-in');
  }

  const t = await getTranslations('rewards.admin.budgets');

  // Fetch budgets and usage summary
  const budgetsResult = await listBudgetEnvelopes('');
  const usageSummaryResult = await getBudgetUsageSummary();

  const budgets = budgetsResult.success ? budgetsResult.data || [] : [];
  const usageSummary = usageSummaryResult.success ? usageSummaryResult.data || [] : [];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <Link
            href="/dashboard/admin/rewards"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← {t('backToAdmin', { defaultValue: 'Back to Admin' })}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('title', { defaultValue: 'Budget Management' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('description', {
              defaultValue: 'Allocate budgets and track spending across programs',
            })}
          </p>
        </div>
        <CreateBudgetDialog />
      </div>

      {/* Budget Usage Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {usageSummary.map((summary: any) => {
          const usagePercent = summary.amount_allocated > 0
            ? (summary.amount_used / summary.amount_allocated) * 100
            : 0;
          const remaining = summary.amount_allocated - summary.amount_used;

          return (
            <Card key={summary.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  {summary.name}
                </CardTitle>
                <CardDescription className="text-xs">
                  {summary.period_start
                    ? `${new Date(summary.period_start).toLocaleDateString()} - ${new Date(summary.period_end).toLocaleDateString()}`
                    : t('usage.ongoing', { defaultValue: 'Ongoing' })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('usage.used', { defaultValue: 'Used' })}
                    </span>
                    <span className="font-medium">
                      {summary.amount_used.toLocaleString()} / {summary.amount_allocated.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        usagePercent >= 90
                          ? 'bg-destructive'
                          : usagePercent >= 75
                          ? 'bg-yellow-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {usagePercent.toFixed(1)}% {t('usage.utilized', { defaultValue: 'utilized' })}
                    </span>
                    <span>
                      {remaining.toLocaleString()} {t('usage.remaining', { defaultValue: 'remaining' })}
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
          <CardTitle>
            {t('list.title', { defaultValue: 'All Budget Envelopes' })}
          </CardTitle>
          <CardDescription>
            {t('list.description', {
              defaultValue: 'Configure budget allocations for recognition programs',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetsList budgets={budgets} />
        </CardContent>
      </Card>
    </div>
  );
}
