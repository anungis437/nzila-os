"use client";

import { cn } from "@/lib/utils";

const PAINS = [
  { value: "cash-flow", label: "Cash flow anxiety", sub: "I don't know if I'll make it 6 months" },
  { value: "pipeline", label: "Inconsistent pipeline", sub: "Revenue is unpredictable" },
  { value: "priorities", label: "Too many priorities", sub: "I don't know what to focus on" },
  { value: "delegation", label: "Doing everything myself", sub: "Can't scale or let go" },
  { value: "metrics", label: "No clear metrics", sub: "Flying blind on KPIs" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step4({ value, onChange, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">
          What&apos;s your biggest pain right now?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll focus your first week on this.
        </p>
      </div>

      <div className="space-y-2">
        {PAINS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all",
              value === p.value
                ? "border-electric bg-electric/10"
                : "border-border hover:border-electric/40 hover:bg-muted/50"
            )}
          >
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  value === p.value ? "text-electric" : ""
                )}
              >
                {p.label}
              </p>
              <p className="text-xs text-muted-foreground">{p.sub}</p>
            </div>
            {value === p.value && (
              <span className="text-electric">✓</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!value}
          className="flex-1 rounded-lg bg-electric py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-electric/90"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
