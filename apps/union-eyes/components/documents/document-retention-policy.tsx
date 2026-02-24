/**
 * Document Retention Policy Component
 * 
 * Data retention management with:
 * - Policy configuration
 * - Retention rules
 * - Automatic archival
 * - Legal holds
 * - Audit logging
 * - Compliance reporting
 * 
 * @module components/documents/document-retention-policy
 */

"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
 
import {
  Clock,
  Archive as _Archive,
  Lock,
  AlertTriangle,
  Plus,
  Trash2,
  FileText,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
 
import { format } from "date-fns";

const retentionRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Rule name is required"),
  category: z.string().min(1, "Category is required"),
  retentionPeriod: z.number().min(1, "Retention period is required"),
  retentionUnit: z.enum(["days", "months", "years"]),
  action: z.enum(["archive", "delete", "review"]),
  enabled: z.boolean(),
  description: z.string().optional(),
});

const policySchema = z.object({
  rules: z.array(retentionRuleSchema).min(1, "At least one rule is required"),
  autoEnforce: z.boolean(),
  notifyBeforeAction: z.boolean(),
  notificationDays: z.number().min(1),
});

type _RetentionRule = z.infer<typeof retentionRuleSchema>;
type PolicyConfig = z.infer<typeof policySchema>;

export interface LegalHold {
  id: string;
  documentId: string;
  documentName: string;
  reason: string;
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: Date;
  expiresAt?: Date;
  status: "active" | "released";
}

export interface RetentionStats {
  totalDocuments: number;
  documentsUnderRetention: number;
  documentsOnHold: number;
  scheduledForArchival: number;
  scheduledForDeletion: number;
}

export interface DocumentRetentionPolicyProps {
  existingPolicy?: PolicyConfig;
  legalHolds: LegalHold[];
  stats: RetentionStats;
  categories: string[];
  onSavePolicy?: (policy: PolicyConfig) => Promise<void>;
  onCreateHold?: (documentId: string, reason: string) => Promise<void>;
  onReleaseHold?: (holdId: string) => Promise<void>;
  onExecuteRetention?: () => Promise<void>;
}

export function DocumentRetentionPolicy({
  existingPolicy,
  legalHolds,
  stats,
  categories,
  onSavePolicy,
  onCreateHold: _onCreateHold,
  onReleaseHold,
  onExecuteRetention,
}: DocumentRetentionPolicyProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PolicyConfig>({
    resolver: zodResolver(policySchema),
    defaultValues: existingPolicy || {
      rules: [
        {
          name: "General Documents",
          category: "general",
          retentionPeriod: 7,
          retentionUnit: "years",
          action: "archive",
          enabled: true,
          description: "Standard retention for general documents",
        },
      ],
      autoEnforce: true,
      notifyBeforeAction: true,
      notificationDays: 7,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rules",
  });

  const handleSave = async (data: PolicyConfig) => {
    setIsSubmitting(true);
    try {
      await onSavePolicy?.(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeHolds = legalHolds.filter((h) => h.status === "active");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Document Retention Policy</h2>
        <p className="text-gray-600 mt-1">
          Manage document lifecycle and compliance requirements
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <div className="text-sm text-gray-600">Total Documents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-blue-600">
              {stats.documentsUnderRetention}
            </div>
            <div className="text-sm text-gray-600">Under Retention</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-orange-600">
              {stats.documentsOnHold}
            </div>
            <div className="text-sm text-gray-600">Legal Holds</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-purple-600">
              {stats.scheduledForArchival}
            </div>
            <div className="text-sm text-gray-600">To Archive</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-red-600">
              {stats.scheduledForDeletion}
            </div>
            <div className="text-sm text-gray-600">To Delete</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules" className="w-full">
        <TabsList>
          <TabsTrigger value="rules">Retention Rules</TabsTrigger>
          <TabsTrigger value="holds">Legal Holds ({activeHolds.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Retention Rules */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Retention Rules
                </CardTitle>
                {onExecuteRetention && (
                  <Button onClick={onExecuteRetention} variant="outline">
                    Execute Retention
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">Rule {index + 1}</h4>
                            <FormField
                              control={form.control}
                              name={`rules.${index}.enabled`}
                              render={({ field }) => (
                                <Badge variant={field.value ? "default" : "secondary"}>
                                  {field.value ? "Enabled" : "Disabled"}
                                </Badge>
                              )}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`rules.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rule Name</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="e.g., Legal Documents" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`rules.${index}.category`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {categories.map((category) => (
                                      <SelectItem key={category} value={category}>
                                        {category}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name={`rules.${index}.retentionPeriod`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Retention Period</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`rules.${index}.retentionUnit`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="days">Days</SelectItem>
                                    <SelectItem value="months">Months</SelectItem>
                                    <SelectItem value="years">Years</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`rules.${index}.action`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Action</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="archive">Archive</SelectItem>
                                    <SelectItem value="delete">Delete</SelectItem>
                                    <SelectItem value="review">Review</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`rules.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Textarea {...field} rows={2} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`rules.${index}.enabled`}
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="!mt-0">Enable this rule</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      append({
                        name: "",
                        category: categories[0] || "general",
                        retentionPeriod: 1,
                        retentionUnit: "years",
                        action: "archive",
                        enabled: true,
                        description: "",
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Policy"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legal Holds */}
        <TabsContent value="holds">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h5 w-5" />
                Legal Holds
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeHolds.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  No active legal holds
                </div>
              ) : (
                <div className="space-y-4">
                  {activeHolds.map((hold) => (
                    <div key={hold.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <h4 className="font-medium">{hold.documentName}</h4>
                            <Badge variant="destructive">On Hold</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{hold.reason}</p>
                          <div className="text-xs text-gray-500">
                            Created by {hold.createdBy.name} on{" "}
                            {format(hold.createdAt, "MMM d, yyyy")}
                            {hold.expiresAt && (
                              <span> • Expires {format(hold.expiresAt, "MMM d, yyyy")}</span>
                            )}
                          </div>
                        </div>
                        {onReleaseHold && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onReleaseHold(hold.id)}
                          >
                            Release Hold
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Policy Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="autoEnforce"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Automatic Enforcement</FormLabel>
                          <FormDescription>
                            Automatically execute retention actions when rules trigger
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notifyBeforeAction"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Notify Before Action</FormLabel>
                          <FormDescription>
                            Send notifications before archiving or deleting documents
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("notifyBeforeAction") && (
                    <FormField
                      control={form.control}
                      name="notificationDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notification Days Before Action</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            How many days before the action to send notifications
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> Documents under legal hold will not be affected
                      by retention policies until the hold is released.
                    </AlertDescription>
                  </Alert>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Settings"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

