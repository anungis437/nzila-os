"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PayrollRunWizard() {
  const [runType, setRunType] = useState<"preview" | "official">("preview");
  const [status, setStatus] = useState<string | null>(null);

  async function createRun() {
    setStatus("Calculating payroll run...");
    const response = await fetch("/api/employer-execution/payroll-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timesheetBatchId: "11111111-1111-4111-8111-111111111112",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-15",
        runType,
      }),
    });

    setStatus(response.ok ? "Payroll run created" : "Payroll run failed");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Run Wizard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={runType === "preview" ? "default" : "outline"}
            onClick={() => setRunType("preview")}
          >
            Preview Run
          </Button>
          <Button
            type="button"
            variant={runType === "official" ? "default" : "outline"}
            onClick={() => setRunType("official")}
          >
            Official Run
          </Button>
        </div>
        <Button type="button" onClick={createRun}>Create Run</Button>
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </CardContent>
    </Card>
  );
}
