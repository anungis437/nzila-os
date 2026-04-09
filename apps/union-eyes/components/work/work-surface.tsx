"use client";

/**
 * WorkSurface — tabbed workspace consolidating Cases, Grievances,
 * and Bargaining into a single work area.
 */

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import WorkbenchConsole from "@/components/workbench/workbench-console";
import { GrievancesConsole } from "@/components/grievances/grievances-console";
import { NegotiationDashboard } from "@/components/bargaining/NegotiationDashboard";
import { useOrganization } from "@/contexts/organization-context";

export function WorkSurface() {
  const t = useTranslations();
  const { organizationId } = useOrganization();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.work")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Active casework and operations — cases, grievances, and bargaining in one place.
        </p>
      </div>

      <Tabs defaultValue="cases" className="w-full">
        <TabsList>
          <TabsTrigger value="cases">{t("claims.caseQueue")}</TabsTrigger>
          <TabsTrigger value="grievances">{t("grievance.title")}</TabsTrigger>
          <TabsTrigger value="bargaining">{t("sidebar.bargainingNegotiations")}</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-4">
          <WorkbenchConsole />
        </TabsContent>

        <TabsContent value="grievances" className="mt-4">
          <GrievancesConsole />
        </TabsContent>

        <TabsContent value="bargaining" className="mt-4">
          {organizationId ? (
            <NegotiationDashboard organizationId={organizationId} />
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">
              Select an organization to view bargaining.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
