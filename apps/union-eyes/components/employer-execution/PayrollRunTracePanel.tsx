import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PayrollRunTracePanel({ trace }: { trace: Record<string, unknown> | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Trace</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="max-h-96 overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
          {JSON.stringify(trace ?? { message: "No trace available" }, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
