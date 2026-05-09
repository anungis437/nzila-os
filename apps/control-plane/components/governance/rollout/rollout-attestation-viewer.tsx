import type { LedgerSnapshot } from "@/lib/rollout-governance";

interface Props {
  ledger: LedgerSnapshot;
  limit?: number;
}

/**
 * Rollout Attestation Viewer — interpretable, not audit noise.
 * Authority: docs/nzila-rollout-governance/rollout-attestation-fabric.md
 */
export function RolloutAttestationViewer({ ledger, limit = 20 }: Props) {
  const merged = [
    ...ledger.promotions,
    ...ledger.readiness,
    ...ledger.rollbacks,
    ...ledger.reviews,
  ]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, limit);

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Rollout Attestations
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Most recent governance events across rollout fabric.
        </p>
      </header>
      {merged.length === 0 ? (
        <p className="px-6 py-6 text-sm text-muted-foreground">
          No attestations in the current window.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {merged.map((r) => (
            <li key={r.attestation_id} className="px-6 py-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">
                  {r.attestation_type} · {r.outcome}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.timestamp.slice(0, 19).replace("T", " ")}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[r.subject?.from_tier, r.subject?.tier ?? r.subject?.scope]
                  .filter(Boolean)
                  .join(" → ")}
                {r.subject?.release_id ? ` · ${r.subject.release_id}` : ""}
                {` · ${r.actor}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
