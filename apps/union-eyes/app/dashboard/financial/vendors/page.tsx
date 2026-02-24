export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import VendorList from '@/components/financial/VendorList';
import { getCurrentUser } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Vendor Management | Union Eyes',
  description: 'Manage vendor and supplier information',
};

export default async function VendorsPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }

  // Check minimum role level (85 = Financial Officer)
  const userLevel = (user as unknown as Record<string, unknown>).roleLevel as number || 0;
  if (userLevel < 85) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You need Financial Officer permissions (level 85+) to access vendor management.
          </p>
        </div>
      </div>
    );
  }

  const organizationId = (user as unknown as Record<string, unknown>).organizationId as string;

  return (
    <div className="container mx-auto py-10">
      <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
        <VendorList organizationId={organizationId} />
      </Suspense>
    </div>
  );
}
