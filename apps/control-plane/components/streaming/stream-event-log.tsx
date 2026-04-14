"use client";

import type { RecentStreamEvent } from "@/server/streaming-data";

interface StreamEventLogProps {
  events: RecentStreamEvent[];
}

const eventTypeLabels: Record<string, string> = {
  stream_created: "Stream Created",
  stream_ready: "Stream Ready",
  stream_started: "Stream Started",
  stream_ended: "Stream Ended",
  stream_failed: "Stream Failed",
  credential_issued: "Credential Issued",
  credential_rotated: "Credential Rotated",
  playback_granted: "Playback Granted",
  playback_denied: "Playback Denied",
  transcode_submitted: "Transcode Submitted",
  transcode_completed: "Transcode Completed",
  transcode_failed: "Transcode Failed",
  variant_registered: "Variant Registered",
  provider_error: "Provider Error",
};

const eventTypeColors: Record<string, string> = {
  stream_started: "text-green-600 dark:text-green-400",
  stream_ended: "text-muted-foreground",
  stream_failed: "text-red-600 dark:text-red-400",
  playback_denied: "text-amber-600 dark:text-amber-400",
  transcode_failed: "text-red-600 dark:text-red-400",
  provider_error: "text-red-600 dark:text-red-400",
};

export function StreamEventLog({ events }: StreamEventLogProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No stream events yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Event</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stream</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className={`px-4 py-2 font-medium ${eventTypeColors[e.eventType] ?? "text-foreground"}`}>
                  {eventTypeLabels[e.eventType] ?? e.eventType}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {e.liveStreamId ? `${e.liveStreamId.slice(0, 8)}…` : "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground text-xs">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
