/**
 * Leave Management Component
 * 
 * Phase 1.2: Member Profile v2 - Employment Attributes
 * 
 * Features:
 * - View active/all leaves
 * - Create leave requests
 * - Approve/update leave status
 * - Filter by member, type, status
 * 
 * @module components/admin/LeaveManagement
 */

"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Plus, Check } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";
import { createMemberLeaveSchema } from "@/lib/validation/member-employment-schemas";
import {
  createMemberLeaveAction,
  getAllMemberLeavesAction,
  updateMemberLeaveAction,
  approveMemberLeaveAction,
} from "@/actions/member-employment-actions";

// TYPES
// =============================================================================

interface MemberLeave {
  id: string;
  organizationId: string;
  memberId: string;
  leaveType: string;
  startDate: string;
  endDate?: string | null;
  expectedReturnDate?: string | null;
  actualReturnDate?: string | null;
  reason?: string | null;
  isApproved?: boolean | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  notes?: string | null;
}

// CONSTANTS
// =============================================================================

const LEAVE_TYPES = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick Leave" },
  { value: "maternity", label: "Maternity" },
  { value: "paternity", label: "Paternity" },
  { value: "parental", label: "Parental" },
  { value: "bereavement", label: "Bereavement" },
  { value: "medical", label: "Medical"  },
  { value: "disability", label: "Disability" },
  { value: "union_business", label: "Union Business" },
  { value: "unpaid", label: "Unpaid" },
  { value: "lwop", label: "LWOP" },
  { value: "other", label: "Other" },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface LeaveManagementProps {
  organizationId: string;
  memberId: string;
}

export default function LeaveManagement({ organizationId, memberId }: LeaveManagementProps) {
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<MemberLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<MemberLeave | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    loadLeaves();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const result = await getAllMemberLeavesAction(memberId);
      if (result.isSuccess && Array.isArray(result.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setLeaves(result.data as any);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load leaves",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingLeave(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (leave: MemberLeave) => {
    setEditingLeave(leave);
    setIsDialogOpen(true);
  };

  const handleApprove = async (leaveId: string) => {
    const result = await approveMemberLeaveAction(leaveId);
    if (result.isSuccess) {
      toast({
        title: "Success",
        description: "Leave request approved",
      });
      loadLeaves();
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (refresh?: boolean) => {
    setIsDialogOpen(false);
    setEditingLeave(null);
    if (refresh) {
      loadLeaves();
    }
  };

  const getStatusBadge = (leave: MemberLeave) => {
    if (leave.isApproved === null || leave.isApproved === undefined) {
      return <Badge variant="secondary">Pending</Badge>;
    }
    if (leave.isApproved) {
      return <Badge variant="default">Approved</Badge>;
    }
    return <Badge variant="destructive">Rejected</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Leave Management</h2>
          <p className="text-muted-foreground">Manage member leave requests</p>
        </div>
        <Button onClick={handleCreate}>
         <Plus className="mr-2 h-4 w-4" />
          New Leave Request
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
                  <SelectItem value="active">Active Leaves</SelectItem>
                  <SelectItem value="all">All Leaves</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>{leaves.length} total records</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No leave requests found</p>
              <Button variant="link" onClick={handleCreate}>
                Create the first leave request
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Expected Return</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell className="font-medium">
                      {LEAVE_TYPES.find(t => t.value === leave.leaveType)?.label || leave.leaveType}
                    </TableCell>
                    <TableCell>{leave.startDate}</TableCell>
                    <TableCell>{leave.endDate || "-"}</TableCell>
                    <TableCell>{leave.expectedReturnDate || "-"}</TableCell>
                    <TableCell>{getStatusBadge(leave)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(leave)}>
                          Edit
                        </Button>
                        {(leave.isApproved === null || leave.isApproved === undefined) && (
                          <Button size="sm" onClick={() => handleApprove(leave.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <LeaveFormDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        editingLeave={editingLeave}
        organizationId={organizationId}
        defaultMemberId={memberId}
      />
    </div>
  );
}

// =============================================================================
// FORM DIALOG
// =============================================================================

interface LeaveFormDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  editingLeave: MemberLeave | null;
  organizationId: string;
  defaultMemberId?: string;
}

function LeaveFormDialog({ open, onClose, editingLeave, organizationId, defaultMemberId }: LeaveFormDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createMemberLeaveSchema) as any,
    defaultValues: editingLeave
      ? {
          organizationId: editingLeave.organizationId,
          memberId: editingLeave.memberId,
          leaveType: editingLeave.leaveType,
          startDate: editingLeave.startDate,
          endDate: editingLeave.endDate || undefined,
          expectedReturnDate: editingLeave.expectedReturnDate || undefined,
          reason: editingLeave.reason || undefined,
          notes: editingLeave.notes || undefined,
        }
      : {
          organizationId,
          memberId: defaultMemberId || "",
          leaveType: "vacation",
          startDate: new Date().toISOString().split("T")[0],
        },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const result = editingLeave
        ? await updateMemberLeaveAction(editingLeave.id, data)
        : await createMemberLeaveAction(data);

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
            {editingLeave ? "Edit Leave Request" : "Create Leave Request"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="memberId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="UUID" readOnly={!!defaultMemberId} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leaveType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leave Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAVE_TYPES.map((type) => (
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormDescription>Leave blank if ongoing</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="expectedReturnDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Return Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Optional reason for leave" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4 justify-end">
              <Button type="button" variant="outline" onClick={() => onClose()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingLeave ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
