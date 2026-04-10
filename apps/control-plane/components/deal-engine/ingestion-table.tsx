"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import type { IngestionRun } from "@nzila/deal-engine/types";

interface IngestionTableProps {
  runs: IngestionRun[];
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  retrying: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export function IngestionTable({ runs }: IngestionTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retryRun(runId: string) {
    setRetryingId(runId);
    setError(null);
    try {
      const res = await fetch("/api/control-plane/deal-engine/ingestion/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, actor: "control-plane-user" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Retry failed (${res.status})`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRetryingId(null);
    }
  }

  const canRetry = (status: string) => status === "failed" || status === "partial";

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {error && (
        <div className="m-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 text-xs text-red-700 dark:text-red-400 flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source System</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Processed</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Failed</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Warnings</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trust</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Started</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-accent/50 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">{run.accountName}</td>
              <td className="px-4 py-3 text-muted-foreground">{run.sourceSystem}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[run.status] ?? statusColors.pending}`}>
                  {run.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-foreground">{run.processedCount.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className={run.failedCount > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                  {run.failedCount}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className={run.warningCount > 20 ? "text-amber-600" : "text-muted-foreground"}>
                  {run.warningCount}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={
                  run.trustSignal === "verified" ? "text-emerald-600 font-medium" :
                  run.trustSignal === "partial" ? "text-amber-600" :
                  "text-muted-foreground"
                }>
                  {run.trustSignal ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {run.startedAt ? new Date(run.startedAt).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-3 text-center">
                {canRetry(run.status) ? (
                  <button
                    type="button"
                    onClick={() => retryRun(run.id)}
                    disabled={retryingId === run.id || isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    <RotateCw className={`h-3 w-3 ${retryingId === run.id ? "animate-spin" : ""}`} />
                    Retry
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
