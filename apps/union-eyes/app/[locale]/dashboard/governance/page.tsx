export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BylawsViewer from "@/components/governance/BylawsViewer";
import PolicyManager from "@/components/governance/PolicyManager";
import SignatoryManager from "@/components/governance/SignatoryManager";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "governancePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function GovernancePage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "governancePage" });
  const user = await requireUser();
  
  // Require at least officer level (60) to view governance
  const hasAccess = await hasMinRole("officer");
  
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Check if user can manage governance (president or above)
  const canManage = await hasMinRole("president");
  const organizationId = user.organizationId || "default";

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bylaws" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bylaws">{t("tabs.bylaws")}</TabsTrigger>
          <TabsTrigger value="policies">{t("tabs.policies")}</TabsTrigger>
          <TabsTrigger value="signatories">{t("tabs.signatories")}</TabsTrigger>
        </TabsList>

        <TabsContent value="bylaws" className="space-y-4">
          <BylawsViewer organizationId={organizationId} canEdit={canManage} />
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <PolicyManager organizationId={organizationId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="signatories" className="space-y-4">
          <SignatoryManager organizationId={organizationId} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
