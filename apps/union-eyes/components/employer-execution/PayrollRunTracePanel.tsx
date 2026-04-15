import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PayrollRunTracePanel({ trace }: { trace: Record<string, unknown> | null }) {
  const calcTrace = (trace ?? {}) as {
    calc_trace?: {
      evaluation_graph?: {
        nodes?: Array<{
          nodeId: string;
          ruleKind: string;
          compositionMode: string;
          decision: string;
          decisionReason: string;
        }>;
      };
    };
  };

  const nodes = calcTrace.calc_trace?.evaluation_graph?.nodes ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Trace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nodes.length > 0 ? (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Evaluation Node Decisions</p>
            <div className="mt-2 space-y-1">
              {nodes.slice(0, 12).map((node) => (
                <p key={node.nodeId} className="text-muted-foreground">
                  {node.ruleKind} | mode={node.compositionMode} | decision={node.decision} | {node.decisionReason}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        <pre className="max-h-96 overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
          {JSON.stringify(trace ?? { message: "No trace available" }, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
