"use client";

import { cn } from "@/lib/utils";

const TYPES = [
  { value: "saas", label: "SaaS", emoji: "🚀" },
  { value: "agency", label: "Agency", emoji: "🏢" },
  { value: "studio", label: "Studio", emoji: "🎨" },
  { value: "ecommerce", label: "Ecommerce", emoji: "🛒" },
  { value: "services", label: "Services", emoji: "⚙️" },
  { value: "other", label: "Other", emoji: "✨" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function Step1({ value, onChange, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">
          What type of company are you building?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This helps us tailor your dashboard.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all",
              value === t.value
                ? "border-electric bg-electric/10 text-electric"
                : "border-border hover:border-electric/40 hover:bg-muted/50"
            )}
          >
            <span className="text-2xl">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!value}
        className="w-full rounded-lg bg-electric py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:bg-electric/90"
      >
        Continue
      </button>
    </div>
  );
}
