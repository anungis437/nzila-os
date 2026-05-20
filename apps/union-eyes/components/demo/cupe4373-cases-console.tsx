"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { CalendarClock, FileText, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import {
  Cupe4373NewCaseButton,
  loadSessionCases,
  type NewDemoCase,
} from "@/components/demo/cupe4373-new-case-button";
import { caseworkTabs, demoCases as staticDemoCases, type CaseworkTabId, type DemoCase } from "@/lib/demo/cupe4373-demo";

const urgencyStyles = {
  urgent: "border-red-200 bg-red-50 text-red-800",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  steady: "border-slate-200 bg-slate-50 text-slate-700",
};

type Cupe4373CasesConsoleProps = {
  /**
   * Cases to render. When omitted, falls back to the static demo fixture
   * (preserves backward compat for any pre-Gap-1 callers). The page passes
   * DB-backed cases here when reading from Postgres.
   */
  cases?: DemoCase[];
  /** Visible badge revealing whether data came from DB or static fixture. */
  dataSource?: "db" | "static";
};

export function Cupe4373CasesConsole({ cases: casesProp, dataSource = "static" }: Cupe4373CasesConsoleProps = {}) {
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [activeTab, setActiveTab] = useState<CaseworkTabId>("all");
  const [sessionCases, setSessionCases] = useState<NewDemoCase[]>([]);

  useEffect(() => {
    setSessionCases(loadSessionCases());
  }, []);

  const baseCases = casesProp ?? staticDemoCases;

  const allCases = useMemo<Array<DemoCase | NewDemoCase>>(
    () => [...sessionCases, ...baseCases],
    [sessionCases, baseCases],
  );

  const cases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allCases.filter((item) => {
      const matchesQuery =
        !normalized ||
        item.title.toLowerCase().includes(normalized) ||
        item.type.toLowerCase().includes(normalized) ||
        item.worker.toLowerCase().includes(normalized) ||
        item.id.toLowerCase().includes(normalized);
      const matchesStatus = status === "all" || item.urgency === status;
      const isFixture = "deadline" in item;
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "grievances" && item.caseworkStream === "grievance") ||
        (activeTab === "accommodations" && item.caseworkStream === "accommodation") ||
        (activeTab === "health-safety" && item.caseworkStream === "health-safety") ||
        (activeTab === "deadlines" &&
          (item.urgency === "urgent" ||
            (isFixture && daysUntil((item as DemoCase).deadline) <= 10)));
      return matchesQuery && matchesStatus && matchesTab;
    });
  }, [activeTab, query, status, allCases]);

  const tabCounts = useMemo(() => {
    return {
      all: allCases.length,
      grievances: allCases.filter((item) => item.caseworkStream === "grievance").length,
      accommodations: allCases.filter((item) => item.caseworkStream === "accommodation").length,
      "health-safety": allCases.filter((item) => item.caseworkStream === "health-safety").length,
      deadlines: allCases.filter((item) => {
        if (item.urgency === "urgent") return true;
        if ("deadline" in item) return daysUntil((item as DemoCase).deadline) <= 10;
        return false;
      }).length,
    } satisfies Record<CaseworkTabId, number>;
  }, [allCases]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-blue-200 bg-blue-50 text-blue-800">
              Case continuity
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Cases</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Healthcare-union casework with the operational context a steward needs: status,
              agreement references, deadlines, assignments, and handoff readiness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Cupe4373NewCaseButton
              onCreated={(created) => setSessionCases((prev) => [created, ...prev])}
            />
            <Button asChild variant="outline">
              <Link href={`/${locale}/dashboard/cases/${baseCases[0]?.id ?? staticDemoCases[0].id}`}>Open demo chronology</Link>
            </Button>
          </div>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
             style={{
               borderColor: dataSource === "db" ? "#bbf7d0" : "#e2e8f0",
               backgroundColor: dataSource === "db" ? "#f0fdf4" : "#f8fafc",
               color: dataSource === "db" ? "#166534" : "#475569",
             }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dataSource === "db" ? "#16a34a" : "#94a3b8" }} />
          {dataSource === "db"
            ? "Live data — sourced from foundation demo Postgres"
            : "Local fixture — static demo data"}
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-3">
          <div className="grid gap-2 lg:grid-cols-5">
            {caseworkTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{tab.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {tabCounts[tab.id]}
                    </span>
                  </span>
                  <span className={`mt-1 block text-xs leading-5 ${active ? "text-slate-200" : "text-slate-500"}`}>
                    {tab.description}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by case, member, unit, or issue"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["urgent", "Urgent"],
                ["watch", "Watch"],
                ["steady", "Steady"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    status === value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {cases.length > 0 ? (
          cases.map((item) => {
            const isFixture = "deadline" in item;
            const fixture = isFixture ? (item as DemoCase) : null;
            const inner = (
              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={urgencyStyles[item.urgency]}>
                      {item.status}
                    </Badge>
                    <span className="font-mono text-xs text-slate-500">{item.id}</span>
                    <span className="text-xs text-slate-400">/</span>
                    <span className="text-xs font-medium text-slate-600">{item.type}</span>
                    {!isFixture && (
                      <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800">
                        New (this session)
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{item.summary}</p>
                  {fixture && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {fixture.agreementRefs.slice(0, 3).map((ref) => (
                        <span key={ref} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-3 rounded-md bg-slate-50 p-4 text-sm">
                  {fixture ? (
                    <>
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-800">{fixture.assignedSteward}</p>
                          <p className="text-xs text-slate-500">Assigned steward</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CalendarClock className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-800">
                            {new Date(fixture.deadline).toLocaleDateString("en-CA")}
                          </p>
                          <p className="text-xs text-slate-500">Next deadline</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-800">{fixture.continuityState}</p>
                          <p className="text-xs text-slate-500">Continuity note</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-800">{item.worker}</p>
                          <p className="text-xs text-slate-500">Filed by member</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CalendarClock className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-800">
                            {new Date(item.opened).toLocaleDateString("en-CA")}
                          </p>
                          <p className="text-xs text-slate-500">Opened</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-800">Session-only</p>
                          <p className="text-xs text-slate-500">Persists until tab closes</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
            return fixture ? (
              <Link
                key={item.id}
                href={`/${locale}/dashboard/cases/${encodeURIComponent(item.id)}`}
                className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:bg-slate-50"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={item.id}
                className="block rounded-lg border border-blue-200 bg-blue-50/30 p-5 shadow-sm"
              >
                {inner}
              </div>
            );
          })
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-8 text-center">
              <p className="text-sm font-medium text-slate-900">No casework matches this view.</p>
              <p className="mt-1 text-sm text-slate-500">Clear the search or urgency filter to restore the demo set.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function daysUntil(value: string) {
  const now = new Date("2026-05-19T12:00:00-04:00").getTime();
  const deadline = new Date(value).getTime();
  return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
}
