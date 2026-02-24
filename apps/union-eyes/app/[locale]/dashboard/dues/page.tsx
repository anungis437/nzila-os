export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import DuesPaymentPortal from '@/components/dues/dues-payment-portal';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'My Dues | UnionEyes',
  description: 'View and pay your union dues',
};

export default async function DuesPortalPage() {
  const { userId } = await auth();
  
  if (!userId) {
    return <div>Please sign in to view your dues</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Dues</h1>
        <p className="text-muted-foreground mt-2">
          View your dues balance, payment history, and make payments
        </p>
      </div>

      <Suspense fallback={<DuesSkeleton />}>
        <DuesPaymentPortal userId={userId} />
      </Suspense>
    </div>
  );
}

function DuesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
