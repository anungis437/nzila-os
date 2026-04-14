"use client";

import type { ChangeRecord } from "@nzila/platform-change-management/types";


interface PIRSummaryCardProps {
  record: ChangeRecord;
}

export function PIRSummaryCard({ record }: PIRSummaryCardProps) {
  const pir = record.post_implementation_review;

  if (!pir) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
            PIR Required
          </h4>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-500">
          {record.change_id} — {record.title}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {record.change_type} change must have a Post Implementation Review before closing.
        </p>
      </div>
    );
  }

  const outcomeColors: Record<string, string> = {
    SUCCESS: "text-emerald-600",
    PARTIAL_SUCCESS: "text-amber-600",
    FAILED: "text-red-600",
    ROLLED_BACK: "text-orange-600",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground">Post Implementation Review</h4>
        <span className={`text-xs font-medium ${outcomeColors[pir.outcome] ?? ""}`}>
          {pir.outcome.replace(/_/g, " ")}
        </span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Incidents triggered:{" "}
          <span className={pir.incidents_triggered ? "text-red-600 font-medium" : ""}>
            {pir.incidents_triggered ? "Yes" : "No"}
          </span>
        </p>
        {pir.incident_refs.length > 0 && (
          <p>Incident refs: {pir.incident_refs.join(", ")}</p>
        )}
        <p className="mt-2">{pir.observations}</p>
      </div>
    </div>
  );
}
