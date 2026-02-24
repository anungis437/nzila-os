/**
 * Compliance Report Generator Component
 * 
 * Automated compliance reporting with:
 * - Report templates
 * - Schedule configuration
 * - Multi-format export
 * - Distribution lists
 * - Audit requirements
 * - Regulatory frameworks
 * 
 * @module components/compliance/compliance-report-generator
 */

"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  FileText,
  Download,
  Send,
  CheckCircle,
  Clock,
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const reportConfigSchema = z.object({
  name: z.string().min(1, "Report name is required"),
  reportType: z.enum(["gdpr", "data-retention", "security", "access", "custom"]),
  format: z.enum(["pdf", "csv", "json", "xlsx"]),
  schedule: z.enum(["once", "daily", "weekly", "monthly", "quarterly", "annual"]),
  recipients: z.array(z.object({
    email: z.string().email(),
    name: z.string(),
  })).min(1, "At least one recipient required"),
  includeCharts: z.boolean(),
  includeRawData: z.boolean(),
  includeSummary: z.boolean(),
});

type ReportConfig = z.infer<typeof reportConfigSchema>;

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: "gdpr" | "data-retention" | "security" | "access" | "custom";
  requiredFields: string[];
  framework?: string;
}

export interface GeneratedReport {
  id: string;
  name: string;
  type: string;
  format: string;
  generatedAt: Date;
  generatedBy: {
    id: string;
    name: string;
  };
  status: "generating" | "completed" | "failed";
  downloadUrl?: string;
  size?: string;
  recipients?: string[];
}

export interface ComplianceReportGeneratorProps {
  templates: ReportTemplate[];
  generatedReports: GeneratedReport[];
  onGenerateReport?: (config: ReportConfig) => Promise<void>;
  onDownloadReport?: (reportId: string) => void;
  onDeleteReport?: (reportId: string) => Promise<void>;
}

export function ComplianceReportGenerator({
  templates,
  generatedReports,
  onGenerateReport,
  onDownloadReport,
  onDeleteReport,
}: ComplianceReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [_selectedTemplate, setSelectedTemplate] = React.useState<ReportTemplate | null>(null);

  const form = useForm<ReportConfig>({
    resolver: zodResolver(reportConfigSchema),
    defaultValues: {
      name: "",
      reportType: "gdpr",
      format: "pdf",
      schedule: "once",
      recipients: [{ email: "", name: "" }],
      includeCharts: true,
      includeRawData: false,
      includeSummary: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "recipients",
  });

  const handleGenerate = async (data: ReportConfig) => {
    setIsGenerating(true);
    try {
      await onGenerateReport?.(data);
      form.reset();
    } finally {
      setIsGenerating(false);
    }
  };

  const reportTypeConfig = {
    gdpr: {
      label: "GDPR Compliance",
      description: "Data protection and privacy compliance report",
      framework: "GDPR",
    },
    "data-retention": {
      label: "Data Retention",
      description: "Current data retention status and policy adherence",
      framework: "Internal",
    },
    security: {
      label: "Security Audit",
      description: "Security events, access logs, and incidents",
      framework: "ISO 27001",
    },
    access: {
      label: "Access Control",
      description: "User access patterns and permissions audit",
      framework: "Internal",
    },
    custom: {
      label: "Custom Report",
      description: "Build a custom compliance report",
      framework: "Custom",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Compliance Report Generator
        </h2>
        <p className="text-gray-600 mt-1">
          Generate and schedule compliance reports
        </p>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList>
          <TabsTrigger value="generate">Generate Report</TabsTrigger>
          <TabsTrigger value="templates">
            Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            History ({generatedReports.length})
          </TabsTrigger>
        </TabsList>

        {/* Generate Report */}
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>New Report</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Report Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Q1 2024 GDPR Compliance Report" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="reportType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Report Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(reportTypeConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  <div>
                                    <div className="font-medium">{config.label}</div>
                                    <div className="text-xs text-gray-500">{config.framework}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                              <SelectItem value="pdf">PDF</SelectItem>
                              <SelectItem value="csv">CSV</SelectItem>
                              <SelectItem value="json">JSON</SelectItem>
                              <SelectItem value="xlsx">Excel</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="schedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="once">Generate Once</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How often this report should be generated
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Recipients</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ email: "", name: "" })}
                      >
                        Add Recipient
                      </Button>
                    </div>

                    {fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`recipients.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} placeholder="Name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-2">
                          <FormField
                            control={form.control}
                            name={`recipients.${index}.email`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Input {...field} type="email" placeholder="Email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <Label>Report Options</Label>
                    <FormField
                      control={form.control}
                      name="includeSummary"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Include Executive Summary</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="includeCharts"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Include Charts and Visualizations</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="includeRawData"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Include Raw Data Appendix</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={isGenerating}>
                    {isGenerating ? "Generating..." : "Generate Report"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates">
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{template.name}</h3>
                        {template.framework && (
                          <Badge variant="secondary">{template.framework}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                      {template.requiredFields.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {template.requiredFields.map((field) => (
                            <Badge key={field} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedTemplate(template);
                        form.setValue("reportType", template.type);
                      }}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              {generatedReports.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  No reports generated yet
                </div>
              ) : (
                <div className="divide-y">
                  {generatedReports.map((report) => (
                    <div key={report.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <h4 className="font-medium">{report.name}</h4>
                            <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                            <Badge
                              variant={
                                report.status === "completed"
                                  ? "default"
                                  : report.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {report.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                              {report.status === "generating" && <Clock className="h-3 w-3 mr-1" />}
                              {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                            </Badge>
                          </div>

                          <div className="text-sm text-gray-600">
                            Generated by {report.generatedBy.name} on{" "}
                            {format(report.generatedAt, "MMM d, yyyy 'at' h:mm a")}
                            {report.size && ` • ${report.size}`}
                          </div>

                          {report.recipients && report.recipients.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              <Send className="h-3 w-3 inline mr-1" />
                              Sent to: {report.recipients.join(", ")}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {report.status === "completed" && onDownloadReport && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onDownloadReport(report.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          )}
                          {onDeleteReport && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteReport(report.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

