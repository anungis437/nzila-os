"use client";

import type { MediaJobRow } from "@/server/streaming-data";
import { StatusBadge } from "@/components/ui/status-badge";

interface MediaJobsTableProps {
  jobs: MediaJobRow[];
}

const statusMap: Record<string, "healthy" | "degraded" | "critical" | "unknown"> = {
  completed: "healthy",
  processing: "degraded",
  submitted: "degraded",
  pending: "unknown",
  failed: "critical",
  cancelled: "unknown",
};

export function MediaJobsTable({ jobs }: MediaJobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No media jobs yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Job ID</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Asset</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Submitted</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">{j.id.slice(0, 8)}…</td>
              <td className="px-4 py-3 font-mono text-xs">{j.contentAssetId.slice(0, 8)}…</td>
              <td className="px-4 py-3">{j.jobType.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">
                <StatusBadge
                  status={statusMap[j.status] ?? "unknown"}
                  label={j.status}
                />
              </td>
              <td className="px-4 py-3">{j.provider}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {j.submittedAt ? new Date(j.submittedAt).toLocaleString() : "—"}
              </td>
              <td className="px-4 py-3 text-xs text-red-500 max-w-[200px] truncate">
                {j.errorSummary ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
