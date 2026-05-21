/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.0.0
 *
 * ICRAReportGate — calm, editorial premium section gate.
 *
 * This is NOT a SaaS paywall. No countdown. No scarcity language. No urgency tactics.
 * The experience should feel like an institutional boundary, not a conversion funnel.
 *
 * Tone: "This analysis is available in the Executive Continuity Brief."
 *       Calm. Confident. Respectful of the institution's autonomy.
 */

'use client';

import { useState } from 'react';
import type { ReportTierId } from '@/lib/icra/types';
import { COPY } from '@/lib/icra/copy';

interface ICRAReportGateProps {
  /** Name of the locked section, shown in the gate description. */
  sectionName: string;
  /** One-sentence teaser — a partial, evocative observation from within the section. */
  teaser: string;
  /** Which tier unlocks this section. */
  requiredTier: Exclude<ReportTierId, 'continuity_reflection'>;
  /** Assessment UUID — required to open a checkout session. */
  assessmentId: string;
  /** Override CTA label if needed. */
  ctaLabel?: string;
}

export function ICRAReportGate({
  sectionName,
  teaser,
  requiredTier,
  assessmentId,
  ctaLabel,
}: ICRAReportGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBrief = requiredTier === 'executive_continuity_brief';
  const defaultLabel = isBrief
    ? COPY.reportGate.briefCtaLabel
    : COPY.reportGate.diagnosticCtaLabel;
  const lockedLabel = isBrief
    ? COPY.reportGate.briefLockedLabel
    : COPY.reportGate.diagnosticLockedLabel;

  const resolvedLabel = ctaLabel ?? defaultLabel;

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/icra/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, tierId: requiredTier }),
      });
      const data = (await res.json()) as { url?: string; error?: string; tierId?: string };
      if (res.status === 409 && data.tierId) {
        // Already unlocked — reload the page to reflect the current tier
        window.location.reload();
        return;
      }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not open checkout. Please try again.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-xl border border-stone-200 overflow-hidden">
      {/* Blurred teaser content */}
      <div className="select-none px-6 py-5 blur-[3px] pointer-events-none" aria-hidden="true">
        <p className="text-sm text-stone-600 leading-relaxed italic">{teaser}</p>
        <div className="mt-3 space-y-2">
          <div className="h-3 rounded-full bg-stone-200 w-3/4" />
          <div className="h-3 rounded-full bg-stone-200 w-5/6" />
          <div className="h-3 rounded-full bg-stone-200 w-2/3" />
        </div>
      </div>

      {/* Gate overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm px-6 py-6 text-center space-y-4">
        {/* Lock mark — editorial, not icon-heavy */}
        <div className="h-px w-8 bg-stone-300" />

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            {sectionName}
          </p>
          <p className="text-sm text-stone-700 leading-relaxed max-w-xs">
            {lockedLabel}
          </p>
        </div>

        {isBrief && (
          <p className="text-xs text-stone-400 max-w-xs leading-relaxed">
            {COPY.reportGate.gateNote}
          </p>
        )}

        {error && (
          <p className="text-xs text-red-600 max-w-xs">{error}</p>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="inline-block rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 hover:border-stone-400 hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Opening checkout…' : resolvedLabel}
        </button>
      </div>
    </div>
  );
}
