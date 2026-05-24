/**
 * Longitudinal Institutional Cognition — graph-anchored storybook surface.
 *
 * Server component. Composes a deterministic institutional storybook from
 * the kernel's full T1–T9 cognition pass, projected by domain into calm,
 * narrative chapters. NO new inference happens here.
 *
 * Calm UX language. Anti-surveillance posture explicit. Anchors taxonomy
 * nodes for downstream graph navigation surfaces.
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireUser } from '@/lib/api-auth-guard';
import { composeInstitutionalStorybook } from '@/lib/organizational-storytelling';
import { runFullInstitutionalCognition } from '@/lib/organizational-operating-intelligence';
import { RuntimeHydrationFooter } from '@/components/runtime-hydration';
import { CONTINUITY_COGNITION_VERSION } from '@nzila/organizational-governance-graph';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Longitudinal Institutional Context · UnionEyes',
  description:
    'Calm, domain-grouped institutional storytelling: governance evolution, continuity maturity, resilience progression, organizational adaptation. Human-reviewed, review-required assistive reasoning — institutional context support for governance leaders.',
};

function ConfidenceChip({ confidence }: { confidence: string }) {
  const tone =
    confidence === 'very_high' || confidence === 'high'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : confidence === 'moderate'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}>
      {confidence.replace('_', ' ')}
    </span>
  );
}

export default async function LongitudinalCognitionPage() {
  const user = await requireUser();
  await headers();
  const organizationId = user.organizationId;
  if (!organizationId) redirect('/dashboard');

  const cognition = await runFullInstitutionalCognition(organizationId);
  const storybook = composeInstitutionalStorybook({
    organizationId,
    envelopes: cognition.envelopes,
  });

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Institutional Context Support · Longitudinal Surface · Human-reviewed
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Institutional Chronology Storybook
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            A calm, organizationally scoped projection of how the institution&apos;s governance,
            continuity, resilience, and memory have evolved. Each chapter is anchored to the
            canonical institutional taxonomy and derived from a fully attributed reasoning
            envelope. Assistive only — governance authority remains with humans; all signals
            below are review-required. No individual is profiled. No workforce inference is
            produced.
          </p>
          <p className="text-xs text-slate-500">
            Composed at {new Date(storybook.composedAt).toLocaleString()} ·{' '}
            {storybook.stories.length} domain stor{storybook.stories.length === 1 ? 'y' : 'ies'}
          </p>
        </header>

        {storybook.briefing.reviewSignals.length > 0 ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold text-amber-900">
              Governance Review Signals ({storybook.briefing.reviewSignals.length})
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-amber-900/90">
              {storybook.briefing.reviewSignals.slice(0, 6).map((signal) => (
                <li key={signal} className="leading-relaxed">
                  · {signal}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-8">
          {storybook.stories.map((story) => (
            <article
              key={story.domain}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <header className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {story.domain.replace(/_/g, ' ')}
                </p>
                <h2 className="text-xl font-semibold text-slate-900">{story.title}</h2>
                <p className="text-sm text-slate-600">{story.subtitle}</p>
                <p className="pt-1 text-xs text-slate-500">{story.executiveSummary}</p>
              </header>

              {story.chapters.length === 0 ? (
                <p className="mt-4 text-sm italic text-slate-500">
                  No cognition chapters available for this domain in the current period.
                </p>
              ) : (
                <ol className="mt-5 space-y-4">
                  {story.chapters.map((chapter, idx) => (
                    <li
                      key={chapter.id}
                      className="rounded-lg border border-slate-100 bg-slate-50/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Chapter {idx + 1}
                          </p>
                          <h3 className="text-base font-semibold text-slate-900">
                            {chapter.heading}
                          </h3>
                        </div>
                        <ConfidenceChip confidence={chapter.confidence} />
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{chapter.body}</p>
                      {chapter.anchors.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {chapter.anchors.map((anchor) => (
                            <span
                              key={anchor.id}
                              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                              title={anchor.id}
                            >
                              {anchor.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-[11px] text-slate-400">
                        Anchored at {new Date(chapter.anchoredAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              {story.reviewSignals.length > 0 ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-medium text-slate-600">
                    {story.reviewSignals.length} review signal
                    {story.reviewSignals.length === 1 ? '' : 's'} for this domain
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {story.reviewSignals.map((signal) => (
                      <li key={signal}>· {signal}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))}
        </section>

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          Storybook version {storybook.storyVersion} · {cognition.envelopes.length} cognition
          envelopes composed · {cognition.failures.length} engine failure
          {cognition.failures.length === 1 ? '' : 's'} isolated
        </footer>
        <RuntimeHydrationFooter
          surface="Longitudinal Institutional Context"
          provenance={{
            sourceAdapter: 'organizational-operating-intelligence/runFullInstitutionalCognition',
            substrateVersion: CONTINUITY_COGNITION_VERSION,
            contractVersion: storybook.storyVersion,
          }}
          chronology={{}}
          continuity={{}}
          cognition={{}}
          explainability={{
            visibilityRationale:
              'Storybook chapters are deterministic projections of the institutional cognition envelopes. The Wave 3 continuity cognition overlay shows that the continuity substrate is hydrated but does not surface any engine output or governance recommendation here — it is institutional context support, not monitoring.',
            reviewPosture: 'assistive · human-reviewed · review-required',
          }}
        />
      </div>
    </div>
  );
}
