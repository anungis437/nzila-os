'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { apiErrorMessage } from '@/lib/client/api-envelope';
import { Badge } from '@/components/ui/badge';
import {
  Send, CheckCircle, Archive, RotateCcw, Loader2,
} from 'lucide-react';

/**
 * Editorial workflow transitions.
 * Each status maps to the actions available from that state.
 */
const WORKFLOW: Record<string, { label: string; target: string; icon: typeof Send; variant: 'default' | 'secondary' | 'destructive' | 'outline' }[]> = {
  draft: [
    { label: 'Submit for Review', target: 'review', icon: Send, variant: 'default' },
  ],
  review: [
    { label: 'Approve & Publish', target: 'published', icon: CheckCircle, variant: 'default' },
    { label: 'Return to Draft', target: 'draft', icon: RotateCcw, variant: 'secondary' },
  ],
  published: [
    { label: 'Archive', target: 'archived', icon: Archive, variant: 'destructive' },
  ],
  archived: [
    { label: 'Restore to Draft', target: 'draft', icon: RotateCcw, variant: 'secondary' },
  ],
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  review: 'In Review',
  published: 'Published',
  archived: 'Archived',
};

interface ContentWorkflowActionsProps {
  itemId: string;
  currentStatus: string;
  title: string;
}

export function ContentWorkflowActions({ itemId, currentStatus, title }: ContentWorkflowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const actions = WORKFLOW[currentStatus] ?? [];
  if (actions.length === 0) return null;

  async function handleTransition(target: string) {
    setError(null);
    setTransitioning(target);

    try {
      const res = await fetch(`/api/content/templates/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(apiErrorMessage(data, 'Failed to update status'));
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError('Network error — please try again');
    } finally {
      setTransitioning(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Workflow:</span>
        <Badge variant="outline" className="text-xs">
          {STATUS_LABELS[currentStatus] ?? currentStatus}
        </Badge>
        <span className="text-xs text-muted-foreground">→</span>
        {actions.map((action) => {
          const Icon = action.icon;
          const isLoading = transitioning === action.target || isPending;

          return (
            <button
              key={action.target}
              onClick={() => handleTransition(action.target)}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                action.variant === 'default'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : action.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
              title={`${action.label}: "${title}"`}
            >
              {transitioning === action.target ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {action.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
