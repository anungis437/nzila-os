"use client";

import Link from "next/link";
import type { OnboardingData } from "./page";

const TOOLS = [
  { key: "stripe", label: "Stripe", description: "Payments & revenue" },
  { key: "quickbooks", label: "QuickBooks", description: "Accounting" },
  { key: "hubspot", label: "HubSpot", description: "CRM & pipeline" },
];

interface Props {
  data: OnboardingData;
  onBack: () => void;
}

export function Step5({ onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Connect your tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Or start manually — you can always connect later.
        </p>
      </div>

      <div className="space-y-2">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            disabled
            className="flex w-full items-center justify-between rounded-xl border border-border p-4 text-left opacity-60 cursor-not-allowed"
          >
            <div>
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Coming soon
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard"
          className="w-full rounded-lg bg-electric py-2.5 text-center text-sm font-semibold text-white hover:bg-electric/90"
        >
          Get Started
        </Link>
        <button
          onClick={onBack}
          className="rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted"
        >
          Back
        </button>
        <Link
          href="/dashboard"
          className="text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Skip for now, start manually
        </Link>
      </div>
    </div>
  );
}
