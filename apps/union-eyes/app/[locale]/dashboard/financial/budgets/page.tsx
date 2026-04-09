export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import BudgetManager from '@/components/financial/BudgetManager';
import { requireUser, hasMinRole, ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Budget Management | Union Eyes',
  description: 'Manage organizational budgets and financial planning',
};

export default async function BudgetsPage() {
  const user = await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  // Check minimum role level (85 = Financial Officer)
  const userLevel = Math.max(0, ...user.roles.map(r => ROLE_HIERARCHY[r as keyof typeof ROLE_HIERARCHY] ?? 0));
  if (userLevel < 85) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You need Financial Officer permissions (level 85+) to access budget management.
          </p>
        </div>
      </div>
    );
  }

  const organizationId = user.organizationId;

  return (
    <div className="container mx-auto py-10">
      <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
        <BudgetManager organizationId={organizationId} />
      </Suspense>
    </div>
  );
}
