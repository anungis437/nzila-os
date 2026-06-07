/**
 * Bulk Member Operations Component
 * 
 * Bulk actions for member management:
 * - Export selected members
 * - Update status
 * - Assign to chapter
 * - Send bulk messages
 * - Update dues status
 * - Archive members
 * 
 * @module components/members/bulk-member-operations
 */

"use client";

import * as React from "react";
import {
  Download,
  Mail,
  Users,
  FileText,
  Archive,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export interface BulkOperation {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  requiresConfirmation: boolean;
  isDestructive?: boolean;
}

export interface BulkMemberOperationsProps {
  selectedMemberIds: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOperationComplete?: (operation: string, results: any) => void;
  onClearSelection?: () => void;
}

const operations: BulkOperation[] = [
  {
    id: "export",
    label: "Export to CSV",
    icon: Download,
    description: "Download selected members data",
    requiresConfirmation: false,
  },
  {
    id: "send-message",
    label: "Send Message",
    icon: Mail,
    description: "Send email/notification to selected members",
    requiresConfirmation: true,
  },
  {
    id: "update-status",
    label: "Update Status",
    icon: CheckCircle2,
    description: "Change membership status",
    requiresConfirmation: true,
  },
  {
    id: "assign-chapter",
    label: "Assign Chapter",
    icon: Users,
    description: "Assign to a chapter",
    requiresConfirmation: true,
  },
  {
    id: "update-dues",
    label: "Update Dues Status",
    icon: FileText,
    description: "Mark dues as current/overdue",
    requiresConfirmation: true,
  },
  {
    id: "archive",
    label: "Archive Members",
    icon: Archive,
    description: "Move to archived status",
    requiresConfirmation: true,
    isDestructive: true,
  },
];

export function BulkMemberOperations({
  selectedMemberIds,
  onOperationComplete,
  onClearSelection,
}: BulkMemberOperationsProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  // Operation-specific state
  const [message, setMessage] = React.useState("");
  const [newStatus, setNewStatus] = React.useState("");
  const [chapter, setChapter] = React.useState("");
  const [duesStatus, setDuesStatus] = React.useState("");

  const handleOperationClick = (operationId: string) => {
    setSelectedOperation(operationId);
    const operation = operations.find((op) => op.id === operationId);
    if (operation?.requiresConfirmation) {
      setIsDialogOpen(true);
    } else {
      executeOperation(operationId);
    }
  };

  const executeOperation = async (operationId: string) => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Simulate progress for demonstration
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      clearInterval(interval);
      setProgress(100);

      // Handle specific operations
      switch (operationId) {
        case "export":
          // Trigger CSV download
          toast({
            title: "Export complete",
            description: `${selectedMemberIds.length} members exported`,
          });
          break;
        case "send-message":
          toast({
            title: "Messages sent",
            description: `Message sent to ${selectedMemberIds.length} members`,
          });
          break;
        case "update-status":
          toast({
            title: "Status updated",
            description: `${selectedMemberIds.length} members updated to ${newStatus}`,
          });
          break;
        case "assign-chapter":
          toast({
            title: "Chapter assigned",
            description: `${selectedMemberIds.length} members assigned to ${chapter}`,
          });
          break;
        case "update-dues":
          toast({
            title: "Dues status updated",
            description: `${selectedMemberIds.length} members marked as ${duesStatus}`,
          });
          break;
        case "archive":
          toast({
            title: "Members archived",
            description: `${selectedMemberIds.length} members archived successfully`,
          });
          break;
      }

      onOperationComplete?.(operationId, { count: selectedMemberIds.length });
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Operation failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const resetForm = () => {
    setMessage("");
    setNewStatus("");
    setChapter("");
    setDuesStatus("");
  };

  if (selectedMemberIds.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Bulk Operations
              <Badge variant="secondary">{selectedMemberIds.length} selected</Badge>
            </div>
            {onClearSelection && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
              >
                Clear Selection
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {operations.map((operation) => {
              const Icon = operation.icon;
              return (
                <Button
                  key={operation.id}
                  variant={operation.isDestructive ? "destructive" : "outline"}
                  className="h-auto flex-col items-start p-4 gap-2"
                  onClick={() => handleOperationClick(operation.id)}
                >
                  <Icon className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">{operation.label}</div>
                    <div className="text-xs opacity-80 font-normal">
                      {operation.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Operation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {operations.find((op) => op.id === selectedOperation)?.label}
            </DialogTitle>
            <DialogDescription>
              This action will affect {selectedMemberIds.length} selected member(s).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Send Message */}
            {selectedOperation === "send-message" && (
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Enter your message..."
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            )}

            {/* Update Status */}
            {selectedOperation === "update-status" && (
              <div className="space-y-2">
                <Label htmlFor="status">New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Assign Chapter */}
            {selectedOperation === "assign-chapter" && (
              <div className="space-y-2">
                <Label htmlFor="chapter">Chapter</Label>
                <Select value={chapter} onValueChange={setChapter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chapter-1">Chapter 1 - Manufacturing</SelectItem>
                    <SelectItem value="chapter-2">Chapter 2 - Services</SelectItem>
                    <SelectItem value="chapter-3">Chapter 3 - Healthcare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Update Dues */}
            {selectedOperation === "update-dues" && (
              <div className="space-y-2">
                <Label htmlFor="dues">Dues Status</Label>
                <Select value={duesStatus} onValueChange={setDuesStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dues status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Archive Warning */}
            {selectedOperation === "archive" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div className="text-sm text-red-900">
                  <p className="font-medium mb-1">Warning</p>
                  <p>
                    This will archive {selectedMemberIds.length} member(s). 
                    Archived members will not appear in regular views but can be restored later.
                  </p>
                </div>
              </div>
            )}

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-gray-600">
                  Processing {selectedMemberIds.length} member(s)...
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => executeOperation(selectedOperation!)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

