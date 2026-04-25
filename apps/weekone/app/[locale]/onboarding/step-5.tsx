"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { OnboardingData } from "./page";
import { trackClientEvent, WEEKONE_ANALYTICS_EVENTS } from "@/lib/analytics/track";
import { HelpTooltip } from "@/components/ui/help-tooltip";

const TOOLS = [
  { key: "stripe", label: "Stripe", description: "Payments & revenue" },
  { key: "quickbooks", label: "QuickBooks", description: "Accounting" },
  { key: "hubspot", label: "HubSpot", description: "CRM & pipeline" },
];

interface Props {
  data: OnboardingData;
  onBack: () => void;
}

export function Step5({ data, onBack }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [submitting, setSubmitting] = useState<"complete" | "skip" | null>(null);

  const dashboardHref = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const locale = segments[0] ?? "en";
    return `/${locale}/dashboard`;
  }, [pathname]);

  async function emitActivation(action: "complete" | "skip") {
    await fetch("/api/onboarding/activation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        step: "tool_connect",
        data,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  async function handleContinue(action: "complete" | "skip") {
    setSubmitting(action);
    try {
      await emitActivation(action);
      if (action === "complete") {
        await trackClientEvent({
          eventName: WEEKONE_ANALYTICS_EVENTS.SIGNUP_COMPLETE,
          context: { source: "onboarding_step_5" },
        });
      }
    } catch {
      // Activation logging should never block user progression.
    } finally {
      router.push(dashboardHref);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-xl font-semibold">Connect your tools</h2>
          <HelpTooltip
            label="Why connect tools"
            content="Connections reduce manual updates so your weekly baseline stays current with less admin."
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Or start manually. You can run your first baseline week now and connect later.
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
        <button
          onClick={() => handleContinue("complete")}
          disabled={submitting !== null}
          className="w-full rounded-lg bg-electric py-2.5 text-center text-sm font-semibold text-white hover:bg-electric/90 disabled:opacity-60"
        >
          {submitting === "complete" ? "Finishing setup..." : "Get Started"}
        </button>
        <button
          onClick={onBack}
          disabled={submitting !== null}
          className="rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted"
        >
          Back
        </button>
        <button
          onClick={() => handleContinue("skip")}
          disabled={submitting !== null}
          className="text-center text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-60"
        >
          {submitting === "skip" ? "Skipping..." : "Skip for now, start manually"}
        </button>
      </div>
    </div>
  );
}
