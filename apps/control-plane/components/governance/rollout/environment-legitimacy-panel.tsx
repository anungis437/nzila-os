import { StatusBadge } from "@/components/ui/status-badge";
import {
  tierPostureLabel,
  type TierPosture,
} from "@/lib/rollout-governance";

interface Props {
  postures: TierPosture[];
}

/**
 * Environment Legitimacy Panel.
 *
 * Calm institutional surface — one row per tier, no flashing, no urgency.
 * Authority: docs/nzila-rollout-governance/environment-legitimacy-visibility.md
 */
export function EnvironmentLegitimacyPanel({ postures }: Props) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Environment Legitimacy
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Identity, isolation, and continuity posture by tier.
        </p>
      </header>
      <div className="divide-y divide-border">
        {postures.map((p) => {
          const label = tierPostureLabel(p);
          return (
            <div
              key={p.tier}
              className="grid grid-cols-12 gap-4 px-6 py-4 text-sm"
            >
              <div className="col-span-2">
                <p className="font-medium text-foreground">{p.tier}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {p.env.topology}
                </p>
              </div>
              <div className="col-span-3">
                <p className="text-xs text-muted-foreground">Secret topology</p>
                <p className="mt-0.5 font-mono text-xs text-foreground">
                  {p.env.secret_topology}
                </p>
                {p.env.shared_secret_topology_exception && (
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                    TSOSA exception recorded
                  </p>
                )}
              </div>
              <div className="col-span-3">
                <p className="text-xs text-muted-foreground">Last release</p>
                <p className="mt-0.5 font-mono text-xs text-foreground">
                  {p.lastPromotion?.subject?.release_id ?? "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {p.lastPromotion?.timestamp?.slice(0, 19).replace("T", " ") ??
                    "no promotion attestation"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Continuity</p>
                <p className="mt-0.5 text-xs text-foreground">
                  {p.continuityWindow.openMinutesRemaining > 0
                    ? `Open · ${p.continuityWindow.openMinutesRemaining}m left`
                    : `Closed · window ${p.continuityWindow.minutes}m`}
                </p>
              </div>
              <div className="col-span-2 flex items-start justify-end">
                <StatusBadge status={label.state} label={label.text} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
