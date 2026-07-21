"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Gavel, NotebookPen, Package } from "lucide-react";
import { Button } from "@nzila/union-eyes-ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nzila/union-eyes-ui/sheet";
import { Textarea } from "@nzila/union-eyes-ui/textarea";
import { Input } from "@nzila/union-eyes-ui/input";
import { Label } from "@nzila/union-eyes-ui/label";
import type { DemoCase } from "@/lib/demo/cupe4373-demo";

type DecisionPriority = "p0" | "p1" | "p2" | "p3";
type DecisionStatus = "proposed" | "approved" | "executing" | "done" | "cancelled";

type Note = { id: string; text: string; createdAt: string };

function buildMeetingPackage(demoCase: DemoCase, notes: Note[]): string {
  const lines = [
    `STEWARD MEETING PACKAGE`,
    `Case: ${demoCase.id} — ${demoCase.title}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `── CASE SUMMARY ──`,
    `Worker: ${demoCase.worker} (${demoCase.unit})`,
    `Location: ${demoCase.location}`,
    `Status: ${demoCase.status}    Urgency: ${demoCase.urgency}`,
    `Opened: ${new Date(demoCase.opened).toLocaleString("en-CA")}`,
    `Deadline: ${new Date(demoCase.deadline).toLocaleString("en-CA")}`,
    ``,
    `── DESIRED OUTCOME ──`,
    demoCase.desiredOutcome,
    ``,
    `── AGREEMENT REFERENCES ──`,
    ...demoCase.agreementRefs.map((r) => `• ${r}`),
    ``,
    `── CHRONOLOGY ──`,
  ];
  for (const entry of demoCase.timeline) {
    lines.push(
      `[${new Date(entry.timestamp).toLocaleString("en-CA")}] ${entry.actor} — ${entry.action}`,
    );
    lines.push(`  ${entry.notes}`);
    lines.push(`  Follow-up: ${entry.followUp}`);
    lines.push(``);
  }
  if (notes.length > 0) {
    lines.push(`── STEWARD NOTES (this session) ──`);
    for (const n of notes) {
      lines.push(`[${new Date(n.createdAt).toLocaleString("en-CA")}]`);
      lines.push(n.text);
      lines.push(``);
    }
  }
  lines.push(`── FLAGS ──`);
  lines.push(...(demoCase.flags.length ? demoCase.flags.map((f) => `• ${f}`) : ["None"]));
  return lines.join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function Cupe4373CaseActions({ demoCase }: { demoCase: DemoCase }) {
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [decisionOwner, setDecisionOwner] = useState("");
  const [decisionDueDate, setDecisionDueDate] = useState("");
  const [decisionPriority, setDecisionPriority] = useState<DecisionPriority>(
    demoCase.urgency === "urgent"
      ? "p0"
      : demoCase.urgency === "watch"
        ? "p1"
        : "p2",
  );
  const [decisionStatus, setDecisionStatus] = useState<DecisionStatus>("approved");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionResult, setDecisionResult] = useState<{
    decisionId: string;
    pipelineRunId: string;
  } | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [proofPackBusy, startProofPack] = useTransition();
  const [proofPackError, setProofPackError] = useState<string | null>(null);

  const downloadProofPack = () => {
    setProofPackError(null);
    startProofPack(async () => {
      try {
        const res = await fetch(
          `/api/cases/${encodeURIComponent(demoCase.id)}/proof-pack`,
          { method: "GET" },
        );
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setProofPackError(`Download failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${demoCase.id}-proof-pack.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        setProofPackError((err as Error).message ?? "Network error");
      }
    });
  };

  const submitNote = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((prev) => [
      ...prev,
      { id: `note-${Date.now()}`, text, createdAt: new Date().toISOString() },
    ]);
    setDraft("");
    setNoteOpen(false);
  };

  const submitDecision = () => {
    setDecisionError(null);
    setDecisionResult(null);
    if (!decisionTitle.trim() || !decisionRationale.trim()) {
      setDecisionError("Title and rationale are required.");
      return;
    }
    startSubmit(async () => {
      try {
        const res = await fetch(
          `/api/cases/${encodeURIComponent(demoCase.id)}/decision`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              caseTitle: demoCase.title,
              title: decisionTitle.trim(),
              rationale: decisionRationale.trim(),
              owner: decisionOwner.trim() || undefined,
              dueDate: decisionDueDate || undefined,
              priority: decisionPriority,
              status: decisionStatus,
              urgency: demoCase.urgency,
            }),
          },
        );
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          decisionId?: string;
          pipelineRunId?: string;
          error?: string;
          message?: string;
        };
        if (!res.ok || !json.ok) {
          setDecisionError(json.message ?? json.error ?? `HTTP ${res.status}`);
          return;
        }
        setDecisionResult({
          decisionId: json.decisionId!,
          pipelineRunId: json.pipelineRunId!,
        });
        setDecisionTitle("");
        setDecisionRationale("");
        setDecisionOwner("");
        setDecisionDueDate("");
        router.refresh();
      } catch (err) {
        setDecisionError((err as Error).message ?? "Network error");
      }
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setNoteOpen(true)}>
          <NotebookPen className="mr-2 h-4 w-4" />
          Add note
          {notes.length > 0 && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
              {notes.length}
            </span>
          )}
        </Button>
        <Button variant="outline" onClick={() => setDecisionOpen(true)}>
          <Gavel className="mr-2 h-4 w-4" />
          Log decision
        </Button>
        <Button variant="outline" onClick={downloadProofPack} disabled={proofPackBusy}>
          <Package className="mr-2 h-4 w-4" />
          {proofPackBusy ? "Packaging…" : "Download evidence"}
        </Button>
        <Button
          onClick={() =>
            download(`${demoCase.id}-meeting-package.txt`, buildMeetingPackage(demoCase, notes))
          }
        >
          <FileDown className="mr-2 h-4 w-4" />
          Prepare meeting package
        </Button>
      </div>
      {proofPackError && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {proofPackError}
        </div>
      )}

      <Sheet open={noteOpen} onOpenChange={setNoteOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add steward note</SheetTitle>
            <SheetDescription>
              Notes are kept in this session for demo purposes and bundled into the meeting package
              when exported.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Label htmlFor="case-note">Note</Label>
            <Textarea
              id="case-note"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What changed? What is the next follow-up?"
              rows={6}
            />
            {notes.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {notes.length} note{notes.length === 1 ? "" : "s"} captured this session — they will
                appear in the next meeting-package export.
              </div>
            )}
          </div>
          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitNote} disabled={!draft.trim()}>
              Save note
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={decisionOpen} onOpenChange={setDecisionOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Log decision</SheetTitle>
            <SheetDescription>
              Persists to the executive decision pipeline (executive_decisions +
              decision_pipeline_runs) and emits a proof-pack artifact for download.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="decision-title">Title</Label>
              <Input
                id="decision-title"
                value={decisionTitle}
                onChange={(e) => setDecisionTitle(e.target.value)}
                placeholder="e.g. Escalate to Step 2 and request HR meeting within 5 days"
                maxLength={280}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decision-rationale">Rationale</Label>
              <Textarea
                id="decision-rationale"
                value={decisionRationale}
                onChange={(e) => setDecisionRationale(e.target.value)}
                placeholder="Why this decision — agreement refs, prior precedent, risk exposure."
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="decision-owner">Owner</Label>
                <Input
                  id="decision-owner"
                  value={decisionOwner}
                  onChange={(e) => setDecisionOwner(e.target.value)}
                  placeholder="e.g. M. Ahmed"
                  maxLength={128}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="decision-due">Due date</Label>
                <Input
                  id="decision-due"
                  type="date"
                  value={decisionDueDate}
                  onChange={(e) => setDecisionDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="decision-priority">Priority</Label>
                <select
                  id="decision-priority"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={decisionPriority}
                  onChange={(e) =>
                    setDecisionPriority(e.target.value as DecisionPriority)
                  }
                >
                  <option value="p0">p0 — critical</option>
                  <option value="p1">p1 — high</option>
                  <option value="p2">p2 — normal</option>
                  <option value="p3">p3 — low</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="decision-status">Status</Label>
                <select
                  id="decision-status"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={decisionStatus}
                  onChange={(e) =>
                    setDecisionStatus(e.target.value as DecisionStatus)
                  }
                >
                  <option value="proposed">proposed</option>
                  <option value="approved">approved</option>
                  <option value="executing">executing</option>
                  <option value="done">done</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
            </div>
            {decisionError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {decisionError}
              </div>
            )}
            {decisionResult && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <div className="font-semibold">Decision recorded</div>
                <div className="mt-1 font-mono break-all">
                  decision: {decisionResult.decisionId}
                </div>
                <div className="font-mono break-all">
                  pipeline run: {decisionResult.pipelineRunId}
                </div>
              </div>
            )}
          </div>
          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setDecisionOpen(false)}>
              Close
            </Button>
            <Button
              onClick={submitDecision}
              disabled={
                submitting || !decisionTitle.trim() || !decisionRationale.trim()
              }
            >
              {submitting ? "Recording…" : "Record decision"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
