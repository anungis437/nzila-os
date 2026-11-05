"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiShapeError, envelopeRow, envelopeRows, readApiError } from "@/lib/client/api-envelope";
import { asRecord, requiredString } from "@/lib/client/row-fields";

const LOAD_FAILED = "The timesheet batches could not be loaded.";
const CREATE_FAILED = "The payroll run could not be created.";

interface ValidatedBatch {
  id: string;
  batchCode: string;
  periodStart: string;
  periodEnd: string;
}

/** A failure the server explained: its words are shown as they came. */
class ServerMessage extends Error {}

function readBatch(value: unknown): ValidatedBatch | null {
  const row = asRecord(value, "timesheet batch");
  // Only a validated batch can prepare a payroll run: the route refuses any other.
  if (requiredString(row, "status") !== "validated") return null;
  return {
    id: requiredString(row, "id"),
    batchCode: requiredString(row, "batchCode"),
    periodStart: requiredString(row, "periodStart"),
    periodEnd: requiredString(row, "periodEnd"),
  };
}

async function fetchBatches(): Promise<ValidatedBatch[]> {
  const response = await fetch("/api/employer-execution/timesheets");
  if (!response.ok) throw new ServerMessage(await readApiError(response, LOAD_FAILED));
  return envelopeRows(await response.json())
    .map(readBatch)
    .filter((batch): batch is ValidatedBatch => batch !== null);
}

export function PayrollRunWizard() {
  const router = useRouter();
  const [runType, setRunType] = useState<"preview" | "official">("preview");
  const [batches, setBatches] = useState<ValidatedBatch[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState<{ kind: "working" | "done" | "failed"; text: string } | null>(null);

  const loadBatches = useCallback(async () => {
    setLoadError(null);
    try {
      setBatches(await fetchBatches());
    } catch (error) {
      setLoadError(error instanceof ServerMessage ? error.message : LOAD_FAILED);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  const batch = batches?.find((candidate) => candidate.id === batchId) ?? null;

  async function createRun() {
    if (batch === null) return;
    setStatus({ kind: "working", text: "Calculating payroll run..." });
    try {
      const response = await fetch("/api/employer-execution/payroll-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The run covers the period of the batch it is prepared from.
        body: JSON.stringify({ timesheetBatchId: batch.id, periodStart: batch.periodStart, periodEnd: batch.periodEnd, runType }),
      });
      if (!response.ok) {
        setStatus({ kind: "failed", text: await readApiError(response, CREATE_FAILED) });
        return;
      }
      const created = envelopeRow(await response.json());
      const run = asRecord(created.run, "payroll run");
      setStatus({ kind: "done", text: `Payroll run ${requiredString(run, "runCode")} created (${runType}, ${requiredString(run, "status")})` });
      router.refresh();
    } catch (error) {
      setStatus({ kind: "failed", text: error instanceof ApiShapeError ? "The payroll run was answered in a form this page cannot read; check the run list." : CREATE_FAILED });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Run Wizard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError !== null && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span>{loadError}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadBatches()}>
              Retry
            </Button>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="payroll-batch" className="text-sm font-medium">
            Timesheet batch
          </label>
          <select
            id="payroll-batch"
            className="w-full rounded-md border p-2 text-sm"
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
            disabled={batches === null || batches.length === 0}
          >
            <option value="">{batches === null ? "Loading..." : batches.length === 0 ? "No validated batch" : "Select a validated batch"}</option>
            {(batches ?? []).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.batchCode} ({candidate.periodStart} to {candidate.periodEnd})
              </option>
            ))}
          </select>
          {batches !== null && batches.length === 0 && (
            <p className="text-sm text-muted-foreground">A payroll run is prepared from a validated timesheet batch; upload one first.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={runType === "preview" ? "default" : "outline"} aria-pressed={runType === "preview"} onClick={() => setRunType("preview")}>
            Preview Run
          </Button>
          <Button type="button" variant={runType === "official" ? "default" : "outline"} aria-pressed={runType === "official"} onClick={() => setRunType("official")}>
            Official Run
          </Button>
        </div>
        <Button type="button" onClick={() => void createRun()} disabled={batch === null || status?.kind === "working"}>
          Create Run
        </Button>
        {status !== null && (
          <p role={status.kind === "failed" ? "alert" : "status"} className={status.kind === "failed" ? "text-sm text-red-700" : "text-sm text-muted-foreground"}>
            {status.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
