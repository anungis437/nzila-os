"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DealStageBadge } from "./deal-stage-badge";
import type { Pilot } from "@nzila/deal-engine/types";

interface PilotCardProps {
  pilot: Pilot;
}

const statusColors: Record<string, string> = {
  proposed: "text-blue-600",
  setup: "text-purple-600",
  active: "text-emerald-600",
  data_collection: "text-teal-600",
  ingestion: "text-amber-600",
  review: "text-indigo-600",
  converted: "text-green-600",
  cancelled: "text-red-600",
};

const PILOT_STATUSES = ["proposed", "setup", "active", "data_collection", "ingestion", "review", "converted", "cancelled"] as const;

export function PilotCard({ pilot }: PilotCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const checks = pilot.checklist;
  const checkItems = [
    { key: "dataReceived", label: "Data Received", done: checks.dataReceived },
    { key: "ingestionComplete", label: "Ingestion Complete", done: checks.ingestionComplete },
    { key: "demoDatasetReady", label: "Demo Dataset Ready", done: checks.demoDatasetReady },
    { key: "userOnboardingComplete", label: "User Onboarding", done: checks.userOnboardingComplete },
    { key: "reviewMeetingScheduled", label: "Review Scheduled", done: checks.reviewMeetingScheduled },
    { key: "conversionTriggered", label: "Conversion Triggered", done: checks.conversionTriggered },
  ];
  const completedChecks = checkItems.filter((c) => c.done).length;

  async function toggleChecklist(key: string, currentValue: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/control-plane/deal-engine/pilots/mutations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_checklist",
          pilotId: pilot.id,
          actor: "control-plane-user",
          checklistKey: key,
          checklistValue: !currentValue,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed (${res.status})`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: string) {
    setBusy(true);
    setShowStatusMenu(false);
    setError(null);
    try {
      const res = await fetch("/api/control-plane/deal-engine/pilots/mutations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          pilotId: pilot.id,
          actor: "control-plane-user",
          status,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed (${res.status})`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-lg border border-border bg-card p-6 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      {error && (
        <div className="mb-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 text-xs text-red-700 dark:text-red-400 flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{pilot.accountName}</h3>
          <p className="text-sm text-muted-foreground capitalize">{pilot.product}</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={`text-sm font-medium capitalize cursor-pointer hover:underline ${statusColors[pilot.pilotStatus] ?? "text-muted-foreground"}`}
          >
            {pilot.pilotStatus.replace("_", " ")}
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-border bg-popover p-1 shadow-md">
              {PILOT_STATUSES.filter((s) => s !== pilot.pilotStatus).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeStatus(s)}
                  className="block w-full rounded px-3 py-1.5 text-left text-xs capitalize hover:bg-accent"
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <span className="text-muted-foreground">Owner:</span>{" "}
          <span className="text-foreground">{pilot.owner}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Days active:</span>{" "}
          <span className="text-foreground">{pilot.daysActive}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Ingestion:</span>{" "}
          <span className="text-foreground capitalize">{pilot.ingestionStatus ?? "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Review by:</span>{" "}
          <span className="text-foreground">{pilot.targetReviewDate ? new Date(pilot.targetReviewDate).toLocaleDateString() : "—"}</span>
        </div>
      </div>

      {/* Checklist progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Checklist</span>
          <span>{completedChecks}/{checkItems.length}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(completedChecks / checkItems.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checkItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => toggleChecklist(item.key, item.done)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center text-[10px] ${item.done ? "bg-emerald-100 border-emerald-500 text-emerald-700" : "border-border hover:border-foreground"}`}>
              {item.done ? "✓" : ""}
            </span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Blockers */}
      {pilot.currentBlockers.length > 0 && (
        <div className="mt-4 p-3 rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-1">Blockers</p>
          <ul className="space-y-1">
            {pilot.currentBlockers.map((b, i) => (
              <li key={i} className="text-xs text-amber-700 dark:text-amber-300">• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Success criteria */}
      {pilot.successCriteria.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Success Criteria</p>
          <ul className="space-y-1">
            {pilot.successCriteria.map((c, i) => (
              <li key={i} className="text-xs text-muted-foreground">• {c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
