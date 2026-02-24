/**
 * Bargaining Dashboard Page
 * 
 * Main dashboard for bargaining committee members (level 40).
 * Displays all active negotiations and provides access to bargaining tools.
 */


export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { getCurrentUser } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { NegotiationDashboard } from "@/components/bargaining/NegotiationDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Bargaining Dashboard",
  description: "Manage active negotiations and bargaining activities",
};

async function BargainingDashboardContent() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  // Role check: Requires bargaining committee role (level 40)
  // This is already handled by the API but we can do client-side check too
  const organizationId = user.organizationId || '';

  return (
    <div className="container mx-auto py-8 px-4">
      <NegotiationDashboard organizationId={organizationId} />
    </div>
  );
}

export default function BargainingPage() {
  return (
    <Suspense fallback={<LoadingDashboard />}>
      <BargainingDashboardContent />
    </Suspense>
  );
}

function LoadingDashboard() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      
      <Skeleton className="h-96" />
    </div>
  );
}
