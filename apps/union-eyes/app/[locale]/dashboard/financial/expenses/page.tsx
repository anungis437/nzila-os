export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import ExpenseApprovalQueue from '@/components/financial/ExpenseApprovalQueue';
import ExpenseRequestForm from '@/components/financial/ExpenseRequestForm';
import { requireUser, hasMinRole, ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata = {
  title: 'Expense Management | UnionEyes',
  description: 'Submit and approve expense requests',
};

export default async function ExpensesPage() {
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
          <TabsTrigger value="submit">Submit Expense</TabsTrigger>
          <TabsTrigger value="my-expenses">My Expenses</TabsTrigger>
          {userLevel >= 85 && (
            <TabsTrigger value="approvals">Pending Approvals</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="submit">
          <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
            <ExpenseRequestForm />
          </Suspense>
        </TabsContent>

        <TabsContent value="my-expenses">
          <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
            <div className="text-center py-10 text-muted-foreground">
              My Expenses list will be displayed here
            </div>
          </Suspense>
        </TabsContent>

        {userLevel >= 85 && (
          <TabsContent value="approvals">
            <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
              <ExpenseApprovalQueue organizationId={organizationId} />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
