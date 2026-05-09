import type { TierPosture } from "@/lib/rollout-governance";

interface Props {
  postures: TierPosture[];
}

/**
 * Continuity Window Panel — communicates stabilization pacing, not blocking.
 * Authority: docs/nzila-rollout-governance/continuity-safe-rollout-system.md
 */
export function ContinuityWindowPanel({ postures }: Props) {
  const open = postures.filter((p) => p.continuityWindow.openMinutesRemaining > 0);
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Continuity Windows
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Stabilization pacing, not deployment blocking.
        </p>
      </header>
      <div className="px-6 py-4 text-sm">
        {open.length === 0 ? (
          <p className="text-muted-foreground">
            All tiers are outside their stabilization windows.
          </p>
        ) : (
          <ul className="space-y-3">
            {open.map((p) => (
              <li key={p.tier} className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {p.tier} · stabilizing
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Last promotion {p.lastPromotion?.timestamp?.slice(0, 19).replace("T", " ")}.
                    Window {p.continuityWindow.minutes}m.
                  </p>
                </div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {p.continuityWindow.openMinutesRemaining}m left
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
