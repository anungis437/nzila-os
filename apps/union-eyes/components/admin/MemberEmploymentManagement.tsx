"use client";

/**
 * Member Employment Management Component
 * 
 * Phase 1.2: Member Profile v2 - Employment Attributes
 * 
 * Complete CRUD interface for managing member employment records.
 * Features:
 * - List employment records with filtering
 * - Create new employment records
 * - Edit existing employment
 * - View employment history timeline
 * - Leave management
 * - Seniority calculations
 * 
 * @module components/admin/MemberEmploymentManagement
 */

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
 
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Filter as _Filter,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { createMemberEmploymentSchema } from "@/lib/validation/member-employment-schemas";
import {
  createMemberEmploymentAction,
  updateMemberEmploymentAction,
  deleteMemberEmploymentAction,
  getEmploymentByOrganizationAction,
} from "@/actions/member-employment-actions";

// =============================================================================
// TYPES
// =============================================================================

interface MemberEmployment {
  id: string;
  organizationId: string;
  memberId: string;
  employerId?: string | null;
  worksiteId?: string | null;
  bargainingUnitId?: string | null;
  employmentStatus: string;
  employmentType: string;
  hireDate: string;
  seniorityDate: string;
  terminationDate?: string | null;
  jobTitle: string;
  jobCode?: string | null;
  jobClassification?: string | null;
  payFrequency: string;
  hourlyRate?: string | null;
  baseSalary?: string | null;
  grossWages?: string | null;
  regularHoursPerWeek?: string | null;
  shiftType?: string | null;
  checkoffAuthorized?: boolean | null;
}

type _EmploymentFormData = z.infer<typeof createMemberEmploymentSchema>;

// =============================================================================
// CONSTANTS
// =============================================================================

const EMPLOYMENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "layoff", label: "Layoff" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
  { value: "retired", label: "Retired" },
];

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "casual", label: "Casual" },
  { value: "seasonal", label: "Seasonal" },
  { value: "temporary", label: "Temporary" },
  { value: "contract", label: "Contract" },
  { value: "probationary", label: "Probationary" },
];

