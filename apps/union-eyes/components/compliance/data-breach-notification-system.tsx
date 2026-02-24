/**
 * Data Breach Notification System Component
 * 
 * Breach management with:
 * - Incident reporting
 * - Impact assessment
 * - Notification templates
 * - Affected party tracking
 * - Regulatory reporting
 * - Timeline management
 * 
 * @module components/compliance/data-breach-notification-system
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  AlertTriangle,
  Send,
  Clock,
  Shield,
  Mail,
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
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 
import { format, differenceInHours } from "date-fns";

const breachReportSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  discoveredAt: z.string(),
  dataTypes: z.array(z.string()).min(1, "Select at least one data type"),
  estimatedAffected: z.number().min(0),
  containmentStatus: z.enum(["ongoing", "contained", "resolved"]),
  notifyAuthorities: z.boolean(),
  notifyIndividuals: z.boolean(),
});

type BreachReport = z.infer<typeof breachReportSchema>;

export interface BreachIncident {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "reported" | "investigating" | "contained" | "resolved";
  discoveredAt: Date;
  reportedAt: Date;
  resolvedAt?: Date;
  dataTypes: string[];
  affectedCount: number;
  notificationsSent: number;
  authoritiesNotified: boolean;
  reportedBy: {
    id: string;
    name: string;
  };
  timeline: {
    timestamp: Date;
    action: string;
    user: string;
  }[];
}

export interface NotificationStatus {
  type: "individual" | "authority" | "third-party";
  recipient: string;
  status: "pending" | "sent" | "failed" | "acknowledged";
  sentAt?: Date;
  acknowledgedAt?: Date;
}

export interface DataBreachNotificationSystemProps {
  incidents: BreachIncident[];
  notifications: Record<string, NotificationStatus[]>;
  onReportBreach?: (report: BreachReport) => Promise<void>;
  onSendNotifications?: (incidentId: string, type: string) => Promise<void>;
  onUpdateStatus?: (incidentId: string, status: string) => Promise<void>;
}

export function DataBreachNotificationSystem({
  incidents,
  notifications,
  onReportBreach,
  onSendNotifications,
  onUpdateStatus: _onUpdateStatus,
}: DataBreachNotificationSystemProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedIncident, setSelectedIncident] = React.useState<BreachIncident | null>(null);

  const form = useForm<BreachReport>({
    resolver: zodResolver(breachReportSchema),
    defaultValues: {
      title: "",
      description: "",
      severity: "medium",
      discoveredAt: new Date().toISOString().slice(0, 16),
      dataTypes: [],
      estimatedAffected: 0,
      containmentStatus: "ongoing",
      notifyAuthorities: false,
      notifyIndividuals: false,
    },
  });

  const handleSubmit = async (data: BreachReport) => {
    setIsSubmitting(true);
    try {
      await onReportBreach?.(data);
      form.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const severityConfig = {
    low: {
      color: "bg-blue-100 text-blue-800",
      label: "Low",
      description: "Minimal impact, low risk",
    },
    medium: {
      color: "bg-yellow-100 text-yellow-800",
      label: "Medium",
      description: "Moderate impact, requires attention",
    },
    high: {
      color: "bg-orange-100 text-orange-800",
      label: "High",
      description: "Significant impact, urgent action needed",
    },
    critical: {
      color: "bg-red-100 text-red-800",
      label: "Critical",
      description: "Severe impact, immediate action required",
    },
  };

  const statusConfig = {
    reported: { color: "bg-gray-100 text-gray-800", label: "Reported" },
    investigating: { color: "bg-blue-100 text-blue-800", label: "Investigating" },
    contained: { color: "bg-yellow-100 text-yellow-800", label: "Contained" },
    resolved: { color: "bg-green-100 text-green-800", label: "Resolved" },
  };

  const dataTypeOptions = [
    "Personal Identifiable Information (PII)",
    "Financial Data",
    "Health Records",
    "Login Credentials",
    "Payment Information",
    "Contact Information",
    "Employment Records",
    "Social Security Numbers",
    "Other Sensitive Data",
  ];

  const activeIncident = selectedIncident || incidents[0];
  const incidentNotifications = activeIncident ? notifications[activeIncident.id] || [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          Data Breach Notification System
        </h2>
        <p className="text-gray-600 mt-1">
          Report and manage data security incidents
        </p>
      </div>

      {/* Critical Alert for 72-hour deadline */}
      {incidents.some(
        (i) =>
          i.status !== "resolved" &&
          differenceInHours(new Date(), i.discoveredAt) > 60 &&
          !i.authoritiesNotified
      ) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>GDPR Compliance Alert:</strong> Unreported breaches approaching 72-hour
            notification deadline. Authorities must be notified immediately.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={incidents.length > 0 ? "incidents" : "report"} className="w-full">
        <TabsList>
          <TabsTrigger value="report">Report Breach</TabsTrigger>
          <TabsTrigger value="incidents">
            Incidents ({incidents.length})
          </TabsTrigger>
          {activeIncident && (
            <TabsTrigger value="notifications">
              Notifications ({incidentNotifications.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Report Breach */}
        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle>Report Data Breach</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Incident Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Unauthorized Database Access" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={4}
                            placeholder="Provide detailed information about the incident..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="severity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Severity Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(severityConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  <div>
                                    <div className="font-medium">{config.label}</div>
                                    <div className="text-xs text-gray-500">{config.description}</div>
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
                      name="discoveredAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discovery Date & Time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="dataTypes"
                    render={() => (
                      <FormItem>
                        <FormLabel>Affected Data Types</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {dataTypeOptions.map((type) => (
                            <FormField
                              key={type}
                              control={form.control}
                              name="dataTypes"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(type)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        const updated = checked
                                          ? [...current, type]
                                          : current.filter((v) => v !== type);
                                        field.onChange(updated);
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal !mt-0">{type}</FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="estimatedAffected"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Affected Individuals</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="containmentStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Containment Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ongoing">Ongoing</SelectItem>
                              <SelectItem value="contained">Contained</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <FormLabel>Required Actions</FormLabel>
                    <FormField
                      control={form.control}
                      name="notifyAuthorities"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div>
                            <FormLabel className="!mt-0">Notify Regulatory Authorities</FormLabel>
                            <FormDescription className="text-xs">
                              Required within 72 hours of discovery under GDPR
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notifyIndividuals"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div>
                            <FormLabel className="!mt-0">Notify Affected Individuals</FormLabel>
                            <FormDescription className="text-xs">
                              Required when breach poses high risk to rights and freedoms
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Report"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incidents */}
        <TabsContent value="incidents">
          <div className="space-y-4">
            {incidents.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-gray-600">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No data breaches reported</p>
                </CardContent>
              </Card>
            ) : (
              incidents.map((incident) => {
                const hoursElapsed = differenceInHours(new Date(), incident.discoveredAt);
                const deadline72 = 72 - hoursElapsed;

                return (
                  <Card key={incident.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{incident.title}</h3>
                            <Badge className={severityConfig[incident.severity].color}>
                              {severityConfig[incident.severity].label}
                            </Badge>
                            <Badge className={statusConfig[incident.status].color}>
                              {statusConfig[incident.status].label}
                            </Badge>
                          </div>

                          <p className="text-sm text-gray-600 mb-3">{incident.description}</p>

                          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-gray-600">Discovered:</span>{" "}
                              {format(incident.discoveredAt, "MMM d, yyyy h:mm a")}
                            </div>
                            <div>
                              <span className="text-gray-600">Affected:</span>{" "}
                              <span className="font-medium">{incident.affectedCount} individuals</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Notifications:</span>{" "}
                              <span className="font-medium">{incident.notificationsSent} sent</span>
                            </div>
                          </div>

                          {!incident.authoritiesNotified && deadline72 > 0 && deadline72 < 48 && (
                            <Alert variant="destructive" className="mb-3">
                              <Clock className="h-4 w-4" />
                              <AlertDescription>
                                <strong>{Math.floor(deadline72)} hours remaining</strong> to notify
                                authorities under GDPR
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="flex flex-wrap gap-1">
                            {incident.dataTypes.map((type) => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedIncident(incident)}
                          >
                            View Details
                          </Button>
                          {onSendNotifications && (
                            <Button size="sm" onClick={() => onSendNotifications(incident.id, "all")}>
                              <Send className="h-4 w-4 mr-2" />
                              Send Notifications
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Status</CardTitle>
            </CardHeader>
            <CardContent>
              {incidentNotifications.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  No notifications sent for this incident
                </div>
              ) : (
                <div className="space-y-3">
                  {incidentNotifications.map((notification, index) => (
                    <div key={index} className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{notification.recipient}</div>
                          <div className="text-xs text-gray-500 capitalize">{notification.type}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {notification.sentAt && (
                          <span className="text-xs text-gray-500">
                            {format(notification.sentAt, "MMM d, h:mm a")}
                          </span>
                        )}
                        <Badge
                          variant={
                            notification.status === "sent" || notification.status === "acknowledged"
                              ? "default"
                              : notification.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {notification.status}
                        </Badge>
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

