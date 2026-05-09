/**
 * Final GO Status Dashboard — Control Plane.
 *
 * Calm, sparse, deterministic projection of the finalization
 * manifest + per-environment certifications + audits.
 *
 * Authority: docs/nzila-finalization/master-finalization-index.md
 */
import { buildFinalGoSnapshot } from "@/lib/final-go";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Final GO Status — Control Plane",
  description:
    "Per-environment GO certification, convergence audit, legitimacy audit.",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 19).replace("T", " ");
}

export default async function FinalGoStatusPage() {
  const snapshot = await buildFinalGoSnapshot();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Final GO Status
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {snapshot.certified
            ? "NZILA FINAL GO STATUS: CERTIFIED"
            : "NZILA FINAL GO STATUS: NOT CERTIFIED"}{" "}
          · Release {snapshot.release ?? "—"} · Recorded {fmt(snapshot.recordedAt)}
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Per-environment certification
          </h2>
        </header>
        <ul className="divide-y divide-border text-sm">
          {snapshot.certifications.map((c) => (
            <li key={c.tier} className="grid grid-cols-12 gap-2 px-6 py-3">
              <div className="col-span-2 font-medium text-foreground">
                {c.tier}
              </div>
              <div className="col-span-3 text-xs text-muted-foreground">
                {c.release}
              </div>
              <div className="col-span-5 text-xs text-muted-foreground">
                {c.areas.filter((a) => a.state === "PROVEN").length} proven ·{" "}
                {c.areas.filter((a) => a.state === "N/A").length} N/A
              </div>
              <div className="col-span-2 text-right text-xs text-foreground">
                {c.verdict}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">
              Convergence audit
            </h2>
          </header>
          <ul className="divide-y divide-border text-sm">
            {snapshot.convergence.map((a) => (
              <li key={a.axis} className="grid grid-cols-12 gap-2 px-6 py-3">
                <div className="col-span-7 text-foreground">{a.axis}</div>
                <div className="col-span-5 text-right text-xs text-muted-foreground">
                  {a.result}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">
              Legitimacy audit
            </h2>
          </header>
          <ul className="divide-y divide-border text-sm">
            {snapshot.legitimacy.map((a) => (
              <li key={a.domain} className="grid grid-cols-12 gap-2 px-6 py-3">
                <div className="col-span-9 text-foreground">{a.domain}</div>
                <div className="col-span-3 text-right text-xs text-muted-foreground">
                  {a.verdict}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Unresolved risks (carry forward)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            None block Phase D closure. Carried to Phase E.
          </p>
        </header>
        <ul className="divide-y divide-border text-sm">
          {snapshot.unresolvedRisks.length === 0 ? (
            <li className="px-6 py-3 text-xs text-muted-foreground">
              No unresolved risks.
            </li>
          ) : (
            snapshot.unresolvedRisks.map((r) => (
              <li key={r.risk} className="grid grid-cols-12 gap-2 px-6 py-3">
                <div className="col-span-6 text-foreground">{r.risk}</div>
                <div className="col-span-4 text-xs text-muted-foreground">
                  {r.mitigation}
                </div>
                <div className="col-span-2 text-right text-xs text-muted-foreground">
                  {r.carry_to}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        Authority: docs/nzila-finalization/master-finalization-index.md
      </p>
    </div>
  );
}
