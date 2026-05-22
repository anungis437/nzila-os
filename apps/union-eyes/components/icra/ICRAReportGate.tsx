/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.1.0
 *
 * ICRAReportGate — editorial, premium institutional gate.
 *
 * This is not a SaaS paywall. There is no countdown, scarcity, or coercion.
 * The gate reads as a section of a real published document: a chapter number,
 * the chapter title, an evocative one-line teaser drawn from inside the
 * analysis, a short table of contents for that chapter, and a calm,
 * institutional invitation to obtain the full document.
 *
 * Tone: "This chapter belongs to the Executive Continuity Brief."
 *       Calm. Confident. Worth what is being asked.
 */

'use client';

import { useState } from 'react';
import type { ReportTierId } from '@/lib/icra/types';
import { COPY } from '@/lib/icra/copy';

interface ICRAReportGateProps {
  /** Name of the locked section, shown as the chapter title. */
  sectionName: string;
  /** One-sentence teaser — a partial, evocative observation from within the section. */
  teaser: string;
  /** Which tier unlocks this section. */
  requiredTier: Exclude<ReportTierId, 'continuity_reflection'>;
  /** Assessment UUID — required to open a checkout session. */
  assessmentId: string;
  /** Override CTA label if needed. */
  ctaLabel?: string;
  /** Optional chapter index — adds "Chapter 0n" eyebrow. */
  chapterNumber?: number;
  /** Optional "what is inside" bullet preview (3–4 short items). */
  chapters?: readonly string[];
}

const TIER_PRICE: Record<Exclude<ReportTierId, 'continuity_reflection'>, string> = {
  executive_continuity_brief: '$1,200 CAD',
  institutional_continuity_diagnostic: '$6,500 CAD',
};

const TIER_NAME: Record<Exclude<ReportTierId, 'continuity_reflection'>, string> = {
  executive_continuity_brief: 'Executive Continuity Brief',
  institutional_continuity_diagnostic: 'Institutional Continuity Diagnostic',
};

const TIER_FORMAT: Record<Exclude<ReportTierId, 'continuity_reflection'>, readonly string[]> = {
  executive_continuity_brief: [
    'Boardroom-ready PDF · 18–24 pages',
    'Plain-English, evidence-traceable',
    'Doctrine-aligned · Methodologically auditable',
  ],
  institutional_continuity_diagnostic: [
    'Facilitated diagnostic engagement',
    'Cross-functional working sessions',
    'Stewardship-grade documentation',
  ],
};

export function ICRAReportGate({
  sectionName,
  teaser,
  requiredTier,
  assessmentId,
  ctaLabel,
  chapterNumber,
  chapters,
}: ICRAReportGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBrief = requiredTier === 'executive_continuity_brief';
  const defaultLabel = isBrief
    ? COPY.reportGate.briefCtaLabel
    : COPY.reportGate.diagnosticCtaLabel;

  const resolvedLabel = ctaLabel ?? defaultLabel;
  const price = TIER_PRICE[requiredTier];
  const tierName = TIER_NAME[requiredTier];
  const formatLines = TIER_FORMAT[requiredTier];
  const chapterEyebrow =
    typeof chapterNumber === 'number'
      ? `Chapter ${String(chapterNumber).padStart(2, '0')} · ${tierName}`
      : tierName;

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
    <article
      className="relative overflow-hidden rounded-2xl border border-stone-900/10 bg-gradient-to-br from-stone-50 via-white to-stone-50/40 shadow-[0_1px_0_0_rgba(0,0,0,0.04),0_24px_48px_-32px_rgba(28,25,23,0.18)] print:border-stone-300 print:shadow-none"
      aria-label={`${sectionName} (available in ${tierName})`}
    >
      {/* Editorial brand strip */}
      <header className="flex items-center justify-between gap-4 border-b border-stone-200/70 bg-stone-900 px-6 py-3 text-white print:bg-white print:text-stone-900">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 print:text-stone-500">
          {chapterEyebrow}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55 print:text-stone-400">
          UnionEyes · Confidential Issue
        </p>
      </header>

      <div className="grid gap-0 md:grid-cols-[1.35fr_1fr]">
        {/* ── Editorial preview pane ───────────────────────────────────── */}
        <div className="space-y-6 px-7 py-8 md:px-9 md:py-10">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
              Chapter title
            </p>
            <h3 className="font-sans text-2xl font-semibold leading-tight tracking-tight text-stone-900 md:text-[1.65rem]">
              {sectionName}
            </h3>
            <p className="text-[15px] italic leading-relaxed text-stone-600">
              &ldquo;{teaser}&rdquo;
            </p>
          </div>

          {chapters && chapters.length > 0 && (
            <div className="space-y-3 border-l-2 border-stone-200 pl-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                What is in this chapter
              </p>
              <ul className="space-y-2 text-sm text-stone-700">
                {chapters.map((c, i) => (
                  <li key={i} className="flex gap-3 leading-relaxed">
                    <span className="mt-[3px] inline-block w-5 shrink-0 font-mono text-[11px] tabular-nums text-stone-400">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">
            Methodology: deterministic · doctrine v1.0.0 · evidence-traceable
          </p>
        </div>

        {/* ── Premium CTA pane ─────────────────────────────────────────── */}
        <aside className="flex flex-col justify-between gap-6 border-t border-stone-200/80 bg-white/70 px-7 py-8 backdrop-blur-sm md:border-l md:border-t-0 md:px-8 md:py-10">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                Available in
              </p>
              <p className="font-sans text-lg font-semibold leading-snug tracking-tight text-stone-900">
                {tierName}
              </p>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-sans text-3xl font-semibold tracking-tight text-stone-900">
                {price}
              </span>
              <span className="text-xs uppercase tracking-widest text-stone-400">one issue</span>
            </div>

            <ul className="space-y-2 border-t border-stone-200/80 pt-4 text-[13px] text-stone-700">
              {formatLines.map((line, i) => (
                <li key={i} className="flex gap-2 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            {error && (
              <p className="text-xs leading-relaxed text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 print:hidden"
            >
              <span>{loading ? 'Opening secure checkout…' : resolvedLabel}</span>
              {!loading && (
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              )}
            </button>
            <p className="text-[11px] leading-relaxed text-stone-500">
              Issued under the holder of this assessment link. Stripe-secured payment.
              Refundable for 7 days if the analysis is not actionable for your governance body.
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}
