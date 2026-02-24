export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { Suspense } from "react";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { NegotiationDashboard } from "@/components/bargaining/NegotiationDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Bargaining Dashboard | UnionEyes",
  description: "Manage active negotiations and bargaining activities",
};

async function BargainingDashboardContent() {
  const user = await requireUser();
  
  // Require bargaining_committee level (40) or higher
  const hasAccess = await hasMinRole("bargaining_committee");
  
  if (!hasAccess) {
    redirect("/dashboard");
  }

  const organizationId = user.organizationId || "default";

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
