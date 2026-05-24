"use client";

/**
 * WorkSurface — tabbed workspace consolidating Cases, Grievances,
 * Bargaining, Arbitration, and Committees into a single work area.
 */

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import WorkbenchConsole from "@/components/workbench/workbench-console";
import { GrievancesConsole } from "@/components/grievances/grievances-console";
import { NegotiationDashboard } from "@/components/bargaining/NegotiationDashboard";
import { MyCommittees } from "@/components/work/my-committees";
import { ArbitrationConsole } from "@/components/arbitration/arbitration-console";
import { useOrganization } from "@/contexts/organization-context";
import { BookOpen } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Cupe4373CasesConsole } from "@/components/demo/cupe4373-cases-console";
import { isCupe4373DemoRuntime } from "@/lib/dashboard/role-experience";

export function WorkSurface() {
  const t = useTranslations();
  const tWork = useTranslations("workSurface");
  const locale = useLocale();
  const { organizationId } = useOrganization();

  if (isCupe4373DemoRuntime()) {
    return <Cupe4373CasesConsole />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.work")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tWork("subtitle")}
        </p>
        <Link
          href={`/${locale}/dashboard/organizational-memory?tab=knowledge`}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
        >
          <BookOpen size={12} /> {tWork("knowledgeLink")}
        </Link>
      </div>

      <Tabs defaultValue="cases" className="w-full">
        <TabsList>
          <TabsTrigger value="cases">{tWork("tabs.cases")}</TabsTrigger>
          <TabsTrigger value="grievances">{tWork("tabs.grievances")}</TabsTrigger>
          <TabsTrigger value="bargaining">{tWork("tabs.bargaining")}</TabsTrigger>
          <TabsTrigger value="arbitration">{tWork("tabs.arbitration")}</TabsTrigger>
          <TabsTrigger value="committees">{tWork("tabs.committees")}</TabsTrigger>
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
              {tWork("selectOrgBargaining")}
            </p>
          )}
        </TabsContent>

        <TabsContent value="arbitration" className="mt-4">
          {organizationId ? (
            <ArbitrationConsole />
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">
              {tWork("selectOrgArbitration")}
            </p>
          )}
        </TabsContent>

        <TabsContent value="committees" className="mt-4">
          {organizationId ? (
            <MyCommittees organizationId={organizationId} />
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">
              {tWork("selectOrgCommittees")}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
