"use client";

/**
 * =============================================================================
 * SCHEDULED REPORTS MANAGER
 * =============================================================================
 * Purpose: Manage automated report generation and delivery schedules
 * Features:
 *   - Report scheduler with cron builder
 *   - Recipient management (email distribution lists)
 *   - Format selection (PDF, Excel, CSV)
 *   - Schedule history and status tracking
 *   - Manual trigger capability
 *   - Next run time display
 * Phase: 8 (Analytics & Reporting Enhancements)
 * =============================================================================
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
 
import {
  Clock,
  Mail,
  FileText,
  Calendar,
  Play,
  Pause,
  Trash2,
  Plus,
  Send,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  History as _History,
  Settings,
  Loader2,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface ScheduledReport {
  id: string;
  reportName: string;
  reportType: string;
  reportDescription: string;
  scheduleType: "cron" | "one_time" | "manual_only";
  cronExpression: string;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  recipients: string[];
  deliveryFormat: "pdf" | "excel" | "csv" | "all";
  includeAttachments: boolean;
  emailSubject: string;
  emailBody: string;
  isActive: boolean;
  runCount: number;
  lastRunStatus: "success" | "failed" | "running" | "skipped" | null;
  lastRunError: string | null;
  createdAt: string;
}

interface DeliveryHistory {
  id: string;
  reportName: string;
  reportType: string;
  deliveryMethod: string;
  recipients: string[];
  deliveryFormat: string;
  status: "pending" | "generating" | "sending" | "delivered" | "failed" | "expired";
  deliveredAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  emailOpened: boolean;
  emailClicked: boolean;
  generationTimeMs: number | null;
  createdAt: string;
}

// =============================================================================
// SAMPLE DATA (module-level defaults, replaced by API fetch at runtime)
// =============================================================================
/* eslint-disable @typescript-eslint/no-unused-vars */
const sampleScheduledReports: ScheduledReport[] = [
  {
    id: "sr-1",
    reportName: "Weekly Executive Dashboard",
    reportType: "executive_dashboard",
    reportDescription: "Comprehensive overview of all key metrics",
    scheduleType: "cron",
    cronExpression: "0 8 * * 1", // Every Monday at 8 AM
    timezone: "America/Toronto",
    nextRunAt: "2025-12-08T08:00:00Z",
    lastRunAt: "2025-12-01T08:00:00Z",
    recipients: ["president@local123.ca", "vicepresident@local123.ca", "secretary@local123.ca"],
    deliveryFormat: "pdf",
    includeAttachments: true,
    emailSubject: "Weekly Executive Dashboard - {{date}}",
    emailBody: "Please find attached the weekly executive dashboard report.",
    isActive: true,
    runCount: 12,
    lastRunStatus: "success",
    lastRunError: null,
    createdAt: "2025-09-01T10:00:00Z",
  },
  {
    id: "sr-2",
    reportName: "Monthly Communication Analytics",
    reportType: "communication_analytics",
    reportDescription: "Email, SMS, and push notification performance",
    scheduleType: "cron",
    cronExpression: "0 9 1 * *", // 1st of month at 9 AM
    timezone: "America/Toronto",
    nextRunAt: "2026-01-01T09:00:00Z",
    lastRunAt: "2025-12-01T09:00:00Z",
    recipients: ["communications@local123.ca", "admin@local123.ca"],
    deliveryFormat: "excel",
    includeAttachments: true,
    emailSubject: "Monthly Communication Analytics - {{month}}",
    emailBody: "Attached is the communication analytics report for the month.",
    isActive: true,
    runCount: 3,
    lastRunStatus: "success",
    lastRunError: null,
    createdAt: "2025-10-01T14:00:00Z",
  },
  {
    id: "sr-3",
    reportName: "Quarterly Dues Collection Summary",
    reportType: "dues_collection",
    reportDescription: "Dues collection, arrears, and payment trends",
    scheduleType: "cron",
    cronExpression: "0 10 1 1,4,7,10 *", // Quarterly (Jan, Apr, Jul, Oct)
    timezone: "America/Toronto",
    nextRunAt: "2026-01-01T10:00:00Z",
    lastRunAt: "2025-10-01T10:00:00Z",
    recipients: ["treasurer@local123.ca", "president@local123.ca"],
    deliveryFormat: "all",
    includeAttachments: true,
    emailSubject: "Q{{quarter}} Dues Collection Summary",
    emailBody: "Please review the attached quarterly dues collection summary.",
    isActive: true,
    runCount: 1,
    lastRunStatus: "success",
    lastRunError: null,
    createdAt: "2025-09-15T11:00:00Z",
  },
  {
    id: "sr-4",
    reportName: "Daily Engagement Metrics",
    reportType: "engagement_metrics",
    reportDescription: "Member engagement scores and activity",
    scheduleType: "cron",
    cronExpression: "0 7 * * *", // Every day at 7 AM
    timezone: "America/Toronto",
    nextRunAt: "2025-12-08T07:00:00Z",
    lastRunAt: "2025-12-07T07:00:00Z",
    recipients: ["admin@local123.ca"],
    deliveryFormat: "pdf",
    includeAttachments: true,
    emailSubject: "Daily Engagement Metrics - {{date}}",
    emailBody: "Your daily engagement metrics report is attached.",
    isActive: false, // Paused
    runCount: 45,
    lastRunStatus: "success",
    lastRunError: null,
    createdAt: "2025-08-01T09:00:00Z",
  },
  {
    id: "sr-5",
    reportName: "Training Completion Report",
    reportType: "training_completion",
    reportDescription: "Training completions, certifications, and expiring credentials",
    scheduleType: "manual_only",
    cronExpression: "",
    timezone: "America/Toronto",
    nextRunAt: null,
    lastRunAt: "2025-11-28T14:30:00Z",
    recipients: ["training@local123.ca", "secretary@local123.ca"],
    deliveryFormat: "excel",
    includeAttachments: true,
    emailSubject: "Training Completion Report",
    emailBody: "Manual training completion report as requested.",
    isActive: true,
    runCount: 8,
    lastRunStatus: "success",
    lastRunError: null,
    createdAt: "2025-07-01T16:00:00Z",
  },
];

