/**
 * My Courses Page
 * View enrolled courses and learning progress
 */
"use client";


export const dynamic = 'force-dynamic';
import MemberLearningPortal from "@/components/education/MemberLearningPortal";
import { useTranslations } from "next-intl";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { useUser } from '@nzila/platform-auth/entra/client';
import { Skeleton } from "@/components/ui/skeleton";

export default function MyCoursesPage() {
  const t = useTranslations("educationMyCoursesPage");
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
        <p>{t("signInPrompt")}</p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="p-6">
        <p>{t("selectOrgPrompt")}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-2 mb-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>
      
      <MemberLearningPortal 
        memberId={user.id} 
        organizationId={organizationId} 
      />
    </div>
  );
}
