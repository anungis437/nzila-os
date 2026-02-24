"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock, ArrowRight } from "lucide-react";

interface WorkflowStatus {
  currentStatus: string;
  priority: string;
  deadline: string;
  daysRemaining: number;
  isOverdue: boolean;
  allowedTransitions: string[];
  progress: number;
  statusSince: string;
}

interface ClaimStatusUpdateProps {
  claimId: string;
  onStatusUpdated?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  assigned: "Assigned",
  investigation: "Investigation",
  pending_documentation: "Pending Documentation",
  resolved: "Resolved",
  rejected: "Rejected",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  assigned: "bg-purple-100 text-purple-800",
  investigation: "bg-orange-100 text-orange-800",
  pending_documentation: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-800",
};

export function ClaimStatusUpdate({ claimId, onStatusUpdated }: ClaimStatusUpdateProps) {
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingWorkflow, setLoadingWorkflow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch workflow status
  useEffect(() => {
    async function fetchWorkflow() {
      try {
        const response = await fetch(`/api/claims/${claimId}/workflow`);
        if (!response.ok) throw new Error("Failed to load workflow status");
        
        const data = await response.json();
        setWorkflow(data.workflow);
      } catch (_err) {
setError("Failed to load workflow status");
      } finally {
        setLoadingWorkflow(false);
      }
    }

    fetchWorkflow();
  }, [claimId]);

  const handleStatusUpdate = async () => {
    if (!selectedStatus) {
      toast.error("Please select a status");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/claims/${claimId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedStatus,
          notes: notes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      toast.success("Status updated successfully");
      setSelectedStatus("");
      setNotes("");
      
      // Refresh workflow status
      const workflowResponse = await fetch(`/api/claims/${claimId}/workflow`);
      const workflowData = await workflowResponse.json();
      setWorkflow(workflowData.workflow);

      if (onStatusUpdated) {
        onStatusUpdated();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update status";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingWorkflow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status Update</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!workflow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status Update</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load workflow status
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Update</CardTitle>
        <CardDescription>
          Manage claim status with workflow validation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Current Status</h4>
          <div className="flex items-center gap-4">
            <Badge className={STATUS_COLORS[workflow.currentStatus]}>
              {STATUS_LABELS[workflow.currentStatus]}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Since {new Date(workflow.statusSince).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Deadline Info */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Deadline</h4>
          <div className="flex items-center gap-2">
            {workflow.isOverdue ? (
              <>
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600 font-medium">
                  Overdue by {Math.abs(workflow.daysRemaining)} days
                </span>
              </>
            ) : (
              <>
                {workflow.daysRemaining <= 1 ? (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm text-muted-foreground">
                  {workflow.daysRemaining} days remaining
                  {" "}(Due: {new Date(workflow.deadline).toLocaleDateString()})
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Progress</h4>
            <span className="text-sm text-muted-foreground">{workflow.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all duration-300"
              style={{ width: `${workflow.progress}%` }}
            />
          </div>
        </div>

        {/* Status Update Form */}
        {workflow.allowedTransitions.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <label className="text-sm font-medium">Change Status To</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {workflow.allowedTransitions.map((status) => (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" />
                        {STATUS_LABELS[status]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this status change..."
                rows={3}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleStatusUpdate}
              disabled={!selectedStatus || loading}
              className="w-full"
            >
              {loading ? "Updating..." : "Update Status"}
            </Button>
          </div>
        )}

        {workflow.allowedTransitions.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This claim is in a terminal state. No further status changes are allowed.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

