'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createIdempotencyKey } from '@/lib/idempotency';

/**
 * ReviewerActions — Phase 2E client component.
 *
 * Renders reviewer mutation controls on the CourtLens matter detail page.
 * All authorisation is enforced server-side. This component:
 *   - Uses same-origin credentialed fetch (no auth headers from the browser).
 *   - Never sends `x-abr-role` or `x-org-id`.
 *   - Hides buttons that the server-derived role cannot perform (defense-in-depth
 *     only; server also enforces).
 *   - Refreshes the page via router.refresh() after any successful mutation so
 *     the server re-derives all state from the updated event stream.
 */

import type {
  AiSummaryStatus,
  ReferralStatus,
} from '@/modules/incidents/courtlens';
import type { IncidentStatus } from '@/modules/incidents/types';

type ActionPermission =
  | 'incident.update'
  | 'incident.transition';

export interface ReviewerActionsProps {
  matterId: string;
  aiSummaryStatus: AiSummaryStatus;
  referralStatus: ReferralStatus;
  status: IncidentStatus;
  /**
   * Server-derived permission list for the current authenticated user + org.
   * The component filters by ActionPermission internally; any wider ABR
   * permissions passed in are ignored for button rendering.
   */
  permissions: readonly string[];
}

const AI_NEXT: Record<AiSummaryStatus, AiSummaryStatus[]> = {
  ai_draft: ['needs_verification'],
  needs_verification: ['approved', 'rejected', 'revised_by_human'],
  approved: [],
  rejected: ['needs_verification'],
  revised_by_human: ['needs_verification', 'approved'],
};

const REFERRAL_NEXT: Record<ReferralStatus, ReferralStatus[]> = {
  none: ['suggested'],
  suggested: ['approved', 'none'],
  approved: ['sent'],
  sent: ['completed'],
  completed: [],
};

const FSM_NEXT: Record<IncidentStatus, IncidentStatus[]> = {
  new: ['triage'],
  triage: ['assigned'],
  assigned: ['investigating'],
  investigating: ['action_planning'],
  action_planning: ['monitoring'],
  monitoring: ['resolved'],
  resolved: ['closed'],
  closed: ['archived'],
  archived: [],
};

export function ReviewerActions({
  matterId,
  aiSummaryStatus,
  referralStatus,
  status,
  permissions,
}: ReviewerActionsProps) {
  const t = useTranslations('courtlens.reviewerActions');
  const tErr = useTranslations('courtlens.errors');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canUpdate = permissions.includes('incident.update');
  const canTransition = permissions.includes('incident.transition');

  async function callMutation(url: string, body: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          // Idempotency-Key: required by apps/abr/proxy.ts middleware for
          // all non-dev /api mutation requests. See lib/idempotency.ts.
          'Idempotency-Key': createIdempotencyKey(),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `${tErr('reviewerActionsGeneric')} (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  const aiNext = AI_NEXT[aiSummaryStatus] ?? [];
  const referralNext = REFERRAL_NEXT[referralStatus] ?? [];
  const fsmNext = FSM_NEXT[status] ?? [];

  const hasAnything =
    (canUpdate && (aiNext.length > 0 || referralNext.length > 0)) ||
    (canTransition && fsmNext.length > 0);

  if (!hasAnything) {
    return null;
  }

  return (
    <div className="space-y-4 p-6 text-sm" data-testid="reviewer-actions">
      <h3 className="font-poppins text-base font-semibold text-navy">{t('sectionTitle')}</h3>
      <p className="text-xs text-slate-500">
        {t('sectionHint')}
      </p>

      {canUpdate && aiNext.length > 0 && (
        <div data-testid="ai-summary-actions">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('groupAi')}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {aiNext.map((to) => (
              <button
                key={`ai-${to}`}
                type="button"
                disabled={pending}
                onClick={() =>
                  callMutation(
                    `/api/courtlens/matters/${matterId}/ai-summary-status`,
                    { from: aiSummaryStatus, to },
                  )
                }
                className="rounded border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                data-testid={`ai-action-${to}`}
              >
                {to.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {canUpdate && referralNext.length > 0 && (
        <div data-testid="referral-actions">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('groupReferral')}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {referralNext.map((to) => (
              <button
                key={`ref-${to}`}
                type="button"
                disabled={pending}
                onClick={() =>
                  callMutation(
                    `/api/courtlens/matters/${matterId}/referral-status`,
                    { from: referralStatus, to },
                  )
                }
                className="rounded border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                data-testid={`referral-action-${to}`}
              >
                {to}
              </button>
            ))}
          </div>
        </div>
      )}

      {canTransition && fsmNext.length > 0 && (
        <div data-testid="transition-actions">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('groupTransition')}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {fsmNext.map((to) => (
              <button
                key={`fsm-${to}`}
                type="button"
                disabled={pending}
                onClick={() =>
                  callMutation(
                    `/api/courtlens/matters/${matterId}/transition`,
                    { to, reason: t('transitionReason') },
                  )
                }
                className="rounded border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                data-testid={`transition-action-${to}`}
              >
                {to.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600" data-testid="reviewer-actions-error">
          {error}
        </p>
      )}
    </div>
  );
}
