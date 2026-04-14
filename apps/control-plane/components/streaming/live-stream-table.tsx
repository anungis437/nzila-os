"use client";

import type { LiveStreamRow } from "@/server/streaming-data";
import { StatusBadge } from "@/components/ui/status-badge";

interface LiveStreamTableProps {
  streams: LiveStreamRow[];
}

const statusMap: Record<string, "healthy" | "degraded" | "critical" | "unknown"> = {
  live: "healthy",
  ready: "healthy",
  scheduled: "unknown",
  ended: "degraded",
  failed: "critical",
};

export function LiveStreamTable({ streams }: LiveStreamTableProps) {
  if (streams.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No live streams yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stream ID</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Event</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Started</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
          </tr>
        </thead>
        <tbody>
          {streams.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">{s.id.slice(0, 8)}…</td>
              <td className="px-4 py-3 font-mono text-xs">{s.eventId.slice(0, 8)}…</td>
              <td className="px-4 py-3">{s.provider}</td>
              <td className="px-4 py-3">
                <StatusBadge
                  status={statusMap[s.status] ?? "unknown"}
                  label={s.status}
                />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {s.startedAt ? new Date(s.startedAt).toLocaleString() : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(s.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
