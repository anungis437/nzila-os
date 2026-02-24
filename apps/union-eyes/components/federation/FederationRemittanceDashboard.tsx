/**
 * Federation Remittance Dashboard Component
 * 
 * Provincial remittance overview dashboard with:
 * - Monthly/quarterly remittance totals
 * - Compliance tracking by affiliate
 * - Overdue remittances alerts
 * - Payment status charts
 * - Collection rate trends
 * - Quick payment actions
 * 
 * @module components/federation/FederationRemittanceDashboard
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Download,
  Mail,
  Calendar
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { RemittanceComplianceWidget } from "./RemittanceComplianceWidget";
import { RemittanceHistoryTable } from "./RemittanceHistoryTable";
import { cn } from "@/lib/utils";

export interface RemittanceMetrics {
  totalExpected: number;
  totalReceived: number;
  totalOverdue: number;
  collectionRate: number;
  collectionRateTrend: "up" | "down" | "stable";
  affiliatesCompliant: number;
  affiliatesAtRisk: number;
  affiliatesOverdue: number;
  totalAffiliates: number;
  averageDaysToPayment: number;
  currentMonthReceived: number;
  currentMonthExpected: number;
  largestOutstanding: number;
  largestOutstandingAffiliate: string;
}

export interface FederationRemittanceDashboardProps {
  federationId: string;
  period?: "current" | "ytd" | "12m";
}

export function FederationRemittanceDashboard({
  federationId,
  period = "current"
}: FederationRemittanceDashboardProps) {
  const { toast } = useToast();
  const [metrics, setMetrics] = React.useState<RemittanceMetrics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [selectedPeriod, setSelectedPeriod] = React.useState(period);

  React.useEffect(() => {
    loadRemittanceData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [federationId, selectedPeriod]);

  async function loadRemittanceData() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/federation/remittance/dashboard?federationId=${federationId}&period=${selectedPeriod}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to load remittance data");
      }

      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
      } else {
        throw new Error(data.error || "Failed to load metrics");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load remittance dashboard",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshDashboard() {
    setIsRefreshing(true);
    await loadRemittanceData();
    setIsRefreshing(false);
    toast({
      title: "Dashboard Refreshed",
      description: "Remittance data has been updated"
    });
  }

  async function sendReminders() {
    try {
      const response = await fetch(
        `/api/federation/remittance/send-reminders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ federationId })
        }
      );
      
      if (!response.ok) throw new Error("Failed to send reminders");
      
      const data = await response.json();
      toast({
        title: "Reminders Sent",
        description: `Payment reminders sent to ${data.count} affiliates`
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to send reminders",
        variant: "destructive"
      });
    }
  }

  async function exportReport() {
    try {
      const response = await fetch(
        `/api/federation/remittance/export?federationId=${federationId}&period=${selectedPeriod}`,
        { method: 'POST' }
      );
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `remittance-report-${selectedPeriod}.pdf`;
      a.click();
      
      toast({
        title: "Report Exported",
        description: "Remittance report has been downloaded"
      });
    } catch (_error) {
      toast({
        title: "Export Failed",
        description: "Unable to export report",
        variant: "destructive"
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading remittance dashboard...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">No Data Available</h3>
          <p className="text-sm text-muted-foreground">
            Unable to load remittance metrics
          </p>
          <Button onClick={loadRemittanceData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const collectionPercentage = Math.round(metrics.collectionRate);
  const currentMonthPercentage = metrics.currentMonthExpected > 0
    ? Math.round((metrics.currentMonthReceived / metrics.currentMonthExpected) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Remittance Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Provincial remittance tracking and compliance
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as typeof period)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Period</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="12m">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={refreshDashboard}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={exportReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Collection Rate</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{collectionPercentage}%</span>
                </div>
                {metrics.collectionRateTrend && (
                  <div className="flex items-center gap-1 text-xs">
                    {metrics.collectionRateTrend === "up" ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : metrics.collectionRateTrend === "down" ? (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    ) : null}
                    <span className="text-muted-foreground">vs last period</span>
                  </div>
                )}
              </div>
              <div className={cn(
                "rounded-full p-3",
                collectionPercentage >= 90 ? "bg-green-100 dark:bg-green-900/30" :
                collectionPercentage >= 70 ? "bg-orange-100 dark:bg-orange-900/30" :
                "bg-red-100 dark:bg-red-900/30"
              )}>
                <DollarSign className={cn(
                  "h-5 w-5",
                  collectionPercentage >= 90 ? "text-green-600" :
                  collectionPercentage >= 70 ? "text-orange-600" :
                  "text-red-600"
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Received</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    ${(metrics.totalReceived / 1000).toFixed(0)}K
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  of ${(metrics.totalExpected / 1000).toFixed(0)}K expected
                </p>
              </div>
              <div className="rounded-full p-3 bg-blue-100 dark:bg-blue-900/30">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    ${(metrics.totalOverdue / 1000).toFixed(0)}K
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.affiliatesOverdue} affiliates
                </p>
              </div>
              <div className="rounded-full p-3 bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Avg Days to Pay</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {metrics.averageDaysToPayment}
                  </span>
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Payment turnaround
                </p>
              </div>
              <div className="rounded-full p-3 bg-gray-100 dark:bg-gray-800">
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Month Progress</CardTitle>
              <CardDescription>
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </CardDescription>
            </div>
            <Badge variant={currentMonthPercentage >= 90 ? "success" : "warning"}>
              {currentMonthPercentage}% Collected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Received</span>
            <span className="font-semibold">
              ${metrics.currentMonthReceived.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3">
            <div
              className={cn(
                "h-3 rounded-full transition-all",
                currentMonthPercentage >= 90 ? "bg-green-600" :
                currentMonthPercentage >= 70 ? "bg-orange-600" : "bg-red-600"
              )}
              style={{ width: `${Math.min(currentMonthPercentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Expected</span>
            <span className="font-medium">
              ${metrics.currentMonthExpected.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compliance Status</CardTitle>
            <CardDescription>
              Affiliate remittance compliance breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-600" />
                  <span className="text-sm">Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{metrics.affiliatesCompliant}</span>
                  <span className="text-sm text-muted-foreground">
                    ({Math.round((metrics.affiliatesCompliant / metrics.totalAffiliates) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-600" />
                  <span className="text-sm">At Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{metrics.affiliatesAtRisk}</span>
                  <span className="text-sm text-muted-foreground">
                    ({Math.round((metrics.affiliatesAtRisk / metrics.totalAffiliates) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-600" />
                  <span className="text-sm">Overdue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{metrics.affiliatesOverdue}</span>
                  <span className="text-sm text-muted-foreground">
                    ({Math.round((metrics.affiliatesOverdue / metrics.totalAffiliates) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>
              Action items requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.affiliatesOverdue > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-md">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-600">
                    {metrics.affiliatesOverdue} Overdue Remittances
                  </p>
                  <p className="text-xs text-red-600/80">
                    Total: ${metrics.totalOverdue.toLocaleString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={sendReminders}>
                  <Mail className="h-4 w-4 mr-1" />
                  Remind
                </Button>
              </div>
            )}
            {metrics.affiliatesAtRisk > 0 && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-md">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-600">
                    {metrics.affiliatesAtRisk} At Risk
                  </p>
                  <p className="text-xs text-orange-600/80">
                    Payment due soon
                  </p>
                </div>
              </div>
            )}
            {metrics.largestOutstanding > 0 && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-600">
                    Largest Outstanding
                  </p>
                  <p className="text-xs text-blue-600/80">
                    {metrics.largestOutstandingAffiliate}: ${metrics.largestOutstanding.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {metrics.affiliatesOverdue === 0 && metrics.affiliatesAtRisk === 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-md">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-600">
                  All remittances on track
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="compliance" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="compliance">Compliance Tracking</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="compliance" className="space-y-4">
          <RemittanceComplianceWidget federationId={federationId} />
        </TabsContent>

        <TabsContent value="history">
          <RemittanceHistoryTable federationId={federationId} />
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start" onClick={sendReminders}>
              <Mail className="h-4 w-4 mr-2" />
              Send Reminders
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/federation/${federationId}/remittance/reconcile`}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Reconcile Payments
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/federation/${federationId}/remittance/schedule`}>
                <Calendar className="h-4 w-4 mr-2" />
                View Schedule
              </a>
            </Button>
            <Button variant="outline" className="justify-start" onClick={exportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
