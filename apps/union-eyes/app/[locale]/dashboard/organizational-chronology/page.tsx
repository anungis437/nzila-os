import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { hasInstitutionalTopologyAccess } from '@/lib/organizational-topology/access';
import { getInstitutionalChronologyView } from '@/lib/organizational-chronology/source';

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

// PR #752 round 8: this reads the same cross-org institutional graph as
// the topology dashboard (no per-org filter) — gate it the same way, see
// lib/organizational-topology/access.ts.
export default async function InstitutionalChronologyPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  const orgId = user.organizationId;
  const hasAccess = orgId ? await hasInstitutionalTopologyAccess(user.userId, orgId) : false;
  if (!hasAccess) {
    redirect('/dashboard');
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

      {/* Panel 2 — Institutional evolution */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Institutional evolution</h2>
        <p className="mb-3 text-sm text-slate-600">
          Preserved organization, affiliation, and representation transitions
          rendered as procedural history rails. No trend rates, no analytics,
          and no inferred changes.
        </p>

        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Organizations
            </h3>
            {view.evolution.organizations.length === 0 ? (
              <div className={EMPTY}>No organization evolution entries.</div>
            ) : (
              <ul className="space-y-3">
                {view.evolution.organizations.map((org) => (
                  <li key={org.organizationId} className="rounded border border-slate-200 p-3">
                    <p className="break-all font-mono text-[11px] text-slate-600">
                      {dash(org.organizationId)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {org.entries.length} preserved entry(ies)
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Affiliations
            </h3>
            {view.evolution.affiliations.length === 0 ? (
              <div className={EMPTY}>No affiliation evolution entries.</div>
            ) : (
              <ul className="space-y-3">
                {view.evolution.affiliations.map((aff) => (
                  <li key={aff.affiliationEdgeId} className="rounded border border-slate-200 p-3">
                    <p className="break-all font-mono text-[11px] text-slate-600">
                      {dash(aff.affiliationEdgeId)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {aff.entries.length} preserved entry(ies)
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Representations
            </h3>
            {view.evolution.representations.length === 0 ? (
              <div className={EMPTY}>No representation evolution entries.</div>
            ) : (
              <ul className="space-y-3">
                {view.evolution.representations.map((rep) => (
                  <li key={rep.representationEdgeId} className="rounded border border-slate-200 p-3">
                    <p className="break-all font-mono text-[11px] text-slate-600">
                      {dash(rep.representationEdgeId)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {rep.entries.length} preserved entry(ies)
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Panel 3 — Decision lineage */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Decision lineage</h2>
        <p className="mb-3 text-sm text-slate-600">
          Preserved supersession and override chains rendered as chronology
          lineage. Each chain remains inspectable as procedural history,
          without impact ranking or predictive sequencing.
        </p>

        {view.lineage.length === 0 ? (
          <div className={EMPTY}>No decision lineage chains are preserved.</div>
        ) : (
          <div className="space-y-4">
            {view.lineage.map((lin) => (
              <article
                key={lin.originEntityId}
                className="rounded border border-slate-200 p-4"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Origin entity
                </p>
                <p className="break-all font-mono text-[11px] text-slate-700">
                  {dash(lin.originEntityId)}
                </p>

                <div className="mt-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                    Lineage chain
                  </p>
                  <p className="break-all text-sm text-slate-700">
                    {lin.chain.length > 0 ? lin.chain.join(' -> ') : '—'}
                  </p>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Entity chronology
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {lin.chronology.length} preserved decision point(s)
                    </p>
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Per-decision drill
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {lin.decisionTimelines.length} decision timeline(s)
                    </p>
                  </div>
                </div>

                {lin.decisionTimelines.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {lin.decisionTimelines.map((timeline) => (
                      <li
                        key={timeline.decisionId}
                        className="rounded border border-slate-100 px-3 py-2 text-xs text-slate-600"
                      >
                        <span className="break-all font-mono text-[11px]">
                          {dash(timeline.decisionId)}
                        </span>{' '}
                        · {timeline.entries.length} preserved entry(ies)
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Panel 4 — Continuity progression */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Continuity progression</h2>
        <p className="mb-3 text-sm text-slate-600">
          Institutional continuity rendered as preserved succession and tenure
          progression. Breakpoints are procedural markers, not personnel
          evaluations.
        </p>

        {view.continuity.length === 0 ? (
          <div className={EMPTY}>No continuity progression entries are preserved.</div>
        ) : (
          <div className="space-y-4">
            {view.continuity.map((cont) => (
              <article
                key={cont.organizationId || 'global'}
                className="rounded border border-slate-200 p-4"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Organization
                </p>
                <p className="break-all font-mono text-[11px] text-slate-700">
                  {dash(cont.organizationId)}
                </p>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Continuity entries
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {cont.entries.length} preserved entry(ies)
                    </p>
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Succession breakpoints
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {cont.breakpoints.length} preserved marker(s)
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Panel 5 — Governance epochs */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Governance epochs</h2>
        <p className="mb-3 text-sm text-slate-600">
          Epoch markers show preserved institutional transition points. These
          are rendered as markers only, not duration periods or ranked phases.
        </p>
        {view.epochs.length === 0 ? (
          <div className={EMPTY}>No governance epoch markers are preserved.</div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {view.epochs.map((epoch, idx) => (
              <li key={`${epoch.sourceId}-${idx}`} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-sm font-medium text-slate-900">
                    {dash(epoch.summary)}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {fmt(epoch.occurredAt)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span
                    className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${kindBadgeClass(epoch.kind)}`}
                  >
                    {epoch.kind}
                  </span>
                  {epoch.category && (
                    <span className="font-mono text-[11px] text-slate-500">
                      {epoch.category}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Panel 6 — Chronology explainability */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Chronology explainability</h2>
        <p className="mb-3 text-sm text-slate-600">
          Provenance references for preserved chronology entries. This is
          retrospective traceability only, never prediction or recommendation.
        </p>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Decisions</p>
            <p className="mt-1 text-sm text-slate-700">
              {view.provenanceCoverage.totalDecisions}
            </p>
          </div>
          <div className="rounded border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">With evidence</p>
            <p className="mt-1 text-sm text-slate-700">
              {view.provenanceCoverage.decisionsWithEvidence}
            </p>
          </div>
          <div className="rounded border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">With knowledge</p>
            <p className="mt-1 text-sm text-slate-700">
              {view.provenanceCoverage.decisionsWithKnowledge}
            </p>
          </div>
          <div className="rounded border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">With policy</p>
            <p className="mt-1 text-sm text-slate-700">
              {view.provenanceCoverage.decisionsWithPolicy}
            </p>
          </div>
          <div className="rounded border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">With lineage</p>
            <p className="mt-1 text-sm text-slate-700">
              {view.provenanceCoverage.decisionsWithLineage}
            </p>
          </div>
          <div className="rounded border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">With preceding event</p>
            <p className="mt-1 text-sm text-slate-700">
              {view.provenanceCoverage.decisionsWithPrecedingEvent}
            </p>
          </div>
        </div>

        {view.explainability.length === 0 ? (
          <div className={EMPTY}>No explainability records are preserved.</div>
        ) : (
          <ul className="space-y-2">
            {view.explainability.map((record) => {
              const refs =
                record.evidenceRefs.length +
                record.knowledgeRefs.length +
                record.policyRefs.length;
              return (
                <li
                  key={record.decisionRef}
                  className="rounded border border-slate-100 px-3 py-2 text-xs text-slate-600"
                >
                  <span className="break-all font-mono text-[11px]">
                    {record.decisionRef}
                  </span>{' '}
                  · refs: {refs} · lineage refs: {record.lineageRefs.length} ·
                  preceding events: {record.precedingEventRefs.length}
                </li>
              );
            })}
          </ul>
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
