/**
 * CUPE Case Workbench
 *
 * Queue-based assignment workbench for stewards, chief stewards, and officers.
 * Sections: My Assigned, Unassigned, Urgent, Overdue, Recently Updated.
 *
 * PR-021: Queue & Assignment Workflow Polish
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import {
  Inbox,
  UserCheck,
  AlertTriangle,
  Clock,
  RefreshCw,
  UserPlus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkbenchCase {
  claimId: string;
  claimNumber: string;
  claimType: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  description: string;
  location: string | null;
  memberId: string;
  isAnonymous: boolean;
}

type QueueTab = 'assigned' | 'unassigned' | 'urgent' | 'overdue' | 'recent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLA_HOURS: Record<string, number> = {
  critical: 24,
  high: 48,
  medium: 72,
  low: 168,
};

function isOverdue(c: WorkbenchCase): boolean {
  const sla = SLA_HOURS[c.priority] ?? 72;
  const created = new Date(c.createdAt).getTime();
  const now = Date.now();
  return now - created > sla * 3600_000;
}

function isUrgent(c: WorkbenchCase): boolean {
  return c.priority === 'critical' || c.status === 'escalated';
}

function isRecent(c: WorkbenchCase): boolean {
  const updated = new Date(c.updatedAt).getTime();
  return Date.now() - updated < 24 * 3600_000;
}

function priorityColor(p: string) {
  switch (p) {
    case 'critical': return 'bg-red-600 text-white';
    case 'high': return 'bg-red-100 text-red-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function statusColor(s: string) {
  switch (s) {
    case 'submitted': case 'under_review': return 'bg-blue-100 text-blue-800';
    case 'assigned': case 'investigation': return 'bg-indigo-100 text-indigo-800';
    case 'pending_documentation': return 'bg-yellow-100 text-yellow-800';
    case 'resolved': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'closed': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function WorkbenchPage() {
  const router = useRouter();
  const [cases, setCases] = useState<WorkbenchCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<QueueTab>('assigned');

  // Assignment dialog
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    caseId: string;
    caseNumber: string;
  }>({ open: false, caseId: '', caseNumber: '' });
  const [assigneeId, setAssigneeId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workbench/assigned');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCases(data.claims ?? []);
    } catch (error) {
      logger.error('Failed to fetch workbench cases', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Queue filtering
  const myAssigned = cases.filter((c) => c.assignedTo && c.status !== 'closed' && c.status !== 'resolved' && c.status !== 'rejected');
  const unassigned = cases.filter((c) => !c.assignedTo && c.status !== 'closed' && c.status !== 'resolved' && c.status !== 'rejected');
  const urgent = cases.filter(isUrgent);
  const overdue = cases.filter((c) => isOverdue(c) && c.status !== 'closed' && c.status !== 'resolved');
  const recent = cases.filter(isRecent);

  const queueCounts: Record<QueueTab, number> = {
    assigned: myAssigned.length,
    unassigned: unassigned.length,
    urgent: urgent.length,
    overdue: overdue.length,
    recent: recent.length,
  };

  const currentQueue = (): WorkbenchCase[] => {
    switch (activeTab) {
      case 'assigned': return myAssigned;
      case 'unassigned': return unassigned;
      case 'urgent': return urgent;
      case 'overdue': return overdue;
      case 'recent': return recent;
    }
  };

  const handleAssign = async () => {
    if (!assigneeId.trim()) return;
    try {
      setAssigning(true);
      const res = await fetch(`/api/cases/${assignDialog.caseId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeId: assigneeId.trim(),
          reason: assignReason.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAssignDialog({ open: false, caseId: '', caseNumber: '' });
      setAssigneeId('');
      setAssignReason('');
      await fetchCases(); // refresh
    } catch (error) {
      logger.error('Failed to assign case', error);
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Loading workbench...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Case Workbench</h1>
          <p className="text-muted-foreground">
            Manage your case queues, assignments, and escalations
          </p>
        </div>
        <Button variant="outline" onClick={fetchCases}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard
          label="My Assigned"
          count={queueCounts.assigned}
          icon={<UserCheck className="h-5 w-5 text-blue-600" />}
          active={activeTab === 'assigned'}
          onClick={() => setActiveTab('assigned')}
        />
        <SummaryCard
          label="Unassigned"
          count={queueCounts.unassigned}
          icon={<Inbox className="h-5 w-5 text-slate-600" />}
          active={activeTab === 'unassigned'}
          onClick={() => setActiveTab('unassigned')}
        />
        <SummaryCard
          label="Urgent"
          count={queueCounts.urgent}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          variant="danger"
          active={activeTab === 'urgent'}
          onClick={() => setActiveTab('urgent')}
        />
        <SummaryCard
          label="Overdue"
          count={queueCounts.overdue}
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          variant="warning"
          active={activeTab === 'overdue'}
          onClick={() => setActiveTab('overdue')}
        />
        <SummaryCard
          label="Recent"
          count={queueCounts.recent}
          icon={<RefreshCw className="h-5 w-5 text-green-600" />}
          active={activeTab === 'recent'}
          onClick={() => setActiveTab('recent')}
        />
      </div>

      {/* Queue Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as QueueTab)}>
        <TabsList>
          <TabsTrigger value="assigned">My Assigned</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
          <TabsTrigger value="urgent">Urgent</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <CaseQueueTable
            cases={currentQueue()}
            activeTab={activeTab}
            onRowClick={(c) => router.push(`/cases/${c.claimId}`)}
            onAssign={(c) =>
              setAssignDialog({
                open: true,
                caseId: c.claimId,
                caseNumber: c.claimNumber ?? c.claimId.slice(0, 8),
              })
            }
          />
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog
        open={assignDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setAssignDialog({ open: false, caseId: '', caseNumber: '' });
            setAssigneeId('');
            setAssignReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign Case {assignDialog.caseNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium" htmlFor="assignee-id">
                Assignee User ID
              </label>
              <Input
                id="assignee-id"
                placeholder="Enter steward or officer user ID"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="assign-reason">
                Reason / Note (optional)
              </label>
              <Textarea
                id="assign-reason"
                placeholder="Why is this case being assigned/reassigned?"
                value={assignReason}
                onChange={(e) => setAssignReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setAssignDialog({ open: false, caseId: '', caseNumber: '' })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!assigneeId.trim() || assigning}>
              <UserPlus className="mr-2 h-4 w-4" />
              {assigning ? 'Assigning...' : 'Assign & Add Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  count,
  icon,
  variant,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  variant?: 'danger' | 'warning';
  active: boolean;
  onClick: () => void;
}) {
  const ring = active ? 'ring-2 ring-primary' : '';
  const countColor =
    variant === 'danger' && count > 0
      ? 'text-red-600'
      : variant === 'warning' && count > 0
        ? 'text-yellow-600'
        : '';
  return (
    <Card
      className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${ring}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${countColor}`}>{count}</p>
        </div>
        {icon}
      </div>
    </Card>
  );
}

function CaseQueueTable({
  cases,
  activeTab,
  onRowClick,
  onAssign,
}: {
  cases: WorkbenchCase[];
  activeTab: QueueTab;
  onRowClick: (c: WorkbenchCase) => void;
  onAssign: (c: WorkbenchCase) => void;
}) {
  if (cases.length === 0) {
    const emptyMessages: Record<QueueTab, string> = {
      assigned: 'No cases assigned to you. Great work!',
      unassigned: 'All cases have been assigned.',
      urgent: 'No urgent cases. The backlog is clear.',
      overdue: 'No overdue cases. SLAs are on track.',
      recent: 'No cases updated in the last 24 hours.',
    };

    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground text-lg">{emptyMessages[activeTab]}</p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case #</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => (
            <TableRow
              key={c.claimId}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(c)}
            >
              <TableCell className="font-medium">
                {c.claimNumber ?? c.claimId.slice(0, 8)}
              </TableCell>
              <TableCell className="capitalize">
                {c.claimType?.replace(/_/g, ' ') ?? '—'}
              </TableCell>
              <TableCell>
                <Badge className={statusColor(c.status)}>
                  {c.status?.replace(/_/g, ' ') ?? '—'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={priorityColor(c.priority)}>
                  {c.priority ?? '—'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(c.createdAt)}
              </TableCell>
              <TableCell className="text-sm">
                {c.assignedTo ? c.assignedTo.slice(0, 12) + '…' : '—'}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign(c);
                  }}
                >
                  <UserPlus className="mr-1 h-3 w-3" />
                  {c.assignedTo ? 'Reassign' : 'Assign'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
