export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import BudgetManager from '@/components/financial/BudgetManager';
import { getCurrentUser } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Budget Management | Union Eyes',
  description: 'Manage organizational budgets and financial planning',
};

export default async function BudgetsPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }

  // Check minimum role level (85 = Financial Officer)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userLevel = (user as any).roleLevel || 0;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizationId = (user as any).organizationId;

  return (
    <div className="container mx-auto py-10">
      <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
        <BudgetManager organizationId={organizationId} />
      </Suspense>
    </div>
  );
}
