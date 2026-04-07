"use client";

export const dynamic = 'force-dynamic';

/**
 * Reports Management Page
 * 
 * Reporting center integrating:
 * - Custom report builder
 * - Saved reports library
 * - Report sharing hub
 * - Data export scheduler
 * 
 * @page app/[locale]/reports/page.tsx
 */

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CustomReportBuilder } from "@/components/analytics/custom-report-builder";
import { ReportSharingHub } from "@/components/analytics/report-sharing-hub";
import { DataExportScheduler } from "@/components/analytics/data-export-scheduler";

export default function ReportsPage() {
  const [showReportBuilder, setShowReportBuilder] = React.useState(false);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-gray-600 mt-2">
            Create custom reports, schedule exports, and share insights
          </p>
        </div>
        <Button onClick={() => setShowReportBuilder(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">My Reports</TabsTrigger>
          <TabsTrigger value="sharing">Sharing</TabsTrigger>
          <TabsTrigger value="exports">Scheduled Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <div className="space-y-4">
            <p className="text-gray-600">
              Your saved reports will appear here. Create a new report to get started.
            </p>
            {/* Saved reports list would be implemented here */}
          </div>
        </TabsContent>

        <TabsContent value="sharing">
          <ReportSharingHub />
        </TabsContent>

        <TabsContent value="exports">
          <DataExportScheduler />
        </TabsContent>
      </Tabs>

      {/* Report Builder Modal */}
      {showReportBuilder && (
        <CustomReportBuilder
          onSave={async (_report) => {
setShowReportBuilder(false);
          }}
        />
      )}
    </div>
  );
}
