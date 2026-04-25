"use client";

import { cn } from "@/lib/utils";
import { HelpTooltip } from "@/components/ui/help-tooltip";

const STAGES = [
  { value: "pre-revenue", label: "Pre-revenue", sub: "No paying customers yet" },
  { value: "early", label: "Early Revenue", sub: "$1k–$10k MRR" },
  { value: "growing", label: "Growing", sub: "$10k–$100k MRR" },
  { value: "scaling", label: "Scaling", sub: "$100k+ MRR" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2({ value, onChange, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-xl font-semibold">
            What&apos;s your revenue stage?
          </h2>
          <HelpTooltip
            label="Why we ask revenue stage"
            content="Revenue stage sets cash and pipeline expectations in your first weekly operating loop."
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Be honest — we&apos;re here to help, not judge.
        </p>
      </div>

      <div className="space-y-2">
        {STAGES.map((s) => (
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