const sampleDeliveryHistory: DeliveryHistory[] = [
  {
    id: "dh-1",
    reportName: "Weekly Executive Dashboard",
    reportType: "executive_dashboard",
    deliveryMethod: "email",
    recipients: ["president@local123.ca", "vicepresident@local123.ca"],
    deliveryFormat: "pdf",
    status: "delivered",
    deliveredAt: "2025-12-01T08:05:00Z",
    failedAt: null,
    errorMessage: null,
    fileUrl: "https://storage.example.com/reports/exec-dashboard-2025-12-01.pdf",
    fileSizeBytes: 2457600, // 2.4 MB
    emailOpened: true,
    emailClicked: true,
    generationTimeMs: 4500,
    createdAt: "2025-12-01T08:00:00Z",
  },
  {
    id: "dh-2",
    reportName: "Monthly Communication Analytics",
    reportType: "communication_analytics",
    deliveryMethod: "email",
    recipients: ["communications@local123.ca"],
    deliveryFormat: "excel",
    status: "delivered",
    deliveredAt: "2025-12-01T09:03:00Z",
    failedAt: null,
    errorMessage: null,
    fileUrl: "https://storage.example.com/reports/comm-analytics-2025-11.xlsx",
    fileSizeBytes: 1835008, // 1.8 MB
    emailOpened: true,
    emailClicked: false,
    generationTimeMs: 3200,
    createdAt: "2025-12-01T09:00:00Z",
  },
  {
    id: "dh-3",
    reportName: "Daily Engagement Metrics",
    reportType: "engagement_metrics",
    deliveryMethod: "email",
    recipients: ["admin@local123.ca"],
    deliveryFormat: "pdf",
    status: "delivered",
    deliveredAt: "2025-12-07T07:02:00Z",
    failedAt: null,
    errorMessage: null,
    fileUrl: "https://storage.example.com/reports/engagement-2025-12-07.pdf",
    fileSizeBytes: 1048576, // 1 MB
    emailOpened: false,
    emailClicked: false,
    generationTimeMs: 2800,
    createdAt: "2025-12-07T07:00:00Z",
  },
  {
    id: "dh-4",
    reportName: "Training Completion Report",
    reportType: "training_completion",
    deliveryMethod: "download",
    recipients: [],
    deliveryFormat: "excel",
    status: "delivered",
    deliveredAt: "2025-11-28T14:32:00Z",
    failedAt: null,
    errorMessage: null,
    fileUrl: "https://storage.example.com/reports/training-2025-11-28.xlsx",
    fileSizeBytes: 512000, // 500 KB
    emailOpened: false,
    emailClicked: false,
    generationTimeMs: 1900,
    createdAt: "2025-11-28T14:30:00Z",
  },
  {
    id: "dh-5",
    reportName: "Weekly Executive Dashboard",
    reportType: "executive_dashboard",
    deliveryMethod: "email",
    recipients: ["president@local123.ca", "vicepresident@local123.ca"],
    deliveryFormat: "pdf",
    status: "failed",
    deliveredAt: null,
    failedAt: "2025-11-24T08:02:00Z",
    errorMessage: "SMTP connection timeout - retrying on next schedule",
    fileUrl: null,
    fileSizeBytes: null,
    emailOpened: false,
    emailClicked: false,
    generationTimeMs: 4200,
    createdAt: "2025-11-24T08:00:00Z",
  },
];

