'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

interface ReportDeductionIssueProps {
  userId: string;
  deductionId?: string;
  onSubmitted?: () => void;
}

const ISSUE_TYPES = [
  { value: 'missing_deduction', label: 'Missing Deduction — Dues were not deducted this period' },
  { value: 'incorrect_amount', label: 'Incorrect Amount — Deduction amount is wrong' },
  { value: 'duplicate_deduction', label: 'Duplicate Deduction — Charged twice for same period' },
  { value: 'unrecognized_deduction', label: 'Unrecognized Deduction — I don\'t recognize this charge' },
  { value: 'other', label: 'Other — Something else' },
] as const;

export default function ReportDeductionIssue({ userId, deductionId, onSubmitted }: ReportDeductionIssueProps) {
  const [issueType, setIssueType] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!issueType || !subject || !description) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/dues/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          issueType,
          subject,
          description,
          payrollDeductionId: deductionId || undefined,
          expectedAmount: expectedAmount ? parseFloat(expectedAmount) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit issue');
      }

      setSubmitted(true);
      toast({
        title: 'Issue Reported',
        description: 'Your deduction issue has been submitted for review.',
      });

      onSubmitted?.();
    } catch (_error) {
      setError('Failed to submit your issue. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to submit deduction issue.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Issue Reported</h3>
            <p className="text-muted-foreground">
              Your deduction issue has been submitted. A union representative will review it
              and follow up with you.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSubmitted(false);
                setIssueType('');
                setSubject('');
                setDescription('');
                setExpectedAmount('');
              }}
            >
              Report Another Issue
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Report a Deduction Issue
        </CardTitle>
        <CardDescription>
          If you notice a problem with your dues deduction, report it here.
          Your union will investigate and respond.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="issueType">Issue Type *</Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger>
                <SelectValue placeholder="Select the type of issue" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Brief summary of the issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail. Include pay period dates if applicable."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedAmount">Expected Amount (optional)</Label>
            <Input
              id="expectedAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={expectedAmount}
              onChange={(e) => setExpectedAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              If the deducted amount is incorrect, enter what you believe the correct amount should be.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Issue Report'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
