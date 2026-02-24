/**
 * Document Approval Workflow Component
 * 
 * Multi-step approval process with:
 * - Workflow configuration
 * - Approval stages
 * - Reviewer assignment
 * - Status tracking
 * - Comments & feedback
 * - Approval history
 * 
 * @module components/documents/document-approval-workflow
 */

"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MessageSquare,
  Plus,
  Trash2,
  AlertCircle,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Approval stage schema
const approvalStageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Stage name is required"),
  order: z.number(),
  reviewerIds: z.array(z.string()).min(1, "At least one reviewer is required"),
  requireAll: z.boolean(),
  description: z.string().optional(),
});

const workflowConfigSchema = z.object({
  documentId: z.string(),
  stages: z.array(approvalStageSchema).min(1, "At least one stage is required"),
});

type _ApprovalStage = z.infer<typeof approvalStageSchema>;
type WorkflowConfig = z.infer<typeof workflowConfigSchema>;

export interface ApprovalRecord {
  id: string;
  stageId: string;
  stageName: string;
  reviewerId: string;
  reviewerName: string;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  comment?: string;
  timestamp?: Date;
}

export interface WorkflowStatus {
  currentStage: number;
  overallStatus: "pending" | "in_progress" | "approved" | "rejected";
  approvals: ApprovalRecord[];
}

export interface ReviewerOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface DocumentApprovalWorkflowProps {
  documentId: string;
  documentName: string;
  existingConfig?: WorkflowConfig;
  status?: WorkflowStatus;
  reviewers: ReviewerOption[];
  isReviewer?: boolean;
  pendingReview?: ApprovalRecord;
  onSaveConfig?: (config: WorkflowConfig) => Promise<void>;
  onSubmitReview?: (
    approvalId: string,
    status: "approved" | "rejected" | "changes_requested",
    comment: string
  ) => Promise<void>;
}