/* eslint-enable @typescript-eslint/no-unused-vars */
// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ScheduledReportsManager() {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryHistory[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [_selectedReport, setSelectedReport] = useState<ScheduledReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v2/analytics/scheduled-reports");
      if (res.ok) {
        const json = await res.json();
        if (json.reports) setScheduledReports(json.reports);
        else if (Array.isArray(json)) setScheduledReports(json);
        if (json.deliveryHistory) setDeliveryHistory(json.deliveryHistory);
      }
    } catch {
      // API not available — empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Stats
  const activeReports = scheduledReports.filter((r) => r.isActive).length;
  const totalDeliveries = deliveryHistory.length;
  const successfulDeliveries = deliveryHistory.filter((d) => d.status === "delivered").length;
  const failedDeliveries = deliveryHistory.filter((d) => d.status === "failed").length;
  const successRate =
    totalDeliveries > 0 ? ((successfulDeliveries / totalDeliveries) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Reports</h1>
          <p className="text-muted-foreground">
            Automate report generation and delivery on a schedule
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Scheduled Report</DialogTitle>
              <DialogDescription>
                Configure automated report generation and delivery
              </DialogDescription>
            </DialogHeader>
            <CreateScheduleForm onClose={() => setIsCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReports}</div>
            <p className="text-xs text-muted-foreground">
              {scheduledReports.length} total schedules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {successfulDeliveries} of {totalDeliveries}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Deliveries</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedDeliveries}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="schedules" className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="history">Delivery History</TabsTrigger>
        </TabsList>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>Manage automated report delivery schedules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scheduledReports.map((report) => (
                  <ScheduledReportCard
                    key={report.id}
                    report={report}
                    onToggleActive={() => {
                      setScheduledReports(
                        scheduledReports.map((r) =>
                          r.id === report.id ? { ...r, isActive: !r.isActive } : r
                        )
                      );
                    }}
                    onTrigger={() => alert(`Triggering report: ${report.reportName}`)}
                    onEdit={() => setSelectedReport(report)}
                    onDelete={() => {
                      setScheduledReports(scheduledReports.filter((r) => r.id !== report.id));
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delivery History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Delivery History</CardTitle>
              <CardDescription>View all report deliveries and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deliveryHistory.map((delivery) => (
                  <DeliveryHistoryCard key={delivery.id} delivery={delivery} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================================
// SCHEDULED REPORT CARD
// =============================================================================

interface ScheduledReportCardProps {
  report: ScheduledReport;
  onToggleActive: () => void;
  onTrigger: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ScheduledReportCard({
  report,
  onToggleActive,
  onTrigger,
  onEdit,
  onDelete,
}: ScheduledReportCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex-1 space-y-2">
        {/* Report name and status */}
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{report.reportName}</h3>
          {report.isActive ? (
            <Badge variant="default" className="bg-green-600">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">Paused</Badge>
          )}
          {report.scheduleType === "manual_only" && (
            <Badge variant="outline">Manual Only</Badge>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">{report.reportDescription}</p>

        {/* Schedule info */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="capitalize">{report.reportType.replace(/_/g, " ")}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>{report.deliveryFormat.toUpperCase()}</span>
          </div>
          {report.scheduleType === "cron" && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{parseCronExpression(report.cronExpression)}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{report.recipients.length} recipients</span>
          </div>
        </div>

        {/* Next run and last run */}
        <div className="flex gap-4 text-xs">
          {report.nextRunAt && (
            <div>
              <span className="text-muted-foreground">Next run:</span>{" "}
              <span className="font-medium">
                {new Date(report.nextRunAt).toLocaleString("en-CA", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
          )}
          {report.lastRunAt && (
            <div>
              <span className="text-muted-foreground">Last run:</span>{" "}
              <span className="font-medium">
                {new Date(report.lastRunAt).toLocaleString("en-CA", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
              {report.lastRunStatus === "success" && (
                <CheckCircle2 className="inline h-3 w-3 ml-1 text-green-600" />
              )}
              {report.lastRunStatus === "failed" && (
                <XCircle className="inline h-3 w-3 ml-1 text-red-600" />
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="text-xs text-muted-foreground">
          {report.runCount} total runs
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleActive}
          title={report.isActive ? "Pause" : "Resume"}
        >
          {report.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onTrigger}
          title="Run now"
        >
          <Send className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit} title="Settings">
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          title="Delete"
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// DELIVERY HISTORY CARD
// =============================================================================

interface DeliveryHistoryCardProps {
  delivery: DeliveryHistory;
}

function DeliveryHistoryCard({ delivery }: DeliveryHistoryCardProps) {
  const statusConfig = {
    delivered: { color: "bg-green-600", icon: CheckCircle2 },
    failed: { color: "bg-red-600", icon: XCircle },
    pending: { color: "bg-gray-600", icon: Clock },
    generating: { color: "bg-blue-600", icon: Settings },
    sending: { color: "bg-purple-600", icon: Send },
    expired: { color: "bg-orange-600", icon: AlertCircle },
  };

  const config = statusConfig[delivery.status];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg">
      <div className={`p-2 rounded-full ${config.color}`}>
        <StatusIcon className="h-5 w-5 text-white" />
      </div>

      <div className="flex-1 space-y-2">
        {/* Report name and status */}
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{delivery.reportName}</h3>
          <Badge variant="outline" className="capitalize">
            {delivery.status}
          </Badge>
          <Badge variant="secondary">{delivery.deliveryFormat.toUpperCase()}</Badge>
        </div>

        {/* Delivery details */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>
              {new Date(delivery.createdAt).toLocaleString("en-CA", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          </div>
          {delivery.recipients.length > 0 && (
            <div className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              <span>{delivery.recipients.length} recipients</span>
            </div>
          )}
          {delivery.fileSizeBytes && (
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{formatFileSize(delivery.fileSizeBytes)}</span>
            </div>
          )}
          {delivery.generationTimeMs && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{(delivery.generationTimeMs / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>

        {/* Email tracking */}
        {delivery.status === "delivered" && delivery.deliveryMethod === "email" && (
          <div className="flex gap-3 text-xs">
            <span className={delivery.emailOpened ? "text-green-600" : "text-muted-foreground"}>
              {delivery.emailOpened ? "✓ Opened" : "Not opened"}
            </span>
            <span className={delivery.emailClicked ? "text-green-600" : "text-muted-foreground"}>
              {delivery.emailClicked ? "✓ Clicked" : "Not clicked"}
            </span>
          </div>
        )}

        {/* Error message */}
        {delivery.errorMessage && (
          <p className="text-sm text-red-600">{delivery.errorMessage}</p>
        )}
      </div>

      {/* Download button */}
      {delivery.fileUrl && (
        <Button size="sm" variant="outline" asChild>
          <a href={delivery.fileUrl} download>
            <Download className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// CREATE SCHEDULE FORM
// =============================================================================

interface CreateScheduleFormProps {
  onClose: () => void;
}

function CreateScheduleForm({ onClose }: CreateScheduleFormProps) {
  const [formData, setFormData] = useState({
    reportName: "",
    reportType: "executive_dashboard",
    reportDescription: "",
    scheduleType: "cron" as "cron" | "one_time" | "manual_only",
    cronPreset: "weekly",
    customCron: "",
    recipients: [""],
    deliveryFormat: "pdf" as "pdf" | "excel" | "csv" | "all",
    emailSubject: "",
    emailBody: "",
  });

  const cronPresets = {
    daily: { label: "Daily at 8 AM", cron: "0 8 * * *" },
    weekly: { label: "Weekly on Monday", cron: "0 8 * * 1" },
    monthly: { label: "Monthly on 1st", cron: "0 8 1 * *" },
    quarterly: { label: "Quarterly", cron: "0 8 1 1,4,7,10 *" },
    custom: { label: "Custom expression", cron: "" },
  };

  return (
    <form className="space-y-4">
      {/* Report name */}
      <div className="space-y-2">
        <Label htmlFor="reportName">Report Name *</Label>
        <Input
          id="reportName"
          value={formData.reportName}
          onChange={(e) => setFormData({ ...formData, reportName: e.target.value })}
          placeholder="Weekly Executive Dashboard"
        />
      </div>

      {/* Report type */}
      <div className="space-y-2">
        <Label htmlFor="reportType">Report Type *</Label>
        <Select
          value={formData.reportType}
          onValueChange={(value) => setFormData({ ...formData, reportType: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="executive_dashboard">Executive Dashboard</SelectItem>
            <SelectItem value="communication_analytics">Communication Analytics</SelectItem>
            <SelectItem value="engagement_metrics">Engagement Metrics</SelectItem>
            <SelectItem value="financial_summary">Financial Summary</SelectItem>
            <SelectItem value="training_completion">Training Completion</SelectItem>
            <SelectItem value="grievance_summary">Grievance Summary</SelectItem>
            <SelectItem value="dues_collection">Dues Collection</SelectItem>
            <SelectItem value="organizing_progress">Organizing Progress</SelectItem>
            <SelectItem value="benchmark_comparison">Benchmark Comparison</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.reportDescription}
          onChange={(e) => setFormData({ ...formData, reportDescription: e.target.value })}
          placeholder="Comprehensive overview of all key metrics"
          rows={2}
        />
      </div>

      {/* Schedule type */}
      <div className="space-y-2">
        <Label htmlFor="scheduleType">Schedule Type *</Label>
        <Select
          value={formData.scheduleType}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onValueChange={(value: any) => setFormData({ ...formData, scheduleType: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cron">Recurring (Cron)</SelectItem>
            <SelectItem value="one_time">One-Time</SelectItem>
            <SelectItem value="manual_only">Manual Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cron preset (only for recurring) */}
      {formData.scheduleType === "cron" && (
        <div className="space-y-2">
          <Label htmlFor="cronPreset">Schedule Frequency *</Label>
          <Select
            value={formData.cronPreset}
            onValueChange={(value) => setFormData({ ...formData, cronPreset: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(cronPresets).map(([key, preset]) => (
                <SelectItem key={key} value={key}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Custom cron (only if custom selected) */}
      {formData.scheduleType === "cron" && formData.cronPreset === "custom" && (
        <div className="space-y-2">
          <Label htmlFor="customCron">Cron Expression *</Label>
          <Input
            id="customCron"
            value={formData.customCron}
            onChange={(e) => setFormData({ ...formData, customCron: e.target.value })}
            placeholder="0 8 * * *"
          />
          <p className="text-xs text-muted-foreground">
            Format: minute hour day month day-of-week
          </p>
        </div>
      )}

      {/* Recipients */}
      <div className="space-y-2">
        <Label>Recipients *</Label>
        {formData.recipients.map((recipient, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={recipient}
              onChange={(e) => {
                const newRecipients = [...formData.recipients];
                newRecipients[index] = e.target.value;
                setFormData({ ...formData, recipients: newRecipients });
              }}
              placeholder="email@example.com"
            />
            {index > 0 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setFormData({
                    ...formData,
                    recipients: formData.recipients.filter((_, i) => i !== index),
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setFormData({ ...formData, recipients: [...formData.recipients, ""] })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Recipient
        </Button>
      </div>

      {/* Delivery format */}
      <div className="space-y-2">
        <Label htmlFor="deliveryFormat">Delivery Format *</Label>
        <Select
          value={formData.deliveryFormat}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onValueChange={(value: any) => setFormData({ ...formData, deliveryFormat: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="excel">Excel</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="all">All Formats</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Email subject */}
      <div className="space-y-2">
        <Label htmlFor="emailSubject">Email Subject</Label>
        <Input
          id="emailSubject"
          value={formData.emailSubject}
          onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
          placeholder="Weekly Report - {{date}}"
        />
        <p className="text-xs text-muted-foreground">
          Use variables: {`{{date}}`}, {`{{month}}`}, {`{{quarter}}`}
        </p>
      </div>

      {/* Email body */}
      <div className="space-y-2">
        <Label htmlFor="emailBody">Email Body</Label>
        <Textarea
          id="emailBody"
          value={formData.emailBody}
          onChange={(e) => setFormData({ ...formData, emailBody: e.target.value })}
          placeholder="Please find attached..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Create Schedule</Button>
      </div>
    </form>
  );
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function parseCronExpression(cron: string): string {
  const presets: Record<string, string> = {
    "0 8 * * *": "Daily at 8 AM",
    "0 8 * * 1": "Weekly on Monday",
    "0 8 1 * *": "Monthly on 1st",
    "0 8 1 1,4,7,10 *": "Quarterly",
  };
  return presets[cron] || cron;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

