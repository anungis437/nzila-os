import type { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Governance Continuity | UnionEyes",
  description: "Governance continuity workspace for stewardship, oversight, and review workflows.",
};

export default async function GovernanceOverviewPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  // Governance surfaces require officer-level access (level 60+).
  // Officer is the minimum governance experience role.
  const hasAccess = await hasMinRole("officer");
  if (!hasAccess) {
    redirect("/dashboard");
  }

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
