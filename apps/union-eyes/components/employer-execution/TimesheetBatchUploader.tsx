"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TimesheetBatchUploader() {
  const [csvContent, setCsvContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function upload() {
    setStatus("Uploading...");
    const response = await fetch("/api/employer-execution/timesheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employerId: "11111111-1111-4111-8111-111111111111",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-15",
        sourceFileName: "timesheet.csv",
        csvContent,
      }),
    });

    if (!response.ok) {
      setStatus("Upload failed");
      return;
    }

    setStatus("Upload completed");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timesheet Batch Uploader</CardTitle>
        <CardDescription>CSV-first ingestion with deterministic normalization and validation summary.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          className="min-h-40 w-full rounded-md border p-3 text-sm"
          placeholder="employee_external_id,shift_date,regular_hours,overtime_hours,doubletime_hours,travel_hours,premium_code"
          value={csvContent}
          onChange={(event) => setCsvContent(event.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button type="button" onClick={upload} disabled={!csvContent.trim()}>
            Upload Batch
          </Button>
          {status ? <span className="text-sm text-muted-foreground">{status}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
