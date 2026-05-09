import { StatusBadge } from "@/components/ui/status-badge";
import type { AttestationRecord, TierPosture } from "@/lib/rollout-governance";

interface Props {
  postures: TierPosture[];
  rollbacks: AttestationRecord[];
}

/**
 * Rollback Governance Panel — legitimacy-preserving, not failure-oriented.
 * Authority: docs/nzila-rollout-governance/governed-rollback-system.md
 */
export function RollbackGovernancePanel({ postures, rollbacks }: Props) {
  const recent = rollbacks.slice(0, 5);
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Rollback Posture
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Rollback is a governed event, not a panic action.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 px-6 py-4 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            By tier
          </p>
          <ul className="mt-2 space-y-2">
            {postures.map((p) => (
              <li key={p.tier} className="flex items-center justify-between">
                <span className="text-foreground">{p.tier}</span>
                {p.lastRollback ? (
                  <StatusBadge
                    status="warning"
                    label={`recent · ${p.lastRollback.timestamp.slice(0, 10)}`}
                  />
                ) : (
                  <StatusBadge status="current" label="no recent rollback" />
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Recent rollback attestations
          </p>
          {recent.length === 0 ? (
            <p className="mt-2 text-muted-foreground">
              None. Operational posture is forward-only.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {recent.map((r) => (
                <li key={r.attestation_id} className="text-xs">
                  <span className="font-medium text-foreground">
                    {r.subject?.tier}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {r.timestamp.slice(0, 19).replace("T", " ")} · {r.actor}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
