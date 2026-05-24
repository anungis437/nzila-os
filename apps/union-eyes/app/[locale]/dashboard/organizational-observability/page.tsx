import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { getInstitutionalObservabilityView } from '@/lib/organizational-observability/source';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Institutional Visibility',
  description:
    'Read-only chronology, lineage, continuity pathways, evidence-linked timeline, and provenance coverage for inspectable institutional states. Governance visibility surface — not monitoring, not scoring.',
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

export default async function InstitutionalObservabilityPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  const view = await getInstitutionalObservabilityView();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-800">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Institutional Visibility
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Inspectable institutional states
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          A read-only surface for understanding{' '}
          <strong>how this institutional state emerged</strong> — chronology,
          lineage, continuity pathways, and the evidence, knowledge, and
          policy provenance attached to recorded decisions. This view does not
          score actors, predict outcomes, or recommend actions.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Snapshot generated {fmt(view.generatedAt)} ·{' '}
          {view.substrate.nodes} preserved record(s) ·{' '}
          {view.substrate.edges} relationship(s) ·{' '}
          {view.substrate.decisions} recorded decision(s)
        </p>
      </header>

      {/* Panel 1 — Chronology rail */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Chronology rail</h2>
        <p className="mb-3 text-sm text-slate-600">
          Time-ordered institutional events as preserved in the read substrate.
        </p>
        {view.chronology.length === 0 ? (
          <div className={EMPTY}>
            No chronology entries are currently preserved in this institutional
            substrate.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {view.chronology.map((entry) => (
              <li key={`${entry.sourceId}-${entry.occurredAt}`} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-sm font-medium text-slate-900">
                    {entry.summary}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {fmt(entry.occurredAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Kind: {entry.kind} · Entity: {entry.entityRef}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Panel 2 — Lineage explorer */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Lineage explorer</h2>
        <p className="mb-3 text-sm text-slate-600">
          Procedural lineage attached to recorded decisions — preceding events,
          knowledge sources, and policy references that shaped each decision.
        </p>
        {view.explainability.length === 0 ? (
          <div className={EMPTY}>
            No decisions with lineage records are currently preserved.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {view.explainability.map((rec) => (
              <li key={rec.decisionRef} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-sm font-medium text-slate-900">
                    {rec.summary}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {fmt(rec.occurredAt)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="inline text-slate-500">Evidence references: </dt>
                    <dd className="inline">{rec.evidenceRefs.length}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Knowledge sources: </dt>
                    <dd className="inline">{rec.knowledgeRefs.length}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Policy references: </dt>
                    <dd className="inline">{rec.policyRefs.length}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Preceding events: </dt>
                    <dd className="inline">{rec.precedingEventRefs.length}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Lineage edges: </dt>
                    <dd className="inline">{rec.lineageRefs.length}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Decision type: </dt>
                    <dd className="inline">{rec.decisionType}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Panel 3 — Continuity pathway */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Continuity pathway</h2>
        <p className="mb-3 text-sm text-slate-600">
          Succession breakpoints and continuity safeguards as recorded — the
          procedural traceability of how institutional roles, decisions, and
          obligations carried forward.
        </p>
        {view.continuity.length === 0 ? (
          <div className={EMPTY}>
            No continuity pathway entries are currently preserved.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {view.continuity.map((entry, idx) => (
              <li
                key={
                  entry.decisionId ??
                  entry.edgeId ??
                  `${entry.entityRef}-${entry.occurredAt}-${idx}`
                }
                className="py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-sm font-medium text-slate-900">
                    {entry.summary}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {fmt(entry.occurredAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Kind: {entry.kind} · Entity: {entry.entityRef}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Panel 4 — Evidence-linked timeline */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Evidence-linked timeline</h2>
        <p className="mb-3 text-sm text-slate-600">
          Decisions paired with their evidence references, knowledge sources,
          and policy citations as they were preserved at the time of record.
        </p>
        {view.evidence.length === 0 ? (
          <div className={EMPTY}>
            No evidence-linked entries are currently preserved.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {view.evidence.map((entry) => (
              <li key={entry.decisionId} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-sm font-medium text-slate-900">
                    {entry.summary}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {fmt(entry.occurredAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Evidence references: {entry.evidenceRefs.length} · Knowledge
                  sources: {entry.knowledgeRefs.length} · Policy references:{' '}
                  {entry.policyRefs.length}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Panel 5 — Provenance coverage strip */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Provenance coverage</h2>
        <p className="mb-3 text-sm text-slate-600">
          Counts of recorded decisions accompanied by each provenance class.
          No ratios, percentages, or scores — integers only.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-700 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Total decisions
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.provenance.totalDecisions}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              With evidence
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.provenance.decisionsWithEvidence}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              With knowledge sources
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.provenance.decisionsWithKnowledge}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              With policy references
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.provenance.decisionsWithPolicy}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              With lineage
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.provenance.decisionsWithLineage}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              With preceding event
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.provenance.decisionsWithPrecedingEvent}
            </dd>
          </div>
        </dl>
      </section>

      {/* Panel 6 — Observability snapshot footer */}
      <section className={PANEL}>
        <h2 className={SECTION_HEADER}>Observability snapshot</h2>
        {view.snapshot === null ? (
          <p className="text-sm text-slate-600">
            Snapshot collection is currently disabled. Set{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
              IGG_OBSERVABILITY_ENABLED=1
            </code>{' '}
            to capture counts-only snapshots of the read substrate. No
            behavioural inference is produced regardless.
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            Snapshot generated {fmt(view.snapshot.generatedAt)} ·{' '}
            chronology entries: {view.snapshot.timeline.entries} · evidence
            entries: {view.snapshot.evidence.entries} · continuity entries:{' '}
            {view.snapshot.continuity.entries} · provenance — total decisions:{' '}
            {view.snapshot.provenance.totalDecisions}, with evidence:{' '}
            {view.snapshot.provenance.decisionsWithEvidence}, with knowledge:{' '}
            {view.snapshot.provenance.decisionsWithKnowledge}, with policy:{' '}
            {view.snapshot.provenance.decisionsWithPolicy}, with lineage:{' '}
            {view.snapshot.provenance.decisionsWithLineage}, with preceding
            event:{' '}
            {view.snapshot.provenance.decisionsWithPrecedingEvent}.
          </p>
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
