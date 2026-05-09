import { StatusBadge } from "@/components/ui/status-badge";
import {
  tierPostureLabel,
  type TierPosture,
} from "@/lib/rollout-governance";

interface Props {
  postures: TierPosture[];
}

/**
 * Rollout Readiness Panel — sparse executive-readable summary.
 * Authority: docs/nzila-rollout-governance/rollout-legitimacy-review-system.md
 */
export function RolloutReadinessPanel({ postures }: Props) {
  const nominal = postures.filter(
    (p) => tierPostureLabel(p).state === "current",
  ).length;
  const stabilizing = postures.filter(
    (p) => tierPostureLabel(p).state === "warning",
  ).length;
  const missing = postures.filter(
    (p) => tierPostureLabel(p).state === "missing",
  ).length;

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Rollout Readiness
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Aggregate posture across governed environments.
        </p>
      </header>
      <div className="grid grid-cols-3 gap-4 px-6 py-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Attested</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {nominal}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Stabilizing</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {stabilizing}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">No attestation</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {missing}
          </p>
        </div>
      </div>
      <div className="border-t border-border px-6 py-3">
        <ul className="space-y-1.5 text-xs">
          {postures.map((p) => {
            const label = tierPostureLabel(p);
            return (
              <li
                key={p.tier}
                className="flex items-center justify-between"
              >
                <span className="text-foreground">{p.tier}</span>
                <StatusBadge status={label.state} label={label.text} />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
