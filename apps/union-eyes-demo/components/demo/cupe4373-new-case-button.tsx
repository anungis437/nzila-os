"use client";

/**
 * "File a new case" Sheet for the CUPE 4373 demo.
 *
 * Captures a minimal intake (title, type, stream, worker, urgency,
 * desired outcome) and persists it in `sessionStorage` only. New cases
 * appear in the live list with a "New (this session)" badge but do not
 * write to any database — this mirrors the platform's real intake flow
 * (POST /api/cases/intake) without coupling the demo to backend state.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@nzila/union-eyes-ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nzila/union-eyes-ui/sheet";
import { Label } from "@nzila/union-eyes-ui/label";
import { Textarea } from "@nzila/union-eyes-ui/textarea";
import type { DemoCase } from "@/lib/demo/cupe4373-demo";

export type NewDemoCase = Pick<
  DemoCase,
  "id" | "title" | "type" | "caseworkStream" | "worker" | "unit" | "urgency" | "summary" | "desiredOutcome" | "status" | "opened"
>;

const STORAGE_KEY = "ue-demo-new-cases";

export function loadSessionCases(): NewDemoCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as NewDemoCase[];
  } catch {
    return [];
  }
}

function saveSessionCases(cases: NewDemoCase[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch {
    // ignore
  }
}

function nextDemoId(existing: NewDemoCase[]): string {
  // UE-4373-9xx range reserved for session-created cases so they don't
  // collide with the fixture range (UE-4373-001..099).
  const used = new Set(existing.map((c) => c.id));
  for (let i = 901; i < 999; i++) {
    const candidate = `UE-4373-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `UE-4373-${Date.now()}`;
}

export function Cupe4373NewCaseButton({
  onCreated,
}: {
  onCreated?: (created: NewDemoCase) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [stream, setStream] = useState<DemoCase["caseworkStream"]>("grievance");
  const [worker, setWorker] = useState("");
  const [unit, setUnit] = useState("");
  const [urgency, setUrgency] = useState<DemoCase["urgency"]>("watch");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setType("");
    setStream("grievance");
    setWorker("");
    setUnit("");
    setUrgency("watch");
    setSummary("");
    setOutcome("");
  };

  const submit = () => {
    if (!title.trim() || !worker.trim() || !summary.trim()) return;
    const existing = loadSessionCases();
    const id = nextDemoId(existing);
    const created: NewDemoCase = {
      id,
      title: title.trim(),
      type: type.trim() || "Member intake",
      caseworkStream: stream,
      worker: worker.trim(),
      unit: unit.trim() || "Unspecified unit",
      urgency,
      summary: summary.trim(),
      desiredOutcome: outcome.trim() || "To be confirmed with the member.",
      status: "Intake review",
      opened: new Date().toISOString(),
    };
    saveSessionCases([created, ...existing]);
    onCreated?.(created);
    setConfirmation(id);
    reset();
  };

  return (
    <>
      <Button onClick={() => { setConfirmation(null); setOpen(true); }}>
        <Plus className="mr-2 h-4 w-4" />
        File new case
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>File a new case</SheetTitle>
            <SheetDescription>
              Capture an intake. Demo-only: the case is held in this browser session and
              does not write to any database. In production this flows through the case
              intake API with steward assignment and CBA reference checks.
            </SheetDescription>
          </SheetHeader>

          {confirmation && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Case <span className="font-mono font-semibold">{confirmation}</span> filed.
              It now appears at the top of the cases list with a “New (this session)” badge.
            </div>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="nc-title">Case title</Label>
              <input
                id="nc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Shift change without 96-hour notice"
                className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nc-type">Type</Label>
                <input
                  id="nc-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="Scheduling dispute"
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <Label htmlFor="nc-stream">Stream</Label>
                <select
                  id="nc-stream"
                  value={stream}
                  onChange={(e) => setStream(e.target.value as DemoCase["caseworkStream"])}
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="grievance">Grievance</option>
                  <option value="accommodation">Accommodation</option>
                  <option value="health-safety">Health &amp; safety</option>
                  <option value="coordination">Coordination</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nc-worker">Worker</Label>
                <input
                  id="nc-worker"
                  value={worker}
                  onChange={(e) => setWorker(e.target.value)}
                  placeholder="Last, First initial"
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <Label htmlFor="nc-unit">Unit</Label>
                <input
                  id="nc-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. RPNs, acute care services"
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="nc-urgency">Urgency</Label>
              <select
                id="nc-urgency"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as DemoCase["urgency"])}
                className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="urgent">Urgent — act within 24h</option>
                <option value="watch">Watch — within the week</option>
                <option value="steady">Steady — routine intake</option>
              </select>
            </div>
            <div>
              <Label htmlFor="nc-summary">What happened</Label>
              <Textarea
                id="nc-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Member’s account in 1–3 sentences."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="nc-outcome">Desired outcome</Label>
              <Textarea
                id="nc-outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What the member wants the union to achieve."
                rows={2}
              />
            </div>
          </div>

          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              onClick={submit}
              disabled={!title.trim() || !worker.trim() || !summary.trim()}
            >
              File case
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
