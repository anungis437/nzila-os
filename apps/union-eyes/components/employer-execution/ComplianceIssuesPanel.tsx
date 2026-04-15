import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ComplianceEvent = {
  id: string;
  eventCode: string;
  severity: "info" | "warning" | "error" | "critical";
  blocking: string;
  status?: string;
  summary: string;
  detectedAt: string;
  payrollRunId?: string | null;
  remittanceRunId?: string | null;
};

const severityOrder: Array<ComplianceEvent["severity"]> = ["critical", "error", "warning", "info"];

export function ComplianceIssuesPanel({ events }: { events: ComplianceEvent[] }) {
  const grouped = severityOrder
    .map((severity) => ({ severity, rows: events.filter((event) => event.severity === severity) }))
    .filter((group) => group.rows.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Issues</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? <p className="text-sm text-muted-foreground">No compliance issues</p> : null}
        {grouped.map((group) => (
          <div key={group.severity} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.severity}</h3>
            {group.rows.map((event) => {
              const isBlocking = event.severity === "critical" || event.blocking === "yes";
              return (
                <div key={event.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">{event.eventCode}</strong>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {isBlocking ? "blocking" : "non-blocking"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{event.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status: {event.status ?? "open"} | Detected: {event.detectedAt}
                  </p>
                  {(event.payrollRunId || event.remittanceRunId) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Affected: {event.payrollRunId ? `payroll ${event.payrollRunId}` : ""}
                      {event.payrollRunId && event.remittanceRunId ? " | " : ""}
                      {event.remittanceRunId ? `remittance ${event.remittanceRunId}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
