"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, UserRoundCog } from "lucide-react";
import type { FollowUp } from "@nzila/deal-engine/types";

interface FollowUpListProps {
  followUps: FollowUp[];
}

const priorityColors: Record<string, string> = {
  critical: "border-l-red-600",
  high: "border-l-amber-500",
  medium: "border-l-blue-500",
  low: "border-l-gray-400",
};

const priorityBadgeColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const SNOOZE_DAYS = [1, 3, 7] as const;

export function FollowUpList({ followUps }: FollowUpListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
  const [reassignOpenId, setReassignOpenId] = useState<string | null>(null);
  const [reassignOwner, setReassignOwner] = useState("");

  async function mutate(body: Record<string, unknown>) {
    setActiveId(body.followUpId as string);
    setError(null);
    try {
      const res = await fetch("/api/control-plane/deal-engine/follow-ups/mutations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, actor: "control-plane-user" }),
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
      setActiveId(null);
      setSnoozeOpenId(null);
      setReassignOpenId(null);
      setReassignOwner("");
    }
  }

  const sorted = [...followUps].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    const pa = order[a.priority] ?? 4;
    const pb = order[b.priority] ?? 4;
    if (pa !== pb) return pa - pb;
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return 0;
  });

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 text-xs text-red-700 dark:text-red-400 flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}
      {sorted.map((fu) => {
        const busy = activeId === fu.id || isPending;
        return (
          <div
            key={fu.id}
            className={`rounded-lg border border-border border-l-4 bg-card p-4 ${priorityColors[fu.priority] ?? "border-l-gray-400"} ${busy ? "opacity-60 pointer-events-none" : ""}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-foreground truncate">{fu.title}</h3>
                  {fu.isOverdue && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{fu.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{fu.accountName}</span>
                  <span>Owner: {fu.owner}</span>
                  <span>Due: {fu.dueDate ? new Date(fu.dueDate).toLocaleDateString() : "—"}</span>
                  <span>Trigger: {fu.trigger}</span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => mutate({ action: "complete", followUpId: fu.id })}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  >
                    <Check className="h-3 w-3" /> Complete
                  </button>

                  {/* Snooze */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSnoozeOpenId(snoozeOpenId === fu.id ? null : fu.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    >
                      <Clock className="h-3 w-3" /> Snooze
                    </button>
                    {snoozeOpenId === fu.id && (
                      <div className="absolute left-0 top-full z-10 mt-1 rounded-md border border-border bg-popover p-1 shadow-md">
                        {SNOOZE_DAYS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              const newDueDate = new Date(Date.now() + d * 86_400_000).toISOString();
                              mutate({ action: "snooze", followUpId: fu.id, newDueDate });
                            }}
                            className="block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-accent whitespace-nowrap"
                          >
                            {d} day{d > 1 ? "s" : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reassign */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setReassignOpenId(reassignOpenId === fu.id ? null : fu.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <UserRoundCog className="h-3 w-3" /> Reassign
                    </button>
                    {reassignOpenId === fu.id && (
                      <div className="absolute left-0 top-full z-10 mt-1 rounded-md border border-border bg-popover p-2 shadow-md flex gap-1">
                        <input
                          type="text"
                          value={reassignOwner}
                          onChange={(e) => setReassignOwner(e.target.value)}
                          placeholder="New owner"
                          className="rounded border border-border bg-background px-2 py-1 text-xs w-28"
                        />
                        <button
                          type="button"
                          disabled={!reassignOwner.trim()}
                          onClick={() => mutate({ action: "reassign", followUpId: fu.id, newOwner: reassignOwner.trim() })}
                          className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                        >
                          Go
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${priorityBadgeColors[fu.priority] ?? priorityBadgeColors.low}`}>
                {fu.priority}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
