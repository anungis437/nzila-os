'use client';

/**
 * CLC Approval Workflow Component
 * 
 * Interactive UI for managing multi-level approval workflows for per-capita remittances.
 * Displays approval timeline, history, and provides approval/rejection actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import type {
  ApprovalLevel,
  ApprovalWorkflowState,
  ApprovalHistoryEntry
} from '@/services/clc/remittance-audit';

interface CLCApprovalWorkflowProps {
  remittanceId: string;
  userId: string;
  onApprovalComplete?: () => void;
}

const LEVEL_LABELS: Record<ApprovalLevel, string> = {
  local: 'Local',
  regional: 'Regional',
  national: 'National',
  clc: 'CLC'
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  pending_local: 'bg-blue-500',
  pending_regional: 'bg-blue-500',
  pending_national: 'bg-blue-500',
  pending_clc: 'bg-blue-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  paid: 'bg-purple-500'
};

export function CLCApprovalWorkflow({
  remittanceId,
  userId,
  onApprovalComplete
}: CLCApprovalWorkflowProps) {
  const [workflowState, setWorkflowState] = useState<ApprovalWorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionComment, setRejectionComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadWorkflowState = useCallback(async () => {
    if (!remittanceId || !userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/clc/remittances/${remittanceId}/approval?userId=${userId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load approval workflow');
      }

      const data = await response.json();
      setWorkflowState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [remittanceId, userId]);

  useEffect(() => {
    loadWorkflowState();
  }, [loadWorkflowState]);

  const handleApprove = async () => {
    if (!workflowState?.currentLevel) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/clc/remittances/${remittanceId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          level: workflowState.currentLevel,
          comment: approvalComment || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to approve remittance');
      }

      setShowApproveDialog(false);
      setApprovalComment('');
      await loadWorkflowState();
      onApprovalComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!workflowState?.currentLevel || !rejectionReason.trim()) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/clc/remittances/${remittanceId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          level: workflowState.currentLevel,
          reason: rejectionReason,
          comment: rejectionComment || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reject remittance');
      }

      setShowRejectDialog(false);
      setRejectionReason('');
      setRejectionComment('');
      await loadWorkflowState();
      onApprovalComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="h-5 w-5 animate-spin mr-2" />
            <span>Loading approval workflow...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!workflowState) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Failed to load approval workflow</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
          <CardDescription>
            {workflowState.organizationName} - {workflowState.remittanceMonth}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="text-2xl font-bold">${workflowState.amount.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge className={STATUS_COLORS[workflowState.status] || 'bg-gray-500'}>
                {workflowState.status.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalTimeline
            currentLevel={workflowState.currentLevel}
            history={workflowState.history}
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {workflowState.requiresAction && (
        <Card>
          <CardHeader>
            <CardTitle>Action Required</CardTitle>
            <CardDescription>
              This remittance requires your approval at the{' '}
              <strong>{LEVEL_LABELS[workflowState.currentLevel!]}</strong> level
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={() => setShowApproveDialog(true)}
                disabled={!workflowState.canApprove}
                className="flex-1"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => setShowRejectDialog(true)}
                disabled={!workflowState.canReject}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval History */}
      <Card>
        <CardHeader>
          <CardTitle>Approval History</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory history={workflowState.history} />
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Remittance</DialogTitle>
            <DialogDescription>
              Approve this remittance at the{' '}
              <strong>{LEVEL_LABELS[workflowState.currentLevel!]}</strong> level
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="approval-comment">Comment (Optional)</Label>
              <Textarea
                id="approval-comment"
                placeholder="Add a comment about this approval..."
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={actionLoading}>
              {actionLoading ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Remittance</DialogTitle>
            <DialogDescription>
              Reject this remittance at the{' '}
              <strong>{LEVEL_LABELS[workflowState.currentLevel!]}</strong> level
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Enter the reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                required
              />
            </div>
            <div>
              <Label htmlFor="rejection-comment">Additional Comment (Optional)</Label>
              <Textarea
                id="rejection-comment"
                placeholder="Add additional details..."
                value={rejectionComment}
                onChange={(e) => setRejectionComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
              variant="destructive"
            >
              {actionLoading ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Timeline component
function ApprovalTimeline({
  currentLevel,
  history
}: {
  currentLevel: ApprovalLevel | null;
  history: ApprovalHistoryEntry[];
}) {
  const levels: ApprovalLevel[] = ['local', 'regional', 'national', 'clc'];

  return (
    <div className="space-y-2">
      {levels.map((level, index) => {
        const levelHistory = history.filter((h) => h.level === level);
        const isComplete = levelHistory.some((h) => h.action === 'approved');
        const isRejected = levelHistory.some((h) => h.action === 'rejected');
        const isCurrent = level === currentLevel;

        return (
          <div key={level} className="flex items-center gap-4">
            <div className="flex items-center min-w-[200px]">
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
              ) : isRejected ? (
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
              ) : isCurrent ? (
                <Clock className="h-5 w-5 text-blue-500 mr-2" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-gray-300 mr-2" />
              )}
              <span className={isCurrent ? 'font-semibold' : ''}>
                {LEVEL_LABELS[level]}
              </span>
            </div>
            {index < levels.length - 1 && (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// History component
function ApprovalHistory({ history }: { history: ApprovalHistoryEntry[] }) {
  if (history.length === 0) {
    return <div className="text-muted-foreground">No approval history yet</div>;
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => (
        <div key={entry.id} className="border-l-2 border-gray-200 pl-4 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold">
                {LEVEL_LABELS[entry.level]} - {entry.action.toUpperCase()}
              </div>
              <div className="text-sm text-muted-foreground">
                {entry.approverName} ({entry.approverEmail})
              </div>
              <div className="text-xs text-muted-foreground">
                {entry.timestamp.toLocaleString()}
              </div>
            </div>
            <Badge
              className={
                entry.action === 'approved'
                  ? 'bg-green-500'
                  : entry.action === 'rejected'
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              }
            >
              {entry.action}
            </Badge>
          </div>
          {entry.rejectionReason && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>
                <strong>Reason:</strong> {entry.rejectionReason}
              </AlertDescription>
            </Alert>
          )}
          {entry.comment && (
            <div className="mt-2 text-sm text-muted-foreground italic">
              &ldquo;{entry.comment}&rdquo;
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

