"use client";

/**
 * Cupe 4373 Priorities — Foundation-tier "what needs your attention now" surface.
 * Groups outstanding commitments into Today / This week / Watch (10 days)
 * cohorts so a steward never loses track of who owes what to whom.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ListChecks,
  RotateCcw,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { Cupe4373DoctrineFooter } from "@/components/demo/cupe4373-doctrine-footer";
import {
  calendarEvents,
  demoCases,
  retentionPolicy,
  type DemoCase,
} from "@/lib/demo/cupe4373-demo";

const STORAGE_KEY = "ue-demo-commitments-met";

type Commitment = {
  id: string;
  kind: "case" | "meeting";
  title: string;
  detail: string;
  who: string;
  due: string; // ISO date
  href?: string;
  urgency: "urgent" | "watch" | "steady";
};

function buildCommitments(): Commitment[] {
  const fromCases: Commitment[] = demoCases
    .filter((c) => c.status !== "Closed")
    .map((c: DemoCase) => ({
      id: `case:${c.id}`,
      kind: "case",
      title: `${c.id} — ${c.nextStep}`,
      detail: `${c.title} (${c.worker}, ${c.unit})`,
      who: c.assignedSteward,
      due: c.deadline,
      href: `/dashboard/cases/${c.id}`,
      urgency: c.urgency,
    }));

  const fromMeetings: Commitment[] = calendarEvents.map((event) => ({
    id: `meeting:${event.date}-${event.title}`,
    kind: "meeting",
    title: event.title,
    detail: event.detail,
    who: "Steward team",
    due: event.date,
    urgency: event.title.toLowerCase().includes("due") ? "urgent" : "watch",
  }));

  return [...fromCases, ...fromMeetings].sort((a, b) => a.due.localeCompare(b.due));
}

type Cohort = "today" | "this-week" | "watch" | "later";

function classify(due: string): Cohort {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due);
  dueDate.setHours(0, 0, 0, 0);
  const diff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "today";
  if (diff <= 7) return "this-week";
  if (diff <= 14) return "watch";
  return "later";
}

const cohortMeta: Record<
  Cohort,
  { label: string; description: string; tone: string; icon: typeof Clock }
> = {
  today: {
    label: "Today",
    description: "Due now or overdue — act before close of business.",
    tone: "border-red-200 bg-red-50",
    icon: AlertTriangle,
  },
  "this-week": {
    label: "This week",
    description: "Owed within 7 days — keep moving so they don't roll over.",
    tone: "border-amber-200 bg-amber-50",
    icon: Clock,
  },
  watch: {
    label: "Watch (next 10 days)",
    description: "Inside the labour-management horizon — line up evidence.",
    tone: "border-sky-200 bg-sky-50",
    icon: CalendarClock,
  },
  later: {
    label: "Later",
    description: "Tracked but not yet pressing.",
    tone: "border-slate-200 bg-slate-50",
    icon: ListChecks,
  },
};

const urgencyStyles = {
  urgent: "border-red-200 bg-red-50 text-red-800",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  steady: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

export function Cupe4373PrioritiesPage() {
  const locale = useLocale();
  const all = useMemo(() => buildCommitments(), []);
  const [metIds, setMetIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) setMetIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* no-op */
    }
  }, []);

  function persist(next: Set<string>) {
    setMetIds(new Set(next));
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* no-op */
    }
  }

  function toggleMet(id: string) {
    const next = new Set(metIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persist(next);
  }

  function reset() {
    persist(new Set());
  }

  const groups: Record<Cohort, Commitment[]> = {
    today: [],
    "this-week": [],
    watch: [],
    later: [],
  };
  for (const c of all) groups[classify(c.due)].push(c);

  const metCount = all.filter((c) => metIds.has(c.id)).length;
  const liveCount = all.length - metCount;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge variant="outline" className="mb-3 border-amber-200 bg-amber-50 text-amber-800">
          <Target className="mr-1.5 h-3 w-3" />
          Priorities · cadence
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Priorities</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Every commitment a steward owes to a member, an employer, or the executive — grouped
          by when it's due. Cadence-first, so nothing slips between cycles.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Commitments live this week" value={`${liveCount} of ${all.length}`} />
          <Stat label="Marked done (this session)" value={String(metCount)} />
          <Stat label="Due today / overdue" value={String(groups.today.length)} />
        </div>

        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset demo progress
          </Button>
        </div>
      </div>

      <RetentionStrip />

      <div className="space-y-4">
        {(Object.keys(groups) as Cohort[]).map((cohort) => {
          const items = groups[cohort];
          if (cohort === "later" && items.length === 0) return null;
          const meta = cohortMeta[cohort];
          const Icon = meta.icon;
          return (
            <Card key={cohort} className={`border shadow-sm ${meta.tone}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </span>
                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                    {items.length}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-slate-700">{meta.description}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 && (
                  <p className="text-sm text-slate-600">Nothing owed in this window. Quiet is good.</p>
                )}
                {items.map((c) => {
                  const isMet = metIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={`flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between ${
                        isMet ? "opacity-60" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={urgencyStyles[c.urgency]}>
                            {c.urgency}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-slate-200 bg-slate-50 text-slate-700"
                          >
                            {c.kind === "case" ? "Case" : "Meeting"}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            Due {new Date(c.due).toLocaleDateString("en-CA")}
                          </span>
                        </div>
                        <p
                          className={`mt-1 text-sm font-semibold text-slate-950 ${
                            isMet ? "line-through" : ""
                          }`}
                        >
                          {c.title}
                        </p>
                        <p className="text-xs text-slate-600">{c.detail}</p>
                        <p className="text-[11px] text-slate-500">Owner: {c.who}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {c.href && (
                          <Link
                            href={`/${locale}${c.href}`}
                            className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
                          >
                            Open
                          </Link>
                        )}
                        <Button
                          variant={isMet ? "outline" : "default"}
                          size="sm"
                          onClick={() => toggleMet(c.id)}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          {isMet ? "Reopen" : "Mark met"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-[11px] leading-5 text-slate-500">
        Demo-only: "Mark met" persists in this browser session. In production it writes to the
        operating record with attribution and stays on the case chronology.
      </p>

      <Cupe4373DoctrineFooter
        reviewerOfRecord="Assigned steward for each commitment; Chief Steward for cadence oversight"
        escalation="Stuck items roll into the next labour-management cycle agenda automatically"
        context="Cohort grouping (Today / This week / Watch) is a cadence aid, not a priority verdict."
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function RetentionStrip() {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700">
      <span className="font-medium text-slate-900">{retentionPolicy.shortLabel}.</span>{" "}
      Priorities are derived from active cases and the calendar; both follow the same retention
      window.
    </div>
  );
}
