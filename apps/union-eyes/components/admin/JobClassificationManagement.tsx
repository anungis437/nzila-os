/**
 * Job Classification Management Component
 * 
 * Phase 1.2: Member Profile v2 - Employment Attributes
 * 
 * Features:
 * - Create/update job classifications
 * - Define wage tiers (min/max/standard rates)
 * - Associate with bargaining units
 * - Track effective dates and expiry
 * 
 * @module components/admin/JobClassificationManagement
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { createJobClassificationSchema } from "@/lib/validation/member-employment-schemas";
import {
  createJobClassificationAction,
  getJobClassificationsByOrganizationAction,
  updateJobClassificationAction,
} from "@/actions/member-employment-actions";

// TYPES
// =============================================================================

interface JobClassification {
  id: string;
  organizationId: string;
  jobTitle: string;
  jobCode: string;
  description?: string | null;
  bargainingUnitId?: string | null;
  minimumRate?: string | null;
  maximumRate?: string | null;
  standardRate?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  isActive?: boolean | null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface JobClassificationManagementProps {
  organizationId: string;
  bargainingUnitId?: string;
}

export default function JobClassificationManagement({ 
  organizationId, 
  bargainingUnitId 
}: JobClassificationManagementProps) {
  const { toast } = useToast();
  const [classifications, setClassifications] = useState<JobClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClassification, setEditingClassification] = useState<JobClassification | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  const loadClassifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getJobClassificationsByOrganizationAction(organizationId, activeOnly);
      if (result.isSuccess && Array.isArray(result.data)) {
        const filtered = bargainingUnitId 
          ? result.data.filter((c: JobClassification) => c.bargainingUnitId === bargainingUnitId)
          : result.data;
        setClassifications(filtered);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load classifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, activeOnly, bargainingUnitId, toast]);

  useEffect(() => {
    loadClassifications();
  }, [loadClassifications]);

  const handleCreate = () => {
    setEditingClassification(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (classification: JobClassification) => {
    setEditingClassification(classification);
    setIsDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setIsDialogOpen(false);
    setEditingClassification(null);
    if (refresh) {
      loadClassifications();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Job Classifications</h2>
          <p className="text-muted-foreground">Manage job titles and wage tiers</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Classification
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="text-sm font-medium">Filter</label>
              <Select value={activeOnly ? "active" : "all"} onValueChange={(v) => setActiveOnly(v === "active")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="all">All Classifications</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Classifications</CardTitle>
          <CardDescription>{classifications.length} total records</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : classifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No job classifications found</p>
              <Button variant="link" onClick={handleCreate}>
                Create the first classification
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Min Rate</TableHead>
                  <TableHead>Standard Rate</TableHead>
                  <TableHead>Max Rate</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classifications.map((classification) => (
                  <TableRow key={classification.id}>
                    <TableCell className="font-medium">{classification.jobTitle}</TableCell>
                    <TableCell>{classification.jobCode}</TableCell>
                    <TableCell>${classification.minimumRate || "-"}</TableCell>
                    <TableCell>${classification.standardRate || "-"}</TableCell>
                    <TableCell>${classification.maximumRate || "-"}</TableCell>
                    <TableCell>{classification.effectiveDate || "-"}</TableCell>
                    <TableCell>
                      {classification.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(classification)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <ClassificationFormDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        editingClassification={editingClassification}
        organizationId={organizationId}
        defaultBargainingUnitId={bargainingUnitId}
      />
    </div>
  );
}

// =============================================================================
// FORM DIALOG
// =============================================================================

interface ClassificationFormDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  editingClassification: JobClassification | null;
  organizationId: string;
  defaultBargainingUnitId?: string;
}

function ClassificationFormDialog({ 
  open, 
  onClose, 
  editingClassification, 
  organizationId,
  defaultBargainingUnitId 
}: ClassificationFormDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createJobClassificationSchema) as any,
    defaultValues: editingClassification
      ? {
          organizationId: editingClassification.organizationId,
          jobTitle: editingClassification.jobTitle,
          jobCode: editingClassification.jobCode,
          description: editingClassification.description || undefined,
          bargainingUnitId: editingClassification.bargainingUnitId || undefined,
          minimumRate: editingClassification.minimumRate ? parseFloat(editingClassification.minimumRate) : undefined,
          maximumRate: editingClassification.maximumRate ? parseFloat(editingClassification.maximumRate) : undefined,
          standardRate: editingClassification.standardRate ? parseFloat(editingClassification.standardRate) : undefined,
          effectiveDate: editingClassification.effectiveDate || undefined,
          expiryDate: editingClassification.expiryDate || undefined,
          isActive: editingClassification.isActive ?? true,
        }
      : {
          organizationId,
          jobTitle: "",
          jobCode: "",
          bargainingUnitId: defaultBargainingUnitId || undefined,
          isActive: true,
        },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      // Convert numeric rates to strings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const classificationData: any = {
        ...data,
        minimumRate: data.minimumRate ? String(data.minimumRate) : undefined,
        maximumRate: data.maximumRate ? String(data.maximumRate) : undefined,
        standardRate: data.standardRate ? String(data.standardRate) : undefined,
      };

      const result = editingClassification
        ? await updateJobClassificationAction(editingClassification.id, classificationData)
        : await createJobClassificationAction(classificationData);

      if (result.isSuccess) {
        toast({
          title: "Success",
          description: result.message,
        });
        onClose(true);
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingClassification ? "Edit Job Classification" : "Create Job Classification"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="jobTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Journeyman Electrician" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., ELEC-J01" />
                  </FormControl>
                  <FormDescription>Unique identifier for this classification</FormDescription>
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
                    <Textarea {...field} placeholder="Job duties and requirements" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bargainingUnitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bargaining Unit ID (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="UUID" readOnly={!!defaultBargainingUnitId} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="minimumRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Rate</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="standardRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standard Rate</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maximumRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Rate</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormDescription>Leave blank if no expiry</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active Classification</FormLabel>
                    <FormDescription>
                      Active classifications can be assigned to new employment records
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex gap-4 justify-end">
              <Button type="button" variant="outline" onClick={() => onClose()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingClassification ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
