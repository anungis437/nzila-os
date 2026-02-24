/**
 * Union Structure Dashboard Page
 * 
 * Admin dashboard for managing organizational structure:
 * - Employers (companies)
 * - Worksites (locations)
 * - Bargaining units
 * - Committees
 * - Steward assignments
 * 
 * Requires admin permissions (withAdminAuth)
 */


export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UnionStructureDashboard } from "@/components/union-structure/UnionStructureDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Union Structure Management",
  description: "Manage organizational structure, employers, worksites, bargaining units, and committees",
};

async function StructureDashboardContent() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  // Admin-only access (enforced by API but good to check here too)
  const organizationId = user.organizationId;

  if (!organizationId) {
    redirect("/onboarding");
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <UnionStructureDashboard organizationId={organizationId} />
    </div>
  );
}

export default function StructurePage() {
  return (
    <Suspense fallback={<LoadingDashboard />}>
      <StructureDashboardContent />
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
      
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
