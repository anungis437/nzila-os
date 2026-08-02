import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Governance Continuity | UnionEyes",
  description: "Governance continuity workspace for stewardship, oversight, and review workflows.",
};

export default function GovernanceOverviewPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Governance Continuity
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Governance Continuity Overview
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          This workspace brings together oversight, policy continuity, evidence trails,
          and review posture in one place for governance-facing roles.
        </p>
      </section>
    </div>
  );
}
