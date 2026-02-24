/**
 * Course Catalog Page
 * Browse and search available training courses
 */
"use client";


export const dynamic = 'force-dynamic';
import CourseCatalog from "@/components/education/CourseCatalog";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { useUser } from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";

export default function CoursesPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const organizationId = useOrganizationId();

  if (!userLoaded) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <p>Please sign in to view courses.</p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="p-6">
        <p>Please select an organization to view courses.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-2 mb-6">
        <h1 className="text-3xl font-bold">Course Catalog</h1>
        <p className="text-muted-foreground">
          Browse and enroll in available training courses
        </p>
      </div>
      
      <CourseCatalog 
        memberId={user.id} 
        organizationId={organizationId} 
      />
    </div>
  );
}
