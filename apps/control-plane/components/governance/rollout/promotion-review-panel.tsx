import type {
  EnvironmentRegistry,
  TierPosture,
  Tier,
} from "@/lib/rollout-governance";

interface Props {
  registry: EnvironmentRegistry;
  postures: TierPosture[];
}

interface Eligibility {
  from: Tier;
  to: Tier;
  eligible: boolean;
  reason: string;
}

/**
 * Promotion Review Panel — governance-safe, not deployment-reactive.
 * Surfaces which promotions are currently eligible per the governance
 * graph and continuity windows. Operators initiate the actual
 * promotion via `pnpm rollout:promote:attest` (or the governed UI flow
 * that wraps it).
 *
 * Authority: docs/nzila-rollout-governance/environment-promotion-governance.md
 */
export function PromotionReviewPanel({ registry, postures }: Props) {
  const postureMap = new Map(postures.map((p) => [p.tier, p]));
  const eligibility: Eligibility[] = [];
  for (const [tier, env] of Object.entries(registry.environments)) {
    for (const target of env.promotion.promotes_to) {
      const targetPosture = postureMap.get(target);
      const open = (targetPosture?.continuityWindow.openMinutesRemaining ?? 0) > 0;
      eligibility.push({
        from: tier as Tier,
        to: target,
        eligible: !open,
        reason: open
          ? `Target tier in stabilization window (${targetPosture?.continuityWindow.openMinutesRemaining}m left).`
          : "Eligible — pending review and attestation.",
      });
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Promotion Review
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Governance-safe promotion eligibility. Promotions are recorded via
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
            pnpm rollout:promote:attest
          </code>
          and reviewed before execution.
        </p>
      </header>
      <ul className="divide-y divide-border">
        {eligibility.map((e) => (
          <li
            key={`${e.from}-${e.to}`}
            className="flex items-center justify-between px-6 py-3 text-sm"
          >
            <div>
              <p className="font-mono text-xs text-foreground">
                {e.from} → {e.to}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{e.reason}</p>
            </div>
            <span
              className={
                e.eligible
                  ? "text-xs font-medium text-emerald-700 dark:text-emerald-400"
                  : "text-xs font-medium text-amber-700 dark:text-amber-400"
              }
            >
              {e.eligible ? "eligible" : "hold"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
