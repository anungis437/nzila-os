/**
 * Executive Operating Intelligence — calm, strategic surface.
 *
 * Server component. Calls the organizational-narratives API to obtain a
 * deterministic executive briefing composed from the full T1–T9 cognition
 * orchestration. NO new inference is performed in this page — it is a
 * projection of envelopes already produced by the cognition kernel.
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireUser } from '@/lib/api-auth-guard';
import {
  composeExecutiveBriefing,
  narrateEnvelopes,
  type ExecutiveBriefing,
  type InstitutionalNarrative,
} from '@/lib/organizational-narratives';
import { runFullInstitutionalCognition } from '@/lib/organizational-operating-intelligence';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Executive Operating Intelligence · UnionEyes',
  description:
    'Calm, strategic projection of institutional cognition: governance coherence, continuity momentum, resilience trajectory.',
};

async function loadBriefing(organizationId: string): Promise<{
  briefing: ExecutiveBriefing;
  narratives: InstitutionalNarrative[];
  failureCount: number;
}> {
  const result = await runFullInstitutionalCognition(organizationId);
  const { narratives } = narrateEnvelopes(result.envelopes);
  const list = Object.values(narratives);
  return {
    briefing: composeExecutiveBriefing(list),
    narratives: list,
    failureCount: result.failures.length,
  };
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const tone =
    confidence === 'very_high' || confidence === 'high'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : confidence === 'moderate'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${tone}`}>{confidence}</span>
  );
}

export default async function ExecutiveOperatingIntelligencePage() {
  const user = await requireUser();

  // headers() ensures dynamic rendering even if SSG is attempted upstream.
  await headers();

  const organizationId = user.organizationId;
  if (!organizationId) redirect('/dashboard');

  const { briefing, narratives, failureCount } = await loadBriefing(organizationId);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Institutional Operating Intelligence · Executive Surface
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Executive Briefing</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            A calm, organizationally scoped projection of the institution&apos;s current cognition
            posture. Each highlight is derived from a fully attributed explainability envelope —
            evidence, reasoning, assumptions, and governance implications — produced by the
            cognition kernel.
          </p>
          <div className="flex items-center gap-3 pt-2 text-xs text-slate-500">
            <span>Generated {new Date(briefing.generatedAt).toLocaleString()}</span>
            <span>·</span>
            <span>{narratives.length} narratives</span>
            {failureCount > 0 && (
              <>
                <span>·</span>
                <span className="text-amber-700">{failureCount} engine(s) degraded</span>
              </>
            )}
          </div>
        </header>

        {briefing.reviewSignals.length > 0 && (
          <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
              Signals routed for human review
            </h2>
            <ul className="space-y-1.5 text-sm text-amber-900">
              {briefing.reviewSignals.map((sig) => (
                <li key={sig} className="leading-relaxed">
                  · {sig}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Highlights</h2>
          {briefing.highlights.length === 0 ? (
            <p className="text-sm text-slate-500">
              No highlights available. Cognition engines have not produced envelopes for this
              organization yet.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {briefing.highlights.map((n) => (
                <li
                  key={n.engine}
                  className="rounded-lg border border-slate-200 bg-white p-5"
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono">{n.domain}</span>
                    <ConfidenceBadge confidence={n.confidence} />
                  </div>
                  <p className="text-base font-medium text-slate-900 leading-snug">
                    {n.headline}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{n.summary}</p>
                  {n.keyReasoning.length > 0 && (
                    <details className="mt-3 text-xs text-slate-600">
                      <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                        Reasoning chain ({n.keyReasoning.length})
                      </summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-5">
                        {n.keyReasoning.map((r, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {r}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  <p className="mt-3 text-xs font-mono text-slate-400">{n.engine}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="border-t border-slate-200 pt-6 text-xs text-slate-500">
          Organizationally scoped · explainable · labor-safe ·{' '}
          <span className="font-mono">briefing v{briefing.briefingVersion}</span>
        </footer>
      </div>
    </div>
  );
}
