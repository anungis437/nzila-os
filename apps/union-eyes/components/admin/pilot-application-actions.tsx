/**
 * Pilot Application Actions Component
 * 
 * Approve, reject, and manage pilot applications.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Eye, Loader2 } from 'lucide-react';
import type { PilotApplication } from '@/types/marketing';

interface PilotApplicationActionsProps {
  application: PilotApplication;
}

export default function PilotApplicationActions({
  application,
}: PilotApplicationActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const handleApprove = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/pilot/apply/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          reviewedAt: new Date().toISOString(),
          reviewedBy: 'admin-user', // TODO: Get from session
          reviewNotes: notes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve');
      }

      setApproveDialogOpen(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/pilot/apply/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
          reviewedBy: 'admin-user', // TODO: Get from session
          reviewNotes: notes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject');
      }

      setRejectDialogOpen(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" title="View Details">
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{application.organizationName}</DialogTitle>
            <DialogDescription>
              Application submitted {new Date(application.submittedAt).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Contact Info */}
            <div>
              <h3 className="font-semibold mb-2">Contact Information</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Name:</dt>
                <dd>{application.contactName}</dd>
                <dt className="text-muted-foreground">Email:</dt>
                <dd>{application.contactEmail}</dd>
                <dt className="text-muted-foreground">Phone:</dt>
                <dd>{application.contactPhone || '—'}</dd>
              </dl>
            </div>

            {/* Organization Info */}
            <div>
              <h3 className="font-semibold mb-2">Organization Details</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Member Count:</dt>
                <dd>{application.memberCount.toLocaleString()}</dd>
                <dt className="text-muted-foreground">Readiness Score:</dt>
                <dd>{application.readinessScore}/100</dd>
                <dt className="text-muted-foreground">Readiness Level:</dt>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <dd className="capitalize">{(application as any).readinessLevel || 'Unknown'}</dd>
              </dl>
            </div>

            {/* Current Challenges */}
            <div>
              <h3 className="font-semibold mb-2">Current Challenges</h3>
              <p className="text-sm">{application.challenges?.join(', ') || 'Not provided'}</p>
            </div>

            {/* Goals */}
            <div>
              <h3 className="font-semibold mb-2">Goals with Union Eyes</h3>
              <p className="text-sm">{application.goals || 'Not provided'}</p>
            </div>

            {/* Readiness Assessment */}
            {application.responses && (
              <div>
                <h3 className="font-semibold mb-2">Readiness Assessment</h3>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Setup Time:</strong>{' '}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(application.responses as any).setupTime || 'Unknown'}
                  </p>
                  <p>
                    <strong>Support Level:</strong>{' '}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(application.responses as any).supportLevel || 'Unknown'}
                  </p>
                </div>
              </div>
            )}

            {/* Review Notes */}
            {application.notes && (
              <div>
                <h3 className="font-semibold mb-2">Review Notes</h3>
                <p className="text-sm">{application.notes}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Actions */}
      {application.status === 'submitted' && (
        <>
          {/* Approve Dialog */}
          <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" title="Approve">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approve Application</DialogTitle>
                <DialogDescription>
                  Approve {application.organizationName} for the pilot program?
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="approveNotes">Notes (Optional)</Label>
                  <Textarea
                    id="approveNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes about this approval..."
                    rows={3}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleApprove} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    'Approve'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Reject Dialog */}
          <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" title="Reject">
                <XCircle className="h-4 w-4 text-red-600" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Application</DialogTitle>
                <DialogDescription>
                  Reject {application.organizationName}&apos;s application?
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="rejectNotes">Reason (Optional)</Label>
                  <Textarea
                    id="rejectNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Why is this application being rejected?"
                    rows={3}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReject} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    'Reject'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
