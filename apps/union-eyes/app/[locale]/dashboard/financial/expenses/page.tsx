export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ExpenseApprovalQueue from '@/components/financial/ExpenseApprovalQueue';
import ExpenseRequestForm from '@/components/financial/ExpenseRequestForm';
import { requireUser, hasMinRole, ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'expensesPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function ExpensesPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'expensesPage' });
  const user = await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  const organizationId = user.organizationId;
  const userLevel = Math.max(0, ...user.roles.map(r => ROLE_HIERARCHY[r as keyof typeof ROLE_HIERARCHY] ?? 0));

  return (
    <div className="container mx-auto py-10">
      <Tabs defaultValue="submit" className="space-y-6">
        <TabsList>
          <TabsTrigger value="submit">{t('tabs.submit')}</TabsTrigger>
          <TabsTrigger value="my-expenses">{t('tabs.myExpenses')}</TabsTrigger>
          {userLevel >= 85 && (
            <TabsTrigger value="approvals">{t('tabs.pendingApprovals')}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="submit">
          <Suspense fallback={<div className="text-center py-10">{t('loading')}</div>}>
            <ExpenseRequestForm />
          </Suspense>
        </TabsContent>

        <TabsContent value="my-expenses">
          <Suspense fallback={<div className="text-center py-10">{t('loading')}</div>}>
            <div className="text-center py-10 text-muted-foreground">
              {t('myExpensesPlaceholder')}
            </div>
          </Suspense>
        </TabsContent>

        {userLevel >= 85 && (
          <TabsContent value="approvals">
            <Suspense fallback={<div className="text-center py-10">{t('loading')}</div>}>
              <ExpenseApprovalQueue organizationId={organizationId} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