const PAY_FREQUENCIES = [
  { value: "hourly", label: "Hourly" },
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-Weekly" },
  { value: "semi_monthly", label: "Semi-Monthly" },
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

const SHIFT_TYPES = [
  { value: "day", label: "Day" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
  { value: "rotating", label: "Rotating" },
  { value: "split", label: "Split" },
  { value: "on_call", label: "On Call" },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface MemberEmploymentManagementProps {
  organizationId: string;
}

export default function MemberEmploymentManagement({ organizationId }: MemberEmploymentManagementProps) {
  const { toast } = useToast();
  const [employmentRecords, setEmploymentRecords] = useState<MemberEmployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MemberEmployment | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");

  // Load employment records
  useEffect(() => {
    loadEmploymentRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, statusFilter]);

  const loadEmploymentRecords = async () => {
    setLoading(true);
    try {
      const result = await getEmploymentByOrganizationAction(organizationId, statusFilter);
      if (result.isSuccess && result.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEmploymentRecords(result.data as any);
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to load employment records",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load employment records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRecord(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (record: MemberEmployment) => {
    setEditingRecord(record);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this employment record?")) {
      return;
    }

    const result = await deleteMemberEmploymentAction(id);
    if (result.isSuccess) {
      toast({
        title: "Success",
        description: "Employment record deleted successfully",
      });
      loadEmploymentRecords();
    } else {
      toast({
        title: "Error",
        description: result.message || "Failed to delete employment record",
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (success?: boolean) => {
    setIsDialogOpen(false);
    setEditingRecord(null);
    if (success) {
      loadEmploymentRecords();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Member Employment</h2>
          <p className="text-muted-foreground">
            Manage employment records, job classifications, and seniority
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Employment Record
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {EMPLOYMENT_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employment Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employment Records ({employmentRecords.length})</CardTitle>
          <CardDescription>
            View and manage all employment records for this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : employmentRecords.length === 0 ? (
            <div className="text-center p-8">
              <p className="text-muted-foreground">No employment records found</p>
              <Button onClick={handleCreate} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create First Record
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Hire Date</TableHead>
                  <TableHead>Seniority Date</TableHead>
                  <TableHead>Pay Frequency</TableHead>
                  <TableHead>Rate/Salary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employmentRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{record.jobTitle}</div>
                        {record.jobCode && (
                          <div className="text-xs text-muted-foreground">
                            Code: {record.jobCode}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.employmentStatus === "active" ? "default" : "secondary"}>
                        {record.employmentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.employmentType}</TableCell>
                    <TableCell>{new Date(record.hireDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(record.seniorityDate).toLocaleDateString()}</TableCell>
                    <TableCell>{record.payFrequency}</TableCell>
                    <TableCell>
                      {record.hourlyRate && `$${record.hourlyRate}/hr`}
                      {record.baseSalary && `$${record.baseSalary}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(record)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Form Dialog */}
      <EmploymentFormDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        editingRecord={editingRecord}
        organizationId={organizationId}
      />
    </div>
  );
}

// =============================================================================
// FORM DIALOG COMPONENT
// =============================================================================

interface EmploymentFormDialogProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  editingRecord: MemberEmployment | null;
  organizationId: string;
}

function EmploymentFormDialog({
  open,
  onClose,
  editingRecord,
  organizationId,
}: EmploymentFormDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createMemberEmploymentSchema) as any,
    defaultValues: editingRecord
      ? {
          organizationId: editingRecord.organizationId,
          memberId: editingRecord.memberId,
          hireDate: editingRecord.hireDate,
          seniorityDate: editingRecord.seniorityDate,
          jobTitle: editingRecord.jobTitle,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          employmentStatus: editingRecord.employmentStatus as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          employmentType: editingRecord.employmentType as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payFrequency: editingRecord.payFrequency as any,
          jobCode: editingRecord.jobCode || undefined,
          hourlyRate: editingRecord.hourlyRate ? parseFloat(editingRecord.hourlyRate) : undefined,
          baseSalary: editingRecord.baseSalary ? parseFloat(editingRecord.baseSalary) : undefined,
          regularHoursPerWeek: editingRecord.regularHoursPerWeek
            ? parseFloat(editingRecord.regularHoursPerWeek)
            : 40,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          shiftType: editingRecord.shiftType as any,
          checkoffAuthorized: editingRecord.checkoffAuthorized ?? true,
        }
      : {
          organizationId,
          hireDate: new Date().toISOString().split("T")[0],
          seniorityDate: new Date().toISOString().split("T")[0],
          jobTitle: "",
          employmentStatus: "active",
          employmentType: "full_time",
          payFrequency: "hourly",
          regularHoursPerWeek: 40,
          checkoffAuthorized: true,
        },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      // Convert numeric fields to strings for database compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const employmentData: any = {
        ...data,
        hourlyRate: data.hourlyRate ? String(data.hourlyRate) : undefined,
        baseSalary: data.baseSalary ? String(data.baseSalary) : undefined,
        seniorityYears: data.seniorityYears ? String(data.seniorityYears) : undefined,
        regularHoursPerWeek: data.regularHoursPerWeek ? String(data.regularHoursPerWeek) : undefined,
      };
      
      const result = editingRecord
        ? await updateMemberEmploymentAction(editingRecord.id, employmentData)
        : await createMemberEmploymentAction(employmentData);

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
            {editingRecord ? "Edit Employment Record" : "Create Employment Record"}
          </DialogTitle>
          <DialogDescription>
            Enter employment details including job title, dates, and compensation
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic">
              <TabsList>
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="compensation">Compensation</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="memberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Member ID *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Member UUID" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Journeyman Electrician" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employmentStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EMPLOYMENT_STATUSES.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
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
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EMPLOYMENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
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
                    name="hireDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hire Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="seniorityDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seniority Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription>May differ from hire date</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="jobCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., JE-001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="compensation" className="space-y-4">
                <FormField
                  control={form.control}
                  name="payFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pay Frequency *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAY_FREQUENCIES.map((freq) => (
                            <SelectItem key={freq.value} value={freq.value}>
                              {freq.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="baseSalary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Salary</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="checkoffAuthorized"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Dues Checkoff Authorized</FormLabel>
                        <FormDescription>
                          Member has authorized automatic dues deduction
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <FormField
                  control={form.control}
                  name="regularHoursPerWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regular Hours Per Week</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shiftType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shift type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SHIFT_TYPES.map((shift) => (
                            <SelectItem key={shift.value} value={shift.value}>
                              {shift.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onClose()} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingRecord ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
