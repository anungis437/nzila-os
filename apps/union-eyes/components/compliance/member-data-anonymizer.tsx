/**
 * Member Data Anonymizer Component
 * 
 * Data anonymization tool with:
 * - Field selection
 * - Anonymization methods
 * - Preview capabilities
 * - Batch processing
 * - Reversibility options
 * - Audit trail
 * 
 * @module components/compliance/member-data-anonymizer
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  UserX,
  Eye,
  AlertTriangle,
  CheckCircle,
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
 
import { Textarea } from "@/components/ui/textarea";

const anonymizationSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
  method: z.enum(["mask", "hash", "randomize", "delete"]),
  fields: z.array(z.string()).min(1, "Select at least one field"),
  preserveStructure: z.boolean(),
  createBackup: z.boolean(),
});

type AnonymizationConfig = z.infer<typeof anonymizationSchema>;

export interface DataField {
  name: string;
  label: string;
  category: "personal" | "contact" | "financial" | "sensitive";
  currentValue: string;
  required: boolean;
}

export interface AnonymizationPreview {
  field: string;
  original: string;
  anonymized: string;
  method: string;
}

export interface AnonymizationJob {
  id: string;
  memberId: string;
  memberName: string;
  status: "pending" | "processing" | "completed" | "failed";
  method: string;
  fieldsCount: number;
  progress?: number;
  createdAt: Date;
  completedAt?: Date;
  createdBy: {
    id: string;
    name: string;
  };
  reason: string;
  reversible: boolean;
}

export interface MemberDataAnonymizerProps {
  memberId: string;
  memberName: string;
  fields: DataField[];
  jobs: AnonymizationJob[];
  onAnonymize?: (config: AnonymizationConfig) => Promise<void>;
  onPreview?: (config: AnonymizationConfig) => Promise<AnonymizationPreview[]>;
  onReverse?: (jobId: string) => Promise<void>;
}

export function MemberDataAnonymizer({
  memberId: _memberId,
  memberName,
  fields,
  jobs,
  onAnonymize,
  onPreview,
  onReverse,
}: MemberDataAnonymizerProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [preview, setPreview] = React.useState<AnonymizationPreview[]>([]);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const form = useForm<AnonymizationConfig>({
    resolver: zodResolver(anonymizationSchema),
    defaultValues: {
      reason: "",
      method: "mask",
      fields: [],
      preserveStructure: true,
      createBackup: true,
    },
  });

  const fieldsByCategory = fields.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, DataField[]>);

  const categoryConfig = {
    personal: {
      label: "Personal Information",
      color: "bg-blue-100 text-blue-800",
      icon: UserX,
    },
    contact: {
      label: "Contact Details",
      color: "bg-green-100 text-green-800",
      icon: UserX,
    },
    financial: {
      label: "Financial Data",
      color: "bg-purple-100 text-purple-800",
      icon: UserX,
    },
    sensitive: {
      label: "Sensitive Information",
      color: "bg-red-100 text-red-800",
      icon: Shield,
    },
  };

  const methodDescriptions = {
    mask: "Replace characters with asterisks (e.g., j***@email.com)",
    hash: "Convert to irreversible hash value",
    randomize: "Replace with realistic fake data",
    delete: "Permanently remove data",
  };

  const handlePreview = async () => {
    const data = form.getValues();
    if (data.fields.length === 0) return;

    try {
      const previewData = await onPreview?.(data);
      if (previewData) {
        setPreview(previewData);
        setShowPreview(true);
      }
    } catch (_error) {
}
  };

  const handleAnonymize = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      await onAnonymize?.(form.getValues());
      form.reset();
      setPreview([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleField = (fieldName: string) => {
    const current = form.getValues("fields");
    if (current.includes(fieldName)) {
      form.setValue(
        "fields",
        current.filter((f) => f !== fieldName)
      );
    } else {
      form.setValue("fields", [...current, fieldName]);
    }
  };

  const toggleCategory = (category: string) => {
    const categoryFields = fieldsByCategory[category] || [];
    const fieldNames = categoryFields.map((f) => f.name);
    const current = form.getValues("fields");

    const allSelected = fieldNames.every((name) => current.includes(name));

    if (allSelected) {
      form.setValue(
        "fields",
        current.filter((f) => !fieldNames.includes(f))
      );
    } else {
      const newFields = [...new Set([...current, ...fieldNames])];
      form.setValue("fields", newFields);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <UserX className="h-6 w-6" />
          Data Anonymization
        </h2>
        <p className="text-gray-600 mt-1">
          Anonymize personal data for {memberName}
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Warning:</strong> Data anonymization may be irreversible depending on the
          method chosen. Always create a backup before proceeding.
        </AlertDescription>
      </Alert>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Anonymization Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Anonymization</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="e.g., Member requested data deletion under GDPR Article 17"
                      />
                    </FormControl>
                    <FormDescription>
                      Document the legal or business reason for this action
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anonymization Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(methodDescriptions).map(([key, description]) => (
                          <SelectItem key={key} value={key}>
                            <div>
                              <div className="font-medium capitalize">{key}</div>
                              <div className="text-xs text-gray-500">{description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormLabel>Select Fields to Anonymize</FormLabel>
                {Object.entries(fieldsByCategory).map(([category, categoryFields]) => {
                  const config = categoryConfig[category as keyof typeof categoryConfig];
                  const selectedFields = form.watch("fields");
                  const allSelected = categoryFields.every((f) =>
                    selectedFields.includes(f.name)
                  );

                  return (
                    <div key={category} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleCategory(category)}
                          />
                          <Label className="font-medium">{config.label}</Label>
                          <Badge variant="secondary" className={config.color}>
                            {categoryFields.length}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2 ml-6">
                        {categoryFields.map((field) => (
                          <div key={field.name} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={selectedFields.includes(field.name)}
                                onCheckedChange={() => toggleField(field.name)}
                                disabled={field.required}
                              />
                              <Label className="text-sm">
                                {field.label}
                                {field.required && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Required
                                  </Badge>
                                )}
                              </Label>
                            </div>
                            <span className="text-sm text-gray-500">
                              {field.currentValue}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="preserveStructure"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div>
                        <FormLabel className="!mt-0">Preserve Data Structure</FormLabel>
                        <FormDescription className="text-xs">
                          Maintain format (e.g., email structure, phone number format)
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="createBackup"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div>
                        <FormLabel className="!mt-0">Create Backup</FormLabel>
                        <FormDescription className="text-xs">
                          Store encrypted backup for potential reversal
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={form.watch("fields").length === 0}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  disabled={form.watch("fields").length === 0 || !form.watch("reason")}
                >
                  Anonymize Data
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader>
          <CardTitle>Anonymization History</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No anonymization jobs yet
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "default"
                              : job.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {job.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </Badge>
                        <span className="text-sm font-medium capitalize">{job.method}</span>
                        <Badge variant="outline">{job.fieldsCount} fields</Badge>
                      </div>

                      <p className="text-sm text-gray-600 mb-2">{job.reason}</p>

                      <div className="text-xs text-gray-500">
                        By {job.createdBy.name} on{" "}
                        {job.createdAt.toLocaleDateString()}
                        {job.completedAt && (
                          <span> â€¢ Completed {job.completedAt.toLocaleDateString()}</span>
                        )}
                      </div>

                      {job.status === "processing" && typeof job.progress === "number" && (
                        <div className="mt-2">
                          <Progress value={job.progress} className="h-2" />
                          <p className="text-xs text-gray-500 mt-1">{job.progress}% complete</p>
                        </div>
                      )}
                    </div>

                    {job.reversible && job.status === "completed" && onReverse && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onReverse(job.id)}
                      >
                        Reverse
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Anonymization Preview</DialogTitle>
            <DialogDescription>
              Review how the data will be anonymized before applying changes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {preview.map((item, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="font-medium text-sm mb-1">{item.field}</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-gray-600">Original</Label>
                    <div className="font-mono">{item.original}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Anonymized ({item.method})</Label>
                    <div className="font-mono">{item.anonymized}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Anonymization</DialogTitle>
            <DialogDescription>
              This action will anonymize {form.watch("fields").length} fields for {memberName}.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This action may be irreversible depending on your
              settings. Ensure you have reviewed the preview.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleAnonymize} disabled={isSubmitting}>
              {isSubmitting ? "Anonymizing..." : "Confirm Anonymization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

