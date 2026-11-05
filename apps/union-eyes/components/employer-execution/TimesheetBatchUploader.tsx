"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiShapeError, envelopeRow, readApiError } from "@/lib/client/api-envelope";
import { fetchAllRows } from "@/lib/client/crud-lists";
import { asRecord, requiredCount, requiredString } from "@/lib/client/row-fields";

const UPLOAD_FAILED = "The timesheet batch could not be uploaded.";

interface EmployerOption {
  id: string;
  name: string;
}

function readEmployer(value: unknown): EmployerOption | null {
  const row = asRecord(value, "employer");
  // An archived employer takes no timesheet input: the route refuses it.
  if (row.status === "archived") return null;
  return { id: requiredString(row, "id"), name: requiredString(row, "name") };
}

export function TimesheetBatchUploader() {
  const router = useRouter();
  const [employers, setEmployers] = useState<EmployerOption[] | null>(null);
  const [employersError, setEmployersError] = useState<string | null>(null);
  const [employerId, setEmployerId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [status, setStatus] = useState<{ kind: "working" | "done" | "failed"; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAllRows<unknown>("/api/employers").then(
      (rows) => {
        if (cancelled) return;
        setEmployersError(null);
        setEmployers(rows.map(readEmployer).filter((employer): employer is EmployerOption => employer !== null));
      },
      (error: unknown) => {
        if (cancelled) return;
        setEmployersError(error instanceof ApiShapeError || error instanceof TypeError ? "The employers could not be loaded." : (error as Error).message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setCsvContent(await file.text());
    setSourceFileName(file.name);
  }

  const periodValid = periodStart !== "" && periodEnd !== "" && periodStart <= periodEnd;
  const ready = employerId !== "" && periodValid && sourceFileName.trim() !== "" && csvContent.trim() !== "";

  async function upload() {
    setStatus({ kind: "working", text: "Uploading..." });
    try {
      const response = await fetch("/api/employer-execution/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employerId, periodStart, periodEnd, sourceFileName: sourceFileName.trim(), csvContent }),
      });
      if (!response.ok) {
        setStatus({ kind: "failed", text: await readApiError(response, UPLOAD_FAILED) });
        return;
      }
      const created = envelopeRow(await response.json());
      const batch = asRecord(created.batch, "timesheet batch");
      const summary = asRecord(created.summary, "validation summary");
      const state = requiredString(batch, "status");
      const counts = `${requiredCount(summary, "valid")} valid and ${requiredCount(summary, "invalid")} invalid of ${requiredCount(summary, "rows")} rows`;
      setStatus({
        kind: state === "validated" ? "done" : "failed",
        text:
          state === "validated"
            ? `Batch ${requiredString(batch, "batchCode")} validated: ${counts}`
            : `Batch ${requiredString(batch, "batchCode")} was recorded as ${state}: ${counts}. A batch with invalid rows cannot prepare a payroll run.`,
      });
      router.refresh();
    } catch (error) {
      setStatus({ kind: "failed", text: error instanceof ApiShapeError ? "The upload was answered in a form this page cannot read; check the batch list." : UPLOAD_FAILED });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timesheet Batch Uploader</CardTitle>
        <CardDescription>CSV-first ingestion with deterministic normalization and validation summary.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {employersError !== null && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span>{employersError}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </Button>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="timesheet-employer" className="text-sm font-medium">
              Employer
            </label>
            <select
              id="timesheet-employer"
              className="w-full rounded-md border p-2 text-sm"
              value={employerId}
              onChange={(event) => setEmployerId(event.target.value)}
              disabled={employers === null || employers.length === 0}
            >
              <option value="">{employers === null ? "Loading..." : employers.length === 0 ? "No employer on file" : "Select an employer"}</option>
              {(employers ?? []).map((employer) => (
                <option key={employer.id} value={employer.id}>
                  {employer.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="timesheet-period-start" className="text-sm font-medium">
              Period start
            </label>
            <input id="timesheet-period-start" type="date" className="w-full rounded-md border p-2 text-sm" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="timesheet-period-end" className="text-sm font-medium">
              Period end
            </label>
            <input id="timesheet-period-end" type="date" className="w-full rounded-md border p-2 text-sm" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </div>
        </div>
        {periodStart !== "" && periodEnd !== "" && !periodValid && <p className="text-sm text-red-700">The period start must not be after the period end.</p>}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="timesheet-file" className="text-sm font-medium">
              CSV file
            </label>
            <input id="timesheet-file" type="file" accept=".csv,text/csv" className="w-full text-sm" onChange={(event) => void loadFile(event.target.files?.[0])} />
          </div>
          <div className="space-y-1">
            <label htmlFor="timesheet-file-name" className="text-sm font-medium">
              Source file name
            </label>
            <input id="timesheet-file-name" type="text" className="w-full rounded-md border p-2 text-sm" value={sourceFileName} onChange={(event) => setSourceFileName(event.target.value)} />
          </div>
        </div>

        <textarea
          aria-label="CSV content"
          className="min-h-40 w-full rounded-md border p-3 text-sm"
          placeholder="employee_external_id,shift_date,regular_hours,overtime_hours,doubletime_hours,travel_hours,premium_code"
          value={csvContent}
          onChange={(event) => setCsvContent(event.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => void upload()} disabled={!ready || status?.kind === "working"}>
            Upload Batch
          </Button>
          {status !== null && (
            <span role={status.kind === "failed" ? "alert" : "status"} className={status.kind === "failed" ? "text-sm text-red-700" : "text-sm text-muted-foreground"}>
              {status.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
