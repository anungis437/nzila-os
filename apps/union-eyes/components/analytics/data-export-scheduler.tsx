/**
 * Data Export Scheduler Component
 * 
 * Automated data export scheduling with:
 * - Schedule configuration (daily/weekly/monthly)
 * - Format selection (CSV/Excel/PDF)
 * - Email delivery
 * - FTP upload support
 * - Retention settings
 * - Export history
 * 
 * @module components/analytics/data-export-scheduler
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
 
import {
  Calendar,
  Clock,
  Mail,
  Download,
  FileText,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Upload as _Upload,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

const exportScheduleSchema = z.object({
  name: z.string().min(1, "Schedule name is required"),
  dataSource: z.string().min(1, "Data source is required"),
  frequency: z.enum(["once", "daily", "weekly", "monthly"]),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  time: z.string().min(1, "Time is required"),
  format: z.enum(["csv", "xlsx", "pdf", "json"]),
  deliveryMethod: z.enum(["download", "email", "ftp", "both"]),
  emailRecipients: z.array(z.string().email()).optional(),
  ftpHost: z.string().optional(),
  ftpPort: z.number().optional(),
  ftpUsername: z.string().optional(),
  ftpPath: z.string().optional(),
  retentionDays: z.number().min(1).max(365),
  includeHeaders: z.boolean(),
  compress: z.boolean(),
  enabled: z.boolean(),
});

type ExportScheduleData = z.infer<typeof exportScheduleSchema>;

interface ScheduledExport {
  id: string;
  name: string;
  dataSource: string;
  frequency: string;
  nextRun: Date;
  lastRun?: Date;
  status: "active" | "paused" | "failed";
  format: string;
  deliveryMethod: string;
}

interface ExportHistory {
  id: string;
  scheduleName: string;
  executedAt: Date;
  status: "success" | "failed";
  recordCount: number;
  fileSize: string;
  downloadUrl?: string;
  error?: string;
}

const DATA_SOURCES = [
  { value: "members", label: "Members" },
  { value: "claims", label: "Claims" },
  { value: "training", label: "Training" },
  { value: "voting", label: "Voting & Elections" },
  { value: "documents", label: "Documents" },
  { value: "financial", label: "Financial Data" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export interface DataExportSchedulerProps {
  schedules?: ScheduledExport[];
  history?: ExportHistory[];
  onSave?: (schedule: ExportScheduleData) => Promise<void>;
  onToggle?: (scheduleId: string, enabled: boolean) => Promise<void>;
  onDelete?: (scheduleId: string) => Promise<void>;
  onRunNow?: (scheduleId: string) => Promise<void>;
}

export function DataExportScheduler({
  schedules = [],
  history = [],
  onSave,
  onToggle,
  onDelete,
  onRunNow,
}: DataExportSchedulerProps) {
  const [activeTab, setActiveTab] = React.useState<"create" | "schedules" | "history">("create");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ExportScheduleData>({
    resolver: zodResolver(exportScheduleSchema),
    defaultValues: {
      name: "",
      dataSource: "",
      frequency: "daily",
      time: "09:00",
      format: "csv",
      deliveryMethod: "email",
      emailRecipients: [],
      retentionDays: 30,
      includeHeaders: true,
      compress: false,
      enabled: true,
    },
  });

  const frequency = form.watch("frequency");
  const deliveryMethod = form.watch("deliveryMethod");

  const handleSave = async (data: ExportScheduleData) => {
    setIsSubmitting(true);
    try {
      await onSave?.(data);
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ScheduledExport["status"]) => {
    const config = {
      active: { color: "bg-green-100 text-green-800", label: "Active" },
      paused: { color: "bg-gray-100 text-gray-800", label: "Paused" },
      failed: { color: "bg-red-100 text-red-800", label: "Failed" },
    };
    return <Badge className={config[status].color}>{config[status].label}</Badge>;
  };

  const getExecutionStatusBadge = (status: ExportHistory["status"]) => {
    if (status === "success") {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Data Export Scheduler
        </h2>
        <p className="text-gray-600 mt-1">
          Schedule automated data exports with custom delivery options
        </p>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="create">Create Schedule</TabsTrigger>
          <TabsTrigger value="schedules">
            Active Schedules ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="history">Export History</TabsTrigger>
        </TabsList>

        {/* Create Schedule Tab */}
        <TabsContent value="create">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
              {/* Basic Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Export Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Schedule Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Monthly Member Report" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dataSource"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Source</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select data source" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DATA_SOURCES.map((source) => (
                                <SelectItem key={source.value} value={source.value}>
                                  {source.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                              <SelectItem value="csv">CSV</SelectItem>
                              <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                              <SelectItem value="pdf">PDF</SelectItem>
                              <SelectItem value="json">JSON</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="retentionDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retention (Days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Files older than this will be deleted
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Schedule Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="once">One Time</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {frequency === "weekly" && (
                      <FormField
                        control={form.control}
                        name="dayOfWeek"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Day of Week</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(parseInt(v))}
                              defaultValue={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DAYS_OF_WEEK.map((day) => (
                                  <SelectItem key={day.value} value={day.value.toString()}>
                                    {day.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {frequency === "monthly" && (
                      <FormField
                        control={form.control}
                        name="dayOfMonth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Day of Month</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={31}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Delivery Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="deliveryMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="download">Download Only</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="ftp">FTP Upload</SelectItem>
                            <SelectItem value="both">Email + FTP</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(deliveryMethod === "email" || deliveryMethod === "both") && (
                    <FormField
                      control={form.control}
                      name="emailRecipients"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Recipients</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="email1@example.com, email2@example.com"
                              onChange={(e) => {
                                const emails = e.target.value
                                  .split(",")
                                  .map((email) => email.trim());
                                field.onChange(emails);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Comma-separated email addresses
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {(deliveryMethod === "ftp" || deliveryMethod === "both") && (
                    <div className="space-y-4 border rounded-lg p-4">
                      <h4 className="font-semibold text-sm">FTP Configuration</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="ftpHost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>FTP Host</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="ftp.example.com" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="ftpPort"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Port</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  placeholder="21"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="ftpUsername"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="ftpPath"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Upload Path</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="/exports" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Options */}
              <Card>
                <CardHeader>
                  <CardTitle>Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <FormField
                    control={form.control}
                    name="includeHeaders"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">Include column headers</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="compress"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">Compress as ZIP file</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between border rounded-lg p-3">
                        <FormLabel className="!mt-0">Enable schedule immediately</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  <Calendar className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Creating..." : "Create Schedule"}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* Active Schedules Tab */}
        <TabsContent value="schedules">
          <Card>
            <CardHeader>
              <CardTitle>Active Export Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No scheduled exports yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Data Source</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Next Run</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">{schedule.name}</TableCell>
                        <TableCell>{schedule.dataSource}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{schedule.frequency}</Badge>
                        </TableCell>
                        <TableCell>{schedule.nextRun.toLocaleString()}</TableCell>
                        <TableCell>
                          {schedule.lastRun
                            ? schedule.lastRun.toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onRunNow?.(schedule.id)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onToggle?.(schedule.id, schedule.status !== "active")}
                            >
                              {schedule.status === "active" ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDelete?.(schedule.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Export History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No export history yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Executed At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>File Size</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.scheduleName}</TableCell>
                        <TableCell>{item.executedAt.toLocaleString()}</TableCell>
                        <TableCell>{getExecutionStatusBadge(item.status)}</TableCell>
                        <TableCell>{item.recordCount.toLocaleString()}</TableCell>
                        <TableCell>{item.fileSize}</TableCell>
                        <TableCell>
                          {item.downloadUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={item.downloadUrl} download>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

