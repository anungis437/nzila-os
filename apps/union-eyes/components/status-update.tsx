'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StatusUpdateProps {
  claimId: string;
  currentStatus: string;
  onStatusUpdated: () => void;
}

const statusOptions = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'investigation', label: 'Investigation' },
  { value: 'pending_documentation', label: 'Pending Documentation' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
];

export function StatusUpdate({ claimId, currentStatus, onStatusUpdated }: StatusUpdateProps) {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [allowedTransitions, setAllowedTransitions] = useState<string[]>([]);

  // Fetch allowed status transitions
  useEffect(() => {
    const fetchWorkflowInfo = async () => {
      try {
        const response = await fetch(`/api/claims/${claimId}/workflow`);
        if (response.ok) {
          const data = await response.json();
          setAllowedTransitions(data.allowedTransitions || []);
        }
      } catch (_err) {
// Fallback: allow all transitions
        setAllowedTransitions(statusOptions.map(s => s.value));
      }
    };

    if (claimId) {
      fetchWorkflowInfo();
    }
  }, [claimId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStatus) {
      setError('Please select a status');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/claims/${claimId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: selectedStatus,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      setSuccess(true);
      setSelectedStatus('');
      setNotes('');
      
      // Call the callback to refresh claim data
      setTimeout(() => {
        onStatusUpdated();
      }, 1000);
    } catch (err) {
setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const availableStatusOptions = statusOptions.filter(option => 
    allowedTransitions.length === 0 || 
    allowedTransitions.includes(option.value) ||
    option.value === currentStatus
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Status</CardTitle>
        <CardDescription>
          Change the claim status and add notes about the update
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">New Status</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {availableStatusOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    disabled={option.value === currentStatus}
                  >
                    {option.label} {option.value === currentStatus && '(current)'}
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
              rows={4}
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 text-green-900 border-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Status updated successfully! Email notification sent.
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            disabled={loading || !selectedStatus}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Updating...' : 'Update Status'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

