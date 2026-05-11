import type { AttestationRecord } from "@/lib/rollout-governance";

interface Props {
  promotions: AttestationRecord[];
  limit?: number;
}

/**
 * Promotion Ledger Viewer — append-only institutional rollout memory.
 * Authority: docs/nzila-rollout-governance/foundations/rollout-attestation-fabric.md
 */
export function PromotionLedgerViewer({ promotions, limit = 25 }: Props) {
  const rows = promotions.slice(0, limit);
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Promotion Ledger
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Append-only. Institutional rollout memory.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="px-6 py-6 text-sm text-muted-foreground">
          No promotion attestations recorded in the current window.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">When</th>
                <th className="px-6 py-3 font-medium">From → To</th>
                <th className="px-6 py-3 font-medium">Release</th>
                <th className="px-6 py-3 font-medium">Reviewer</th>
                <th className="px-6 py-3 font-medium">Continuity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const overrode = Boolean(
                  (r.payload as { continuity_window_override?: boolean })
                    ?.continuity_window_override,
                );
                return (
                  <tr key={r.attestation_id}>
                    <td className="px-6 py-3 text-xs text-muted-foreground">
                      {r.timestamp.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs text-foreground">
                        {r.subject?.from_tier} → {r.subject?.tier}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-foreground">
                      {r.subject?.release_id ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-foreground">{r.actor}</td>
                    <td className="px-6 py-3 text-xs">
                      {overrode ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          override recorded
                        </span>
                      ) : (
                        <span className="text-muted-foreground">honored</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
