/**
 * GDPR Data Export Component
 * 
 * Member data export with:
 * - Export request management
 * - Data collection from multiple sources
 * - Format options (JSON, CSV, XML)
 * - Secure download links
 * - Audit trail
 * - Compliance tracking
 * 
 * @module components/compliance/gdpr-data-export
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Download,
  FileJson,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Shield,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
 
import { format } from "date-fns";

const exportRequestSchema = z.object({
  format: z.enum(["json", "csv", "xml"]),
  includeProfile: z.boolean(),
  includeClaims: z.boolean(),
  includeDocuments: z.boolean(),
  includeMessages: z.boolean(),
  includePayments: z.boolean(),
  includeVotingHistory: z.boolean(),
  includeAuditLogs: z.boolean(),
});

type ExportRequest = z.infer<typeof exportRequestSchema>;

export interface ExportJob {
  id: string;
  memberId: string;
  memberName: string;
  status: "pending" | "processing" | "completed" | "failed";
  format: "json" | "csv" | "xml";
  requestedAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
  progress?: number;
  errorMessage?: string;
  dataCategories: string[];
}

export interface GdprDataExportProps {
  memberId: string;
  memberName: string;
  exportHistory: ExportJob[];
  onRequestExport?: (request: ExportRequest) => Promise<void>;
  onDownload?: (jobId: string) => void;
  onDeleteExport?: (jobId: string) => Promise<void>;
}

export function GdprDataExport({
  memberId: _memberId,
  memberName,
  exportHistory,
  onRequestExport,
  onDownload,
  onDeleteExport,
}: GdprDataExportProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ExportRequest>({
    resolver: zodResolver(exportRequestSchema),
    defaultValues: {
      format: "json",
      includeProfile: true,
      includeClaims: true,
      includeDocuments: true,
      includeMessages: true,
      includePayments: true,
      includeVotingHistory: false,
      includeAuditLogs: false,
    },
  });

  const handleSubmit = async (data: ExportRequest) => {
    setIsSubmitting(true);
    try {
      await onRequestExport?.(data);
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatIcon = (format: string) => {
    switch (format) {
      case "json":
        return <FileJson className="h-4 w-4" />;
      case "csv":
        return <FileText className="h-4 w-4" />;
      case "xml":
        return <FileText className="h-4 w-4" />;
      default:
        return <Download className="h-4 w-4" />;
    }
  };

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      label: "Pending",
    },
    processing: {
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      label: "Processing",
    },
    completed: {
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      label: "Completed",
    },
    failed: {
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      label: "Failed",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            GDPR Data Export
          </h2>
          <p className="text-gray-600 mt-1">
            Request and download personal data for {memberName}
          </p>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>GDPR Compliance:</strong> Member data will be compiled according to Article 15
          (Right of Access) and Article 20 (Right to Data Portability) of the GDPR. Export links
          expire after 7 days for security.
        </AlertDescription>
      </Alert>

      {/* New Export Request */}
      <Card>
        <CardHeader>
          <CardTitle>New Export Request</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Export Format</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="json">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" />
                            JSON (Machine-readable)
                          </div>
                        </SelectItem>
                        <SelectItem value="csv">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            CSV (Spreadsheet)
                          </div>
                        </SelectItem>
                        <SelectItem value="xml">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            XML (Structured data)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the format for the exported data
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormLabel>Data Categories to Include</FormLabel>

                <FormField
                  control={form.control}
                  name="includeProfile"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">
                        Profile Information (name, contact details, membership data)
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeClaims"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Claims History</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeDocuments"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Uploaded Documents</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeMessages"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Messages & Communications</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includePayments"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Payment History</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeVotingHistory"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Voting History (anonymized)</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeAuditLogs"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Audit Logs (access history)</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Requesting..." : "Request Export"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
        </CardHeader>
        <CardContent>
          {exportHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No export requests yet</div>
          ) : (
            <div className="space-y-4">
              {exportHistory.map((job) => {
                const config = statusConfig[job.status];
                const StatusIcon = config.icon;

                return (
                  <div key={job.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {formatIcon(job.format)}
                          <span className="font-medium uppercase">{job.format}</span>
                          <Badge variant="outline" className={config.bgColor}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${config.color}`} />
                            {config.label}
                          </Badge>
                        </div>

                        <div className="text-sm text-gray-600 mb-2">
                          Requested: {format(job.requestedAt, "MMM d, yyyy 'at' h:mm a")}
                          {job.completedAt && (
                            <span> • Completed: {format(job.completedAt, "MMM d, yyyy 'at' h:mm a")}</span>
                          )}
                        </div>

                        {job.dataCategories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {job.dataCategories.map((category) => (
                              <Badge key={category} variant="secondary" className="text-xs">
                                {category}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {job.status === "processing" && typeof job.progress === "number" && (
                          <div className="mt-2">
                            <Progress value={job.progress} className="h-2" />
                            <p className="text-xs text-gray-500 mt-1">{job.progress}% complete</p>
                          </div>
                        )}

                        {job.status === "failed" && job.errorMessage && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertDescription>{job.errorMessage}</AlertDescription>
                          </Alert>
                        )}

                        {job.status === "completed" && job.downloadUrl && job.expiresAt && (
                          <Alert className="mt-2">
                            <Download className="h-4 w-4" />
                            <AlertDescription>
                              Download available until {format(job.expiresAt, "MMM d, yyyy")}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {job.status === "completed" && job.downloadUrl && onDownload && (
                          <Button variant="outline" size="sm" onClick={() => onDownload(job.id)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        )}
                        {onDeleteExport && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteExport(job.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

