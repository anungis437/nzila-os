import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReplayDiffEntry = {
  scope: "run" | "employee_item" | "remittance_item";
  subjectId: string;
  field: string;
  originalValue: unknown;
  replayValue: unknown;
  causeType: "input_change" | "rule_change" | "engine_change" | "derived_change";
  causeDetail: string;
  originalRulePath?: string[];
  replayRulePath?: string[];
};

type ReplayDiff = {
  changed: boolean;
  summary: string;
  differences: ReplayDiffEntry[];
};

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ReplayDiffViewer({ diff }: { diff: ReplayDiff | null }) {
  const changedOnly = diff?.differences ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Replay Diff Viewer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!diff ? <p className="text-sm text-muted-foreground">Run a replay to see differences.</p> : null}
        {diff ? <p className="text-sm">{diff.summary}</p> : null}
        {diff && changedOnly.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changed items.</p>
        ) : null}
        {changedOnly.map((entry, index) => (
          <div key={`${entry.scope}:${entry.subjectId}:${entry.field}:${index}`} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{entry.subjectId}.{entry.field}</p>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase">{entry.scope}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase">{entry.causeType.replace("_", " ")}</span>
            </div>
            <p className="text-muted-foreground">Cause: {entry.causeDetail}</p>
            <p className="text-muted-foreground">Original: {formatValue(entry.originalValue)}</p>
            <p className="text-muted-foreground">Replay: {formatValue(entry.replayValue)}</p>
            {(entry.originalRulePath?.length || entry.replayRulePath?.length) && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p>Original rule path: {(entry.originalRulePath ?? []).join(" > ") || "n/a"}</p>
                <p>Replay rule path: {(entry.replayRulePath ?? []).join(" > ") || "n/a"}</p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
