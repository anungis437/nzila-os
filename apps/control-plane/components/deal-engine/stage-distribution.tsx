"use client";

import { STAGE_METADATA_LIST } from "./stage-metadata";

interface StageDistributionProps {
  byStage: Record<string, { count: number; value: number }>;
}

const DOT_COLORS: Record<string, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  cyan: "bg-cyan-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  slate: "bg-slate-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  gray: "bg-gray-400",
};

export function StageDistribution({ byStage }: StageDistributionProps) {
  const stages = Object.entries(byStage).sort(
    (a, b) => Object.keys(STAGE_METADATA_LIST).indexOf(a[0]) - Object.keys(STAGE_METADATA_LIST).indexOf(b[0])
  );

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Stage Distribution</h3>
      <div className="space-y-3">
        {stages.map(([stage, { count, value }]) => {
          const meta = STAGE_METADATA_LIST[stage];
          const dotClass = DOT_COLORS[meta?.color ?? "gray"] ?? "bg-gray-400";
          return (
            <div key={stage} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                <span className="text-foreground truncate">{meta?.label ?? stage}</span>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>{count} deal{count !== 1 ? "s" : ""}</span>
                <span className="tabular-nums">${value.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
