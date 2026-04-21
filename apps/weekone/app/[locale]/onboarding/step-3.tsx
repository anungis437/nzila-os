"use client";

import { cn } from "@/lib/utils";

const SIZES = [
  { value: "1", label: "Solo founder", sub: "Just me" },
  { value: "2-5", label: "2–5 people", sub: "Co-founder + small team" },
  { value: "6-10", label: "6–10 people", sub: "Small team" },
  { value: "11-25", label: "11–25 people", sub: "Growing team" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3({ value, onChange, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">How big is your team?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Including co-founders and contractors.
        </p>
      </div>

      <div className="space-y-2">
        {SIZES.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all",
              value === s.value
                ? "border-electric bg-electric/10"
                : "border-border hover:border-electric/40 hover:bg-muted/50"
            )}
          >
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  value === s.value ? "text-electric" : ""
                )}
              >
                {s.label}
              </p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
            {value === s.value && (
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
