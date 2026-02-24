"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
 
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

interface SyncStatus {
  affiliateId: string;
  affiliateName: string;
  lastSync: string;
  nextScheduledSync: string;
  status: "success" | "failed" | "in-progress" | "pending";
  recordsSynced: number;
  errors?: string[];
  syncType: "membership" | "financial" | "grievances" | "full";
}

interface CLCSyncDashboardProps {
  organizationId?: string;
}

export default function CLCSyncDashboard({ organizationId: _organizationId }: CLCSyncDashboardProps) {
  // Mock data - replace with actual API call
  const syncStatuses: SyncStatus[] = [
    {
      affiliateId: "1",
      affiliateName: "CUPE Local 79",
      lastSync: "2026-02-11T08:00:00Z",
      nextScheduledSync: "2026-02-11T20:00:00Z",
      status: "success",
      recordsSynced: 3500,
      syncType: "full"
    },
    {
      affiliateId: "2",
      affiliateName: "Unifor Local 444",
      lastSync: "2026-02-11T07:30:00Z",
      nextScheduledSync: "2026-02-11T19:30:00Z",
      status: "success",
      recordsSynced: 8200,
      syncType: "membership"
    },
    {
      affiliateId: "3",
      affiliateName: "PSAC Local 610",
      lastSync: "2026-02-11T06:00:00Z",
      nextScheduledSync: "2026-02-11T18:00:00Z",
      status: "in-progress",
      recordsSynced: 450,
      syncType: "financial"
    },
    {
      affiliateId: "4",
      affiliateName: "UFCW Local 1006A",
      lastSync: "2026-02-10T20:00:00Z",
      nextScheduledSync: "2026-02-11T20:00:00Z",
      status: "failed",
      recordsSynced: 0,
      errors: ["Connection timeout", "Invalid credentials"],
      syncType: "full"
    }
  ];

  const totalAffiliates = syncStatuses.length;
  const successfulSyncs = syncStatuses.filter(s => s.status === "success").length;
  const failedSyncs = syncStatuses.filter(s => s.status === "failed").length;
  const inProgress = syncStatuses.filter(s => s.status === "in-progress").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "failed": return "bg-red-500/10 text-red-700 border-red-500/20";
      case "in-progress": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "pending": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="h-4 w-4" />;
      case "failed": return <XCircle className="h-4 w-4" />;
      case "in-progress": return <RefreshCw className="h-4 w-4 animate-spin" />;
      case "pending": return <Clock className="h-4 w-4" />;
      default: return null;
    }
  };

  const getSyncTypeColor = (type: string) => {
    switch (type) {
      case "full": return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      case "membership": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "financial": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "grievances": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Affiliates</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAffiliates}</div>
            <p className="text-xs text-muted-foreground">Active sync connections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successfulSyncs}</div>
            <p className="text-xs text-green-500">
              {((successfulSyncs / totalAffiliates) * 100).toFixed(0)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgress}</div>
            <p className="text-xs text-muted-foreground">Currently syncing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedSyncs}</div>
            <p className="text-xs text-red-500">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>Affiliate Sync Status</CardTitle>
          <CardDescription>Real-time synchronization status for all CLC affiliates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {syncStatuses.map((sync) => (
              <Card key={sync.affiliateId} className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{sync.affiliateName}</h4>
                        <Badge variant="outline" className={getSyncTypeColor(sync.syncType)}>
                          {sync.syncType}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Last sync: {new Date(sync.lastSync).toLocaleString()}</div>
                        <div>Next sync: {new Date(sync.nextScheduledSync).toLocaleString()}</div>
                        {sync.recordsSynced > 0 && (
                          <div>Records processed: {sync.recordsSynced.toLocaleString()}</div>
                        )}
                      </div>
                      {sync.errors && sync.errors.length > 0 && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded text-sm text-red-700">
                          <div className="font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Errors:
                          </div>
                          <ul className="list-disc list-inside mt-1">
                            {sync.errors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={`${getStatusColor(sync.status)} flex items-center gap-1`}>
                      {getStatusIcon(sync.status)}
                      {sync.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
