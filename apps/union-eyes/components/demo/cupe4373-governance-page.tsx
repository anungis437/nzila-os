"use client";

/**
 * Cupe 4373 Baseline Governance — Foundation-tier surface.
 *
 * Decisions of record + motions, with read-only history and a demo-only
 * "log a decision" sheet. Advanced governance (voting/quorum/policy
 * enforcement) is explicitly scoped to the Governance Operations tier.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  CheckCircle2,
  Gavel,
  PlusCircle,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Vote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { Cupe4373DoctrineFooter } from "@/components/demo/cupe4373-doctrine-footer";
import {
  decisionsOfRecord,
  motions,
  retentionPolicy,
  type DecisionOfRecord,
  type Motion,
} from "@/lib/demo/cupe4373-demo";

const STORAGE_KEY = "ue-demo-logged-decisions";

type DraftDecision = {
  id: string;
  date: string;
  body: DecisionOfRecord["body"];
  title: string;
  decision: string;
};

const motionStatusStyles: Record<Motion["status"], string> = {
  tabled: "border-slate-200 bg-slate-50 text-slate-700",
  "in-discussion": "border-amber-200 bg-amber-50 text-amber-800",
  "scheduled-vote": "border-blue-200 bg-blue-50 text-blue-800",
};

const bodyStyles: Record<DecisionOfRecord["body"], string> = {
  Executive: "border-violet-200 bg-violet-50 text-violet-800",
  "Stewards Council": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "General Membership Meeting": "border-blue-200 bg-blue-50 text-blue-800",
};

export function Cupe4373GovernancePage() {
  const locale = useLocale();
  const [drafts, setDrafts] = useState<DraftDecision[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    body: "Executive" as DecisionOfRecord["body"],
    title: "",
    decision: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) setDrafts(JSON.parse(raw) as DraftDecision[]);
    } catch {
      /* no-op */
    }
  }, []);

  function persist(next: DraftDecision[]) {
    setDrafts(next);
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* no-op */
    }
  }

  function logDecision() {
    if (!form.title.trim() || !form.decision.trim()) return;
    const draft: DraftDecision = {
      id: `DOR-DRAFT-${String(drafts.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString().slice(0, 10),
      body: form.body,
      title: form.title.trim(),
      decision: form.decision.trim(),
    };
    persist([draft, ...drafts]);
    setForm({ body: "Executive", title: "", decision: "" });
    setOpen(false);
  }

  const combinedDecisions = useMemo(() => {
    const drafted: DecisionOfRecord[] = drafts.map((d) => ({
      id: d.id,
      date: d.date,
      body: d.body,
      title: d.title,
      decision: d.decision,
      votesFor: 0,
      votesAgainst: 0,
      abstain: 0,
      carriedBy: "consensus" as const,
      precedentFor: ["Logged in demo session"],
    }));
    return [...drafted, ...decisionsOfRecord];
  }, [drafts]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-violet-200 bg-violet-50 text-violet-800">
              <Gavel className="mr-1.5 h-3 w-3" />
              Baseline governance
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Governance</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              CUPE Local 4373's bounded record of decisions and motions: who decided what,
              when, and with what majority. Foundation tier focuses on the operating record;
              policy enforcement and weighted voting live in the Governance Operations tier.
            </p>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button>
                <PlusCircle className="mr-1.5 h-4 w-4" />
                Log a decision
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Log a decision</SheetTitle>
                <SheetDescription>
                  Demo-only. New entries persist for this browser session and appear at the top
                  of the decisions-of-record log.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="dor-body">Decided by</Label>
                  <select
                    id="dor-body"
                    value={form.body}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, body: e.target.value as DecisionOfRecord["body"] }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option>Executive</option>
                    <option>Stewards Council</option>
                    <option>General Membership Meeting</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="dor-title">Title</Label>
                  <input
                    id="dor-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Approve labour-management agenda — June cycle"
                    className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="dor-decision">Decision</Label>
                  <Textarea
                    id="dor-decision"
                    value={form.decision}
                    onChange={(e) => setForm((f) => ({ ...f, decision: e.target.value }))}
                    placeholder="State the decision in one or two sentences."
                    rows={5}
                  />
                </div>
              </div>
              <SheetFooter className="mt-6">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={logDecision} disabled={!form.title || !form.decision}>
                  Log decision
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-900">
        <p className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-3.5 w-3.5" /> Foundation scope
        </p>
        <p className="mt-1">
          Baseline governance covers the decisions-of-record log and motions register. Weighted
          voting, quorum gating, policy enforcement, and automated escalation are part of the
          Governance Operations tier — not enabled in this demo.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" />
              Decisions of record
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                {combinedDecisions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {combinedDecisions.map((d) => (
              <div
                key={d.id}
                className="rounded-md border border-slate-200 bg-white p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={bodyStyles[d.body]}>
                    {d.body}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {new Date(d.date).toLocaleDateString("en-CA")} · {d.id}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-slate-950">{d.title}</p>
                <p className="mt-1 text-slate-700">{d.decision}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {d.votesFor} for
                  </span>
                  <span>{d.votesAgainst} against</span>
                  <span>{d.abstain} abstain</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                    carried by {d.carriedBy}
                  </span>
                </div>
                {d.precedentFor.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Cited as precedent for:{" "}
                    {d.precedentFor.map((ref, idx) => {
                      const isCaseRef = /^UE-\d{4}-\d{3}$/.test(ref);
                      const sep = idx > 0 ? ", " : "";
                      return (
                        <span key={ref}>
                          {sep}
                          {isCaseRef ? (
                            <Link
                              href={`/${locale}/dashboard/cases/${ref}`}
                              className="text-blue-700 underline-offset-2 hover:underline"
                            >
                              {ref}
                            </Link>
                          ) : (
                            ref
                          )}
                        </span>
                      );
                    })}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Vote className="h-4 w-4" />
              Motions register
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                {motions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {motions.map((m) => (
              <div
                key={m.id}
                className="rounded-md border border-slate-200 bg-white p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={motionStatusStyles[m.status]}>
                    {m.status.replace("-", " ")}
                  </Badge>
                  <Badge variant="outline" className={bodyStyles[m.body]}>
                    {m.body}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {m.id} · scheduled {new Date(m.scheduled).toLocaleDateString("en-CA")}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-slate-950">{m.title}</p>
                <p className="mt-1 text-slate-700">{m.summary}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Moved by {m.movedBy} · seconded by {m.seconded}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-500" />
        <div>
          <p className="font-medium text-slate-900">{retentionPolicy.shortLabel}</p>
          <p className="mt-0.5 text-slate-600">
            Governance decisions are retained under the same bounded policy. Decisions cited as
            precedent for active files are held for the statutory window.
          </p>
        </div>
      </div>

      <Cupe4373DoctrineFooter
        reviewerOfRecord="Executive Board (motions), General Membership Meeting (ratifications)"
        escalation="Disputed entries return to the next regularly scheduled body for re-affirmation or amendment"
        context="This is the local's operating record. Quorum-gated voting, weighted decisions, and policy enforcement live in Governance Operations."
      />
    </div>
  );
}
