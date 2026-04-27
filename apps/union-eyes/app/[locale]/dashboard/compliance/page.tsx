"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileBarChart,
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield,
  RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComplianceAlert {
  id: string;
  employerId: string;
  employerName?: string;
  alertType: string;
  severity: string;
  message: string;
  resolvedAt: string | null;
  createdAt: string;
}

interface ComplianceReport {
  id: string;
  employerId: string;
  employerName?: string;
  reportType: string;
  dataJson: Record<string, unknown>;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-blue-100 text-blue-800",
  info: "bg-gray-100 text-gray-600",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const t = useTranslations("compliancePage");
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, reportsRes] = await Promise.all([
        fetch("/api/compliance/alerts"),
        fetch("/api/compliance/reports"),
      ]);
      if (alertsRes.ok) {
        const alertsJson = await alertsRes.json();
        if (alertsJson.data) setAlerts(alertsJson.data);
      }
      if (reportsRes.ok) {
        const reportsJson = await reportsRes.json();
        if (reportsJson.data) setReports(reportsJson.data);
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const unresolvedAlerts = alerts.filter((a) => !a.resolvedAt);
  const criticalCount = unresolvedAlerts.filter((a) => a.severity === "critical").length;
  const highCount = unresolvedAlerts.filter((a) => a.severity === "high").length;
  const resolvedCount = alerts.filter((a) => a.resolvedAt).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Shield className="h-8 w-8" />
            {t("header.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("header.description")}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1 rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> {t("header.refresh")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">{t("stats.activeAlerts")}</p>
              <p className="text-2xl font-bold">{unresolvedAlerts.length}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">{t("stats.critical")}</p>
              <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">{t("stats.highPriority")}</p>
              <p className="text-2xl font-bold text-orange-600">{highCount}</p>
            </div>
            <Clock className="h-8 w-8 text-orange-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">{t("stats.resolved")}</p>
              <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>
      </div>

      {/* Alerts + Reports Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" /> {t("sections.activeAlerts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : unresolvedAlerts.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-500" />
                <p className="text-sm text-gray-500">{t("sections.allClear")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {unresolvedAlerts.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 rounded border p-3"
                  >
                    <span
                      className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[alert.severity]}`}
                    >
                      {alert.severity}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {alert.alertType.replace(/_/g, " ")}
                      </p>
                      {alert.employerName && (
                        <p className="text-xs font-medium text-gray-600">{alert.employerName}</p>
                      )}
                      <p className="text-xs text-gray-500">{alert.message}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(alert.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileBarChart className="h-4 w-4" /> {t("sections.recentReports")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : reports.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">{t("sections.noReports")}</p>
            ) : (
              <div className="space-y-3">
                {reports.slice(0, 10).map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {report.reportType.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("sections.employerLabel")}: {report.employerName || report.employerId}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charter Compliance (preserved from original) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">{t("charter.title")}</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded bg-muted p-3">
              <span>{t("charter.items.electionsDemocracy")}</span>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between rounded bg-muted p-3">
              <span>{t("charter.items.financialReporting")}</span>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="flex items-center justify-between rounded bg-muted p-3">
              <span>{t("charter.items.memberRights")}</span>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">{t("deadlines.title")}</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded bg-muted p-3">
              <div>
                <p className="font-medium">{t("deadlines.items.annualFinancialReport.name")}</p>
                <p className="text-sm text-muted-foreground">{t("deadlines.items.annualFinancialReport.due")}</p>
              </div>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="flex items-center justify-between rounded bg-muted p-3">
              <div>
                <p className="font-medium">{t("deadlines.items.electionResults.name")}</p>
                <p className="text-sm text-muted-foreground">{t("deadlines.items.electionResults.due")}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between rounded bg-muted p-3">
              <div>
                <p className="font-medium">{t("deadlines.items.constitutionUpdates.name")}</p>
                <p className="text-sm text-muted-foreground">{t("deadlines.items.constitutionUpdates.due")}</p>
              </div>
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
