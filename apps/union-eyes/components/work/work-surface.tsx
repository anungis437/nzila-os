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
import { useOrganization } from "@/contexts/organization-context";
import { Scale, Users, BookOpen } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";

export function WorkSurface() {
  const t = useTranslations();
  const locale = useLocale();
  const { organizationId } = useOrganization();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.work")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Active casework and operations — manage cases, grievances, bargaining, arbitration, and committees.
        </p>
        <Link
          href={`/${locale}/dashboard/knowledge`}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
        >
          <BookOpen size={12} /> Reference clauses &amp; precedents in Knowledge
        </Link>
      </div>

      <Tabs defaultValue="cases" className="w-full">
        <TabsList>
          <TabsTrigger value="cases">{t("claims.caseQueue")}</TabsTrigger>
          <TabsTrigger value="grievances">{t("grievance.title")}</TabsTrigger>
          <TabsTrigger value="bargaining">{t("sidebar.bargainingNegotiations")}</TabsTrigger>
          <TabsTrigger value="arbitration">Arbitration</TabsTrigger>
          <TabsTrigger value="committees">Committees</TabsTrigger>
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

        <TabsContent value="arbitration" className="mt-4">
          <div className="rounded-lg border p-8 text-center">
            <Scale size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700 mb-1">Arbitration</p>
            <p className="text-sm text-gray-400">
              No arbitration cases at this time. When grievances are escalated to
              arbitration, hearing schedules and case details will appear here.
            </p>
            <Link
              href={`/${locale}/dashboard/knowledge`}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-3"
            >
              <BookOpen size={12} /> Review precedents in Knowledge
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="committees" className="mt-4">
          <div className="rounded-lg border p-8 text-center">
            <Users size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700 mb-1">Committees</p>
            <p className="text-sm text-gray-400">
              No active committees yet. Once bargaining, health &amp; safety, or
              workplace committees are created, membership, meetings, and action
              items will be managed here.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
