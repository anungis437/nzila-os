"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
 
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

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

export default function CLCSyncDashboard({ organizationId }: CLCSyncDashboardProps) {
  const t = useTranslations("clcSync");
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSyncStatuses = useCallback(async () => {
    try {
      setLoading(true);
      const params = organizationId ? `?organizationId=${organizationId}` : '';
      const res = await fetch(`/api/v2/clc/sync${params}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSyncStatuses(items.map((s: any) => ({
          affiliateId: String(s.affiliateId ?? s.affiliate_id ?? s.id),
          affiliateName: s.affiliateName ?? s.affiliate_name ?? '',
          lastSync: s.lastSync ?? s.last_sync ?? '',
          nextScheduledSync: s.nextScheduledSync ?? s.next_scheduled_sync ?? '',
          status: s.status ?? 'pending',
          recordsSynced: s.recordsSynced ?? s.records_synced ?? 0,
          errors: s.errors,
          syncType: s.syncType ?? s.sync_type ?? 'full',
        })));
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchSyncStatuses(); }, [fetchSyncStatuses]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

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
            <CardTitle className="text-sm font-medium">{t("totalAffiliates")}</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAffiliates}</div>
            <p className="text-xs text-muted-foreground">{t("activeConnections")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("successful")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successfulSyncs}</div>
            <p className="text-xs text-green-500">
              {t("successRate", { rate: ((successfulSyncs / totalAffiliates) * 100).toFixed(0) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("inProgress")}</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgress}</div>
            <p className="text-xs text-muted-foreground">{t("currentlySyncing")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("failed")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedSyncs}</div>
            <p className="text-xs text-red-500">{t("requiresAttention")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("tableTitle")}</CardTitle>
          <CardDescription>{t("tableDescription")}</CardDescription>
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
                          {(['full','membership','financial','grievances'] as const).includes(sync.syncType as 'full') ? t(`syncTypes.${sync.syncType}` as 'syncTypes.full') : sync.syncType}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>{t("lastSync", { date: new Date(sync.lastSync).toLocaleString() })}</div>
                        <div>{t("nextSync", { date: new Date(sync.nextScheduledSync).toLocaleString() })}</div>
                        {sync.recordsSynced > 0 && (
                          <div>{t("recordsProcessed", { count: sync.recordsSynced.toLocaleString() })}</div>
                        )}
                      </div>
                      {sync.errors && sync.errors.length > 0 && (
                        <div className="mt-2 p-2 bg-red-500/10 rounded text-sm text-red-700">
                          <div className="font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t("errors")}
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
                      {(['success','failed','in-progress','pending'] as const).includes(sync.status as 'success') ? t(`status.${sync.status}` as 'status.success') : sync.status}
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
