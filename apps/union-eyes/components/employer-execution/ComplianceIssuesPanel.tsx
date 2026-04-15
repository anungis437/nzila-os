import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ComplianceEvent = {
  id: string;
  eventCode: string;
  severity: string;
  blocking: string;
  summary: string;
  detectedAt: string;
};

export function ComplianceIssuesPanel({ events }: { events: ComplianceEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Issues</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? <p className="text-sm text-muted-foreground">No compliance issues</p> : null}
        {events.map((event) => (
          <div key={event.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">{event.eventCode}</strong>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {event.severity} {event.blocking === "yes" ? "| blocker" : ""}
              </span>
            </div>
            <p className="mt-1 text-sm">{event.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">Detected: {event.detectedAt}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
