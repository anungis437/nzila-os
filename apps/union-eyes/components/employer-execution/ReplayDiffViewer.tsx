import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReplayDiff = {
  changed: boolean;
  summary: string;
  fieldsChanged: Array<{ field: string; before: unknown; after: unknown }>;
};

export function ReplayDiffViewer({ diff }: { diff: ReplayDiff | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Replay Diff Viewer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!diff ? <p className="text-sm text-muted-foreground">Run a replay to see differences.</p> : null}
        {diff ? <p className="text-sm">{diff.summary}</p> : null}
        {diff?.fieldsChanged?.map((entry) => (
          <div key={entry.field} className="rounded-md border p-3 text-sm">
            <p className="font-medium">{entry.field}</p>
            <p className="text-muted-foreground">Before: {String(entry.before)}</p>
            <p className="text-muted-foreground">After: {String(entry.after)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
