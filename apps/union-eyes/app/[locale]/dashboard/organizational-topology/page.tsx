import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { getInstitutionalTopologyView } from '@/lib/organizational-topology/source';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Institutional Topology',
  description:
    'Read-only institutional topology — institutional hierarchy, affiliation structure, delegation pathways, governance lineage, and continuity-aware structures preserved as inspectable institutional relationships.',
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

export default async function InstitutionalTopologyPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  const view = await getInstitutionalTopologyView();

  const hierarchyEdgeCount = view.affiliationRepresentation.edges.length;
  const cohortCount = view.affiliationRepresentation.cohorts.length;
  const delegationResolved = view.delegation.filter((d) => d.state === 'resolved').length;
  const delegationCyclic = view.delegation.filter((d) => d.state === 'cyclic').length;
  const delegationUnresolved = view.delegation.filter((d) => d.state === 'unresolved_dangling').length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-800">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Institutional Topology
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Inspectable institutional relationships
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          A read-only surface for understanding{' '}
          <strong>the shape of this institutional topology</strong> —
          institutional hierarchy, affiliation structure, representation
          continuity, delegation pathways, governance lineage, and other
          continuity-aware structures preserved in the read substrate. This
          view does not score actors, predict outcomes, or recommend actions.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Snapshot generated {fmt(view.generatedAt)} ·{' '}
          {view.substrate.nodes} preserved record(s) ·{' '}
          {view.substrate.edges} relationship(s) ·{' '}
          {view.substrate.decisions} recorded decision(s)
        </p>
      </header>

      {/* Explainability overlay — what this view shows / does not show */}
      <section
        className="mb-6 rounded-md border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700"
        aria-label="What this view shows and does not show"
      >
        <h2 className={SECTION_HEADER}>What this view shows / does not show</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Shows
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>Preserved institutional hierarchy and sub-structure.</li>
              <li>Preserved affiliation and representation relationships.</li>
              <li>Delegation pathways with procedural state at resolution time.</li>
              <li>Governance lineage chains computed from supersession and override edges.</li>
              <li>Continuity-aware topology entries with kind classification.</li>
              <li>Integer counts only — no ratios, percentages, or rankings.</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
              Does not show
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>Scores, weights, or rankings of any actor or relationship.</li>
              <li>Predictions, projections, or recommendations.</li>
              <li>Inferred or synthesized relationships not present in the read substrate.</li>
              <li>Protected institutional semantics — redacted at the graph layer.</li>
              <li>Influence networks, social topologies, or social graph framings.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Panel 1 — Institutional hierarchy */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Institutional hierarchy</h2>
        <p className="mb-3 text-sm text-slate-600">
          Procedural ancestry and sub-structure as preserved across
          governance bodies, federations, locals, committees, and bargaining
          units. Counts are integers; relationships are inspectable, never
          ranked or scored.
        </p>
        {view.hierarchy.length === 0 ? (
          <div className={EMPTY}>
            No institutional hierarchy entries are currently preserved in the
            read substrate.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {view.hierarchy.map((node) => (
              <li key={`${node.iggKind}:${node.entityId}`} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-sm font-medium text-slate-900">
                    {dash(node.entityId)}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {node.iggKind}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Procedural ancestry: {node.ancestors.length} preserved
                  record(s) · Sub-structure: {node.descendants.length}{' '}
                  preserved record(s)
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Panel 2 — Affiliation structure & representation continuity */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>
          Affiliation structure &amp; representation continuity
        </h2>
        <p className="mb-3 text-sm text-slate-600">
          Continuity-linked relationships across affiliated bodies and
          representation pathways — preserved institutional records of who
          affiliates with whom and who represents whom, never inferred and
          never weighted.
        </p>
        {hierarchyEdgeCount === 0 ? (
          <div className={EMPTY}>
            No affiliation structure or representation continuity entries are
            currently preserved.
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              {hierarchyEdgeCount} preserved relationship(s) ·{' '}
              {cohortCount} affiliation cohort(s)
            </p>
            <ol className="divide-y divide-slate-100">
              {view.affiliationRepresentation.edges.map((edge, idx) => (
                <li
                  key={`${edge.sourceEntityId}-${edge.targetEntityId}-${idx}`}
                  className="py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="text-sm font-medium text-slate-900">
                      {dash(edge.sourceEntityId)} → {dash(edge.targetEntityId)}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {edge.relationship}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            {cohortCount > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Affiliation cohorts
                </h3>
                <p className="mb-3 text-xs text-slate-500">
                  Cohorts are grouped affiliations preserved in the read
                  substrate. Member counts are integers; no ranking or
                  weighting is applied.
                </p>
                <ol className="divide-y divide-slate-100">
                  {view.affiliationRepresentation.cohorts.map((cohort, idx) => (
                    <li
                      key={`${cohort.organizationId}-${idx}`}
                      className="py-2"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <span className="text-sm font-medium text-slate-900">
                          {dash(cohort.organizationId)}
                        </span>
                        <span className="font-mono text-xs text-slate-500">
                          {cohort.memberEntityIds.length} preserved member(s)
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </section>

      {/* Panel 3 — Delegation pathways */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Delegation pathways</h2>
        <p className="mb-3 text-sm text-slate-600">
          Continuity-aware structures of delegated voting eligibility as
          resolved per session — origin entity, terminal eligible voter, and
          the procedural state preserved at resolution time. No weighting,
          ranking, or recommendation is produced.
        </p>
        {view.delegation.length === 0 ? (
          <div className={EMPTY}>
            No delegation pathway entries are currently preserved.
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Resolved: {delegationResolved} · Cyclic (broken):{' '}
              {delegationCyclic} · Unresolved (dangling):{' '}
              {delegationUnresolved}
            </p>
            <ol className="divide-y divide-slate-100">
              {view.delegation.map((entry, idx) => {
                const stateBadge =
                  entry.state === 'resolved'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : entry.state === 'cyclic'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600';
                const stateLabel =
                  entry.state === 'resolved'
                    ? 'Resolved'
                    : entry.state === 'cyclic'
                    ? 'Cyclic (broken)'
                    : 'Unresolved (dangling)';
                const hops = Math.max(entry.path.length - 1, 0);
                return (
                  <li
                    key={`${entry.votingSessionId}:${entry.originatorEntityId}:${idx}`}
                    className="py-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <span className="text-sm font-medium text-slate-900">
                        {dash(entry.originatorEntityId)} →{' '}
                        {dash(entry.terminalEntityId ?? undefined)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${stateBadge}`}
                      >
                        {stateLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Session: {entry.votingSessionId} · Hops: {hops}
                    </p>
                    {entry.path.length > 0 && (
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                        Pathway: {entry.path.join(' → ')}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      {/* Panel 4 — Governance lineage */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Governance lineage</h2>
        <p className="mb-3 text-sm text-slate-600">
          Procedural ancestry computed from preserved supersession and
          override edges. Each chain reads oldest → newest; cycles are
          defensively broken at the graph layer before reaching this view.
        </p>
        {view.lineage.length === 0 ? (
          <div className={EMPTY}>
            No governance lineage chains are currently preserved.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {view.lineage.map((chain, idx) => (
              <li
                key={`${chain.originEntityId}-${idx}`}
                className="py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-sm font-medium text-slate-900">
                    Origin: {dash(chain.originEntityId)}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {chain.chain.length} preserved hop(s)
                  </span>
                </div>
                {chain.chain.length > 0 && (
                  <ol className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-600">
                    {chain.chain.map((step, stepIdx) => (
                      <li
                        key={`${step}-${stepIdx}`}
                        className="flex items-center gap-1"
                      >
                        <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px]">
                          <span className="text-slate-400">{stepIdx + 1}.</span>
                          <span className="break-all text-slate-700">{step}</span>
                        </span>
                        {stepIdx < chain.chain.length - 1 && (
                          <span aria-hidden className="text-slate-400">
                            →
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Panel 5 — Continuity-aware topology */}
      <section className={`${PANEL} mb-6`}>
        <h2 className={SECTION_HEADER}>Continuity-aware topology</h2>
        <p className="mb-3 text-sm text-slate-600">
          Continuity pathways and succession breakpoints aligned to the
          preserved institutional records. Entries are continuity-linked
          relationships only; protected institutional semantics are redacted
          at the graph layer before reaching this view.
        </p>
        {view.continuityTopology.length === 0 ? (
          <div className={EMPTY}>
            No continuity-aware topology entries are currently preserved.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {view.continuityTopology.map((entry, idx) => {
              const kindLower = String(entry.kind).toLowerCase();
              const kindBadge = kindLower.includes('breakpoint')
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : kindLower.includes('succession')
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : kindLower.includes('supersed') ||
                    kindLower.includes('override')
                ? 'border-violet-200 bg-violet-50 text-violet-700'
                : kindLower.includes('decision')
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-slate-50 text-slate-600';
              return (
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
                      {dash(entry.summary)}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {fmt(entry.occurredAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${kindBadge}`}
                    >
                      {entry.kind}
                    </span>
                    <span className="break-all">
                      Entity: {entry.entityRef}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Panel 6 — Topology coverage strip (explainability overlay) */}
      <section className={PANEL}>
        <h2 className={SECTION_HEADER}>Topology coverage</h2>
        <p className="mb-3 text-sm text-slate-600">
          Counts of preserved topology entries by class. Integers only — no
          ratios, percentages, or rankings. The explainability overlay
          surfaces only what is preserved in the read substrate.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-700 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Hierarchy entries
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.hierarchy.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Affiliation / representation edges
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {hierarchyEdgeCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Affiliation cohorts
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {cohortCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Delegation resolutions
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.delegation.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Governance lineage chains
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.lineage.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Continuity-aware entries
            </dt>
            <dd className="mt-1 font-mono text-base text-slate-900">
              {view.continuityTopology.length}
            </dd>
          </div>
        </dl>
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
