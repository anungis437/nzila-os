/**
 * Audit Logs Admin Page
 * 
 * Full audit log viewer with existing AuditLogViewer component integration.
 * Part of Phase 0.2 - Admin Console UI
 */


export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { Activity, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
 
import { AuditLogsDashboard } from "@/components/admin/audit-logs-dashboard";

interface PageProps {
  params: { locale: string };
}

export default async function AuditLogsPage({ params: _params }: PageProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-600" />
            Audit Logs
          </h2>
          <p className="text-gray-600 mt-2">
            Comprehensive system activity logs and audit trail for compliance
          </p>
        </div>
        <Button size="lg" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Main Audit Log Dashboard */}
      <Suspense fallback={<AuditLogsSkeleton />}>
        <AuditLogsDashboard />
      </Suspense>
    </div>
  );
}

function AuditLogsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading audit logs...</CardTitle>
        <CardDescription>Please wait while we fetch the data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
