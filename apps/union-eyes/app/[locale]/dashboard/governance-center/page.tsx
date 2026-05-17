/**
 * Governance Center — Procurement-grade institutional cognition trust center.
 *
 * Server component. Reads the cognition kernel registry + canonical ontology
 * and renders the institutional posture, anti-surveillance guarantees, and
 * human-oversight controls. Calm, strategic, no surveillance aesthetics.
 *
 * NOTE: Pure projection of kernel state — no analytics, no scoring.
 */

import {
  cognitionRegistry,
  COGNITION_DOMAINS,
  COGNITION_CONTRACT_VERSION,
  GOVERNANCE_VOCABULARY,
  INSTITUTIONAL_CONCEPTS,
  INSTITUTIONAL_ONTOLOGY_VERSION,
} from '@nzila/institutional-cognition-core';
import { CONTINUITY_COGNITION_VERSION } from '@nzila/institutional-governance-graph';
import { requireUser } from '@/lib/api-auth-guard';
import { RuntimeHydrationFooter } from '@/components/runtime-hydration';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Governance Center · UnionEyes',
  description:
    'Institutional cognition governance, ontology integrity, anti-surveillance guarantees, and human oversight controls.',
};

const GUARANTEES: Array<{ title: string; body: string }> = [
  {
    title: 'Organizational scope only',
    body: 'All cognition operates at organizational, departmental, role-cohort, or process scope. Individual-level observation is rejected at the kernel.',
  },
  {
    title: 'No employee-level optimization',
    body: 'No employee scoring, retention prediction, or discipline modeling. Forbidden vocabulary is enforced repo-wide via CI.',
  },
  {
    title: 'No autonomous governance authority',
    body: 'Cognition surfaces propose, summarize, and explain. Every governance implication that matters is routed for human review.',
  },
  {
    title: 'Explainable by construction',
    body: 'Every cognition output is wrapped in a canonical explainability envelope: evidence, reasoning chain, assumptions, governance implications, provenance.',
  },
  {
    title: 'Canonical institutional ontology',
    body: 'A closed, versioned domain set + concept set + governance vocabulary. Drift is detected; semantic divergence breaks CI.',
  },
  {
    title: 'Auditable provenance',
    body: 'Every envelope records the engine, version, contract version, and timestamp. Evidence lineage flows back to organizational records.',
  },
];

export default async function GovernanceCenterPage() {
  await requireUser();

  const engines = cognitionRegistry.all();
  const enginesByDomain: Record<string, typeof engines> = {};
  for (const eng of engines) {
    for (const dom of eng.domains) {
      (enginesByDomain[dom] ??= []).push(eng);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Institutional Cognition · Trust Center
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Governance Center</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            A transparent view of the institutional cognition substrate that powers UnionEyes —
            its ontology, its governance posture, the engines registered against it, and the
            guarantees procurement, governance, and human-oversight reviewers depend on.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Ontology version</p>
            <p className="mt-2 font-mono text-xl text-slate-900">{INSTITUTIONAL_ONTOLOGY_VERSION}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Contract version</p>
            <p className="mt-2 font-mono text-xl text-slate-900">{COGNITION_CONTRACT_VERSION}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Registered engines</p>
            <p className="mt-2 font-mono text-xl text-slate-900">{engines.length}</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Anti-surveillance guarantees</h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {GUARANTEES.map((g) => (
              <li
                key={g.title}
                className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700"
              >
                <p className="font-medium text-slate-900">{g.title}</p>
                <p className="mt-1 leading-relaxed text-slate-600">{g.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Cognition domains</h2>
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Domain</th>
                  <th className="px-4 py-2">Engines</th>
                  <th className="px-4 py-2">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COGNITION_DOMAINS.map((dom) => {
                  const list = enginesByDomain[dom] ?? [];
                  return (
                    <tr key={dom} className="text-slate-700">
                      <td className="px-4 py-2 font-medium text-slate-900">{dom}</td>
                      <td className="px-4 py-2 font-mono text-slate-700">{list.length}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {list.length === 0
                          ? 'no engine registered'
                          : list.map((e) => `${e.id}@${e.version}`).join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Canonical concepts</h2>
          <div className="flex flex-wrap gap-2">
            {INSTITUTIONAL_CONCEPTS.map((c) => (
              <span
                key={c}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
              >
                {c}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Governance vocabulary</h2>
          <div className="flex flex-wrap gap-2">
            {GOVERNANCE_VOCABULARY.map((v) => (
              <span
                key={v}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
              >
                {v}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Synonyms outside this list are treated as semantic drift and flagged by CI.
          </p>
        </section>

        <footer className="border-t border-slate-200 pt-6 text-xs text-slate-500">
          Institutional cognition substrate ·{' '}
          <span className="font-mono">@nzila/institutional-cognition-core</span> · all surfaces
          remain organizationally scoped, explainable, and labor-safe.
        </footer>
        <RuntimeHydrationFooter
          surface="Governance Center"
          provenance={{
            sourceAdapter: 'institutional-cognition-core/registry + institutional-governance-graph',
            substrateVersion: CONTINUITY_COGNITION_VERSION,
            contractVersion: COGNITION_CONTRACT_VERSION,
          }}
          continuity={{}}
          cognition={{}}
          explainability={{
            visibilityRationale:
              'Projection of the canonical institutional cognition registry and ontology. The Wave 3 continuity cognition layer is rendered as substrate-presence only — no engine outputs, no scoring, no recommendations. Protected governance semantics (Class B, reserved matter, vetoes, holds, overrides) are stripped by the IGG protected-semantics fence before any panel is rendered.',
            reviewPosture: 'inspectable · read-only · provenance-stamped',
          }}
        />
      </div>
    </div>
  );
}