export function DocumentApprovalWorkflow({
  documentId,
  documentName,
  existingConfig,
  status,
  reviewers,
  isReviewer,
  pendingReview,
  onSaveConfig,
  onSubmitReview,
}: DocumentApprovalWorkflowProps) {
  const [configMode, setConfigMode] = React.useState(!existingConfig);
  const [reviewDialogOpen, setReviewDialogOpen] = React.useState(false);
  const [reviewStatus, setReviewStatus] = React.useState<
    "approved" | "rejected" | "changes_requested" | null
  >(null);
  const [reviewComment, setReviewComment] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<WorkflowConfig>({
    resolver: zodResolver(workflowConfigSchema),
    defaultValues: existingConfig || {
      documentId,
      stages: [
        {
          name: "Initial Review",
          order: 1,
          reviewerIds: [],
          requireAll: false,
          description: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "stages",
  });

  const handleSaveConfig = async (data: WorkflowConfig) => {
    setIsSubmitting(true);
    try {
      await onSaveConfig?.(data);
      setConfigMode(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewStatus || !pendingReview || !onSubmitReview) return;

    setIsSubmitting(true);
    try {
      await onSubmitReview(pendingReview.id, reviewStatus, reviewComment);
      setReviewDialogOpen(false);
      setReviewComment("");
      setReviewStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Approval Workflow</h2>
          <p className="text-gray-600 mt-1">{documentName}</p>
        </div>
        {!configMode && existingConfig && (
          <Button variant="outline" onClick={() => setConfigMode(true)}>
            Edit Workflow
          </Button>
        )}
      </div>

      {/* Pending Review Alert */}
      {isReviewer && pendingReview && pendingReview.status === "pending" && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <div className="flex items-center justify-between">
              <span>
                <strong>Action Required:</strong> You have been assigned to review this
                document.
              </span>
              <Button size="sm" onClick={() => setReviewDialogOpen(true)}>
                Review Now
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {configMode ? (
        // Configuration Mode
        <Card>
          <CardHeader>
            <CardTitle>Configure Approval Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSaveConfig)} className="space-y-6">
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium">Stage {index + 1}</h4>
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

                      <FormField
                        control={form.control}
                        name={`stages.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stage Name</FormLabel>
                            <FormControl>
                              <input {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2" placeholder="e.g., Manager Review" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`stages.${index}.reviewerIds`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reviewers</FormLabel>
                            <div className="space-y-2">
                              <Select
                                onValueChange={(value) => {
                                  if (!field.value.includes(value)) {
                                    field.onChange([...field.value, value]);
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Add reviewer..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {reviewers.map((reviewer) => (
                                    <SelectItem key={reviewer.id} value={reviewer.id}>
                                      {reviewer.name} ({reviewer.role})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <div className="flex flex-wrap gap-2">
                                {field.value.map((reviewerId) => {
                                  const reviewer = reviewers.find((r) => r.id === reviewerId);
                                  return (
                                    <Badge key={reviewerId} variant="secondary">
                                      {reviewer?.name}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          field.onChange(
                                            field.value.filter((id) => id !== reviewerId)
                                          )
                                        }
                                        className="ml-2 hover:text-red-600"
                                      >
                                        ×
                                      </button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`stages.${index}.requireAll`}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">
                              Require all reviewers to approve
                            </FormLabel>
                            <FormDescription>
                              If unchecked, only one approval is needed to pass this stage
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`stages.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Describe what reviewers should focus on..."
                                rows={2}
                              />
                            </FormControl>
                            <FormMessage />
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
                      order: fields.length + 1,
                      reviewerIds: [],
                      requireAll: false,
                      description: "",
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stage
                </Button>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Workflow"}
                  </Button>
                  {existingConfig && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfigMode(false)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        // Status Display Mode
        <>
          {status && (
            <>
              {/* Overview */}
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-4 gap-6">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Overall Status</div>
                      <StatusBadge status={status.overallStatus} />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Current Stage</div>
                      <div className="font-medium">
                        {existingConfig?.stages[status.currentStage]?.name || "N/A"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Progress</div>
                      <div className="font-medium">
                        Stage {status.currentStage + 1} of{" "}
                        {existingConfig?.stages.length || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Completed</div>
                      <div className="font-medium">
                        {
                          status.approvals.filter((a) => a.status === "approved").length
                        }{" "}
                        / {status.approvals.length}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Workflow Stages */}
              <Card>
                <CardHeader>
                  <CardTitle>Approval Stages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {existingConfig?.stages.map((stage, index) => {
                      const stageApprovals = status.approvals.filter(
                        (a) => a.stageId === stage.id
                      );
                      const isCurrentStage = index === status.currentStage;
                      const isPastStage = index < status.currentStage;

                      return (
                        <div key={stage.id} className="relative">
                          <div className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-full border-2 flex items-center justify-center",
                                  isPastStage
                                    ? "border-green-500 bg-green-50"
                                    : isCurrentStage
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-300 bg-white"
                                )}
                              >
                                {isPastStage ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                ) : (
                                  <span className="font-medium">{index + 1}</span>
                                )}
                              </div>
                              {index < (existingConfig?.stages.length || 0) - 1 && (
                                <div className="w-0.5 h-full min-h-[4rem] bg-gray-200 mt-2" />
                              )}
                            </div>

                            <div className="flex-1 pb-6">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{stage.name}</h4>
                                {isCurrentStage && (
                                  <Badge variant="default">In Progress</Badge>
                                )}
                                {isPastStage && (
                                  <Badge variant="outline" className="text-green-600">
                                    Completed
                                  </Badge>
                                )}
                              </div>

                              {stage.description && (
                                <p className="text-sm text-gray-600 mb-3">
                                  {stage.description}
                                </p>
                              )}

                              <div className="space-y-2">
                                {stageApprovals.map((approval) => (
                                  <ApprovalCard key={approval.id} approval={approval} />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Review</DialogTitle>
            <DialogDescription>
              Review the document and provide your feedback
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {pendingReview && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium">{pendingReview.stageName}</div>
                <div className="text-sm text-gray-600">{documentName}</div>
              </div>
            )}

            <div>
              <div className="font-medium mb-3">Your Decision</div>
              <div className="space-y-2">
                {[
                  { value: "approved", label: "Approve", icon: CheckCircle2, color: "green" },
                  {
                    value: "changes_requested",
                    label: "Request Changes",
                    icon: MessageSquare,
                    color: "orange",
                  },
                  { value: "rejected", label: "Reject", icon: XCircle, color: "red" },
                ].map((option) => (
                  <button
                    key={option.value}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={() => setReviewStatus(option.value as any)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-all",
                      reviewStatus === option.value
                        ? `border-${option.color}-500 bg-${option.color}-50`
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <option.icon className="h-5 w-5" />
                    <span className="font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Comments {reviewStatus === "changes_requested" && "(Required)"}
              </label>
              <Textarea
                placeholder="Add your review comments..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={
                !reviewStatus ||
                (reviewStatus === "changes_requested" && !reviewComment) ||
                isSubmitting
              }
            >
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs = {
    pending: { label: "Pending", variant: "secondary" as const, icon: Clock },
    in_progress: { label: "In Progress", variant: "default" as const, icon: Clock },
    approved: { label: "Approved", variant: "success" as const, icon: CheckCircle2 },
    rejected: { label: "Rejected", variant: "destructive" as const, icon: XCircle },
  };

  const config = configs[status as keyof typeof configs] || configs.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function ApprovalCard({ approval }: { approval: ApprovalRecord }) {
  const statusIcons = {
    pending: { icon: Clock, color: "text-gray-500" },
    approved: { icon: CheckCircle2, color: "text-green-600" },
    rejected: { icon: XCircle, color: "text-red-600" },
    changes_requested: { icon: MessageSquare, color: "text-orange-600" },
  };

  const status = statusIcons[approval.status];
  const Icon = status.icon;

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{approval.reviewerName}</span>
        </div>
        <div className="flex items-center gap-1">
          <Icon className={cn("h-4 w-4", status.color)} />
          <span className="text-sm capitalize">{approval.status.replace("_", " ")}</span>
        </div>
      </div>
      {approval.comment && (
        <p className="text-sm text-gray-600 italic mt-2">{approval.comment}</p>
      )}
      {approval.timestamp && (
        <div className="text-xs text-gray-500 mt-2">
          {format(approval.timestamp, "MMM d, yyyy 'at' h:mm a")}
        </div>
      )}
    </div>
  );
}

