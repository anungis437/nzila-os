import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { getInstitutionalChronologyView } from '@/lib/institutional-chronology/source';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Institutional Chronology',
  description:
    'Read-only institutional chronology — procedural timeline, institutional evolution, decision lineage, continuity progression, governance epochs, and chronology explainability preserved as inspectable governance history.',
};

const SECTION_HEADER =
  'mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500';
const PANEL =
  'rounded-md border border-slate-200 bg-white p-5 shadow-sm';
const EMPTY =
  'rounded border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500';

function fmt(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function dash(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value.length > 0 ? value : '—';
  return String(value);
}

function kindBadgeClass(kind: string): string {
  const k = kind.toLowerCase();
  if (k === 'decision') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (k === 'affiliation') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (k === 'representation') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (k === 'lineage') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (k === 'epoch_marker') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (k === 'governance_event') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default async function InstitutionalChronologyPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  const view = await getInstitutionalChronologyView();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-800">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Institutional Chronology
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Inspectable governance history
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          A read-only surface for understanding{' '}
          <strong>when this institutional state emerged</strong> — the
          procedural timeline preserved in the read substrate. This view does
          not analyze activity, predict outcomes, or recommend actions.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Snapshot generated {fmt(view.generatedAt)} ·{' '}
          {view.substrate.nodes} preserved record(s) ·{' '}
          {view.substrate.edges} relationship(s) ·{' '}
          {view.substrate.decisions} recorded decision(s)
        </p>
      </header>

      {/* Panel 1 — Procedural timeline */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Procedural timeline</h2>
        <p className="mb-3 text-sm text-slate-600">
          Preserved governance events ordered chronologically — decisions,
          affiliation transitions, representation transitions, governance
          events, lineage relations, and epoch markers as recorded in the
          read substrate. Entries are inspectable, never ranked or scored.
        </p>
        {view.proceduralTimeline.entries.length === 0 ? (
          <div className={EMPTY}>
            No procedural timeline entries are currently preserved in the
            read substrate.
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              {view.proceduralTimeline.entries.length} preserved entry(ies)
            </p>
            <ol className="divide-y divide-slate-100">
              {view.proceduralTimeline.entries.map((entry, idx) => (
                <li
                  key={`${entry.sourceId}-${entry.kind}-${idx}`}
                  className="py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="text-sm font-medium text-slate-900">
                      {dash(entry.summary)}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {fmt(entry.occurredAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${kindBadgeClass(entry.kind)}`}
                    >
                      {entry.kind}
                    </span>
                    {entry.category && (
                      <span className="font-mono text-[11px] text-slate-500">
                        {entry.category}
                      </span>
                    )}
                    {entry.status && (
                      <span className="font-mono text-[11px] text-slate-500">
                        status: {entry.status}
                      </span>
                    )}
                    <span className="break-all">
                      Entity: {dash(entry.entityRef)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
        This surface is governance-safe transparency over preserved
        institutional records. It does not evaluate, rank, predict, or
        recommend. Protected institutional semantics are redacted at the
        graph layer before reaching this view.
      </footer>
    </main>
  );
}
